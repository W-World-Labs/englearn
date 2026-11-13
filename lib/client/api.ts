import type { PaginatedResult } from "@/lib/pagination";
import {
  newClaimSecret,
  setStoredClaimSecret,
  sha256Hex,
} from "@/lib/client/claim-session";
import { getProgressAccount } from "@/lib/gamification/store";
import type {
  ClientItem,
  ClientResponse,
  ItemFormat,
  ModuleType,
  TestResult,
} from "@/lib/types";

async function parseJson<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Fetch with session cookie when logged in. */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("X-LingoLearn-Account")) {
    // An empty expected account represents the guest/unknown UI, rather than
    // silently adopting a session cookie changed by another browser tab.
    headers.set("X-LingoLearn-Account", getProgressAccount() ?? "");
  }
  return fetch(path, {
    credentials: "include",
    ...init,
    headers,
    // Every remote call needs a bound: a dead connection must reject instead
    // of hanging the UI forever. A caller-supplied signal always wins so
    // slower endpoints (e.g. /api/score) can keep their longer budget.
    signal: init?.signal ?? AbortSignal.timeout(10_000),
  });
}

export type AssessmentFetchStatus = "ready" | "missing" | "forbidden" | "error";

export async function fetchAssessmentResult(
  sessionId: string,
): Promise<TestResult | null> {
  const outcome = await fetchAssessmentResultStatus(sessionId);
  return outcome.status === "ready" ? outcome.result : null;
}

export async function fetchAssessmentResultStatus(
  sessionId: string,
): Promise<
  | { status: "ready"; result: TestResult }
  | { status: Exclude<AssessmentFetchStatus, "ready"> }
> {
  const res = await apiFetch(
    `/api/result?sessionId=${encodeURIComponent(sessionId)}`,
  );
  if (res.status === 403) return { status: "forbidden" };
  if (res.status === 404) return { status: "missing" };
  if (!res.ok) return { status: "error" };
  const result = await parseJson<TestResult>(res);
  if (!result) return { status: "missing" };
  return { status: "ready", result };
}

export interface SessionResumePayload {
  learningLanguage?: string;
  sessionId: string;
  finished?: boolean;
  modules: ModuleType[];
  currentModule: ModuleType;
  moduleCounts: Record<string, number>;
  item: ClientItem | null;
  createdAt?: string;
}

export async function fetchSessionResume(
  sessionId: string,
): Promise<SessionResumePayload | null> {
  const res = await apiFetch(
    `/api/session?sessionId=${encodeURIComponent(sessionId)}`,
    { signal: AbortSignal.timeout(10000) },
  );
  // A transient outage or login problem must not erase the only resume link.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Unable to load saved session");
  const data = await parseJson<SessionResumePayload>(res);
  if (!data) throw new Error("Invalid saved session response");
  return data;
}

export async function createTestSession(
  modules: ModuleType[],
  learningLanguage: string,
): Promise<{
  sessionId: string;
  item: ClientItem | null;
  currentModule: ModuleType;
} | null> {
  // A device-held claim secret lets this browser bind a guest session to a
  // W-ID account later; the server only ever stores its hash.
  const claimSecret = newClaimSecret();
  const claimHash = claimSecret ? await sha256Hex(claimSecret) : null;
  const res = await apiFetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modules,
      learningLanguage,
      ...(claimHash ? { claimHash } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await parseJson<{
    sessionId: string;
    item: ClientItem | null;
    currentModule: ModuleType;
  }>(res);
  if (data?.sessionId && claimSecret) {
    setStoredClaimSecret(data.sessionId, claimSecret);
  }
  return data;
}

export async function claimTestSession(
  sessionId: string,
  claimSecret: string,
): Promise<boolean> {
  const res = await apiFetch("/api/session/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, claimSecret }),
    signal: AbortSignal.timeout(10000),
  });
  return res.ok;
}

export async function abandonTestSession(sessionId: string): Promise<boolean> {
  const res = await apiFetch(
    `/api/session?sessionId=${encodeURIComponent(sessionId)}`,
    { method: "DELETE", signal: AbortSignal.timeout(10000) },
  );
  return res.ok || res.status === 404;
}

export interface RespondPayload {
  item: ClientItem | null;
  currentModule: ModuleType;
  moduleDone: boolean;
  done: boolean;
  lastGrade?: {
    itemId: string;
    correct: boolean;
    module: ModuleType;
    format: ItemFormat;
  };
}

export async function submitTestResponse(
  sessionId: string,
  response: ClientResponse,
): Promise<RespondPayload | null> {
  const res = await apiFetch("/api/respond", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, response }),
  });
  return parseJson<RespondPayload>(res);
}

export async function scoreOpenItem(
  sessionId: string,
  itemId: string,
  text: string,
  locale?: string,
): Promise<{ score: number; feedback: string } | null> {
  const res = await apiFetch("/api/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, itemId, text, locale }),
    // Server-side provider calls run up to 30s; keep a margin above that.
    signal: AbortSignal.timeout(35_000),
  });
  return parseJson(res);
}

/** Poll until result exists (session just finished). */
export async function waitForAssessmentResult(
  sessionId: string,
  attempts = 24,
  delayMs = 200,
): Promise<TestResult | null> {
  for (let i = 0; i < attempts; i++) {
    const result = await fetchAssessmentResult(sessionId);
    if (result) return result;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

export async function fetchHistoryAll(): Promise<TestResult[]> {
  const res = await apiFetch("/api/history?all=1");
  const data = await parseJson<TestResult[] | PaginatedResult<TestResult>>(res);
  if (Array.isArray(data)) return data;
  return [];
}

export async function fetchHistoryPage(
  page: number,
  pageSize: number,
): Promise<PaginatedResult<TestResult>> {
  const res = await apiFetch(`/api/history?page=${page}&pageSize=${pageSize}`);
  const data = await parseJson<PaginatedResult<TestResult>>(res);
  if (data && Array.isArray(data.items)) return data;
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize,
    totalPages: 1,
  };
}

export async function deleteAssessmentResult(
  sessionId: string,
): Promise<boolean> {
  const res = await apiFetch(
    `/api/result?sessionId=${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
  );
  return res.ok;
}

import { getAuthUser, requestAccountMatches } from "@/lib/auth/request";
import { publicAppOrigin } from "@/lib/auth/config";
import { paginateArray, parsePageParams } from "@/lib/pagination";
import { validAttemptId } from "./attempt-store";
import type { AttemptSession, SavedAttempt } from "./storage-types";

export function createAttemptHandlers<T extends AttemptSession, S>({
  get,
  list,
  save,
  parse,
  reconcile,
  duration,
  summary,
  maxBodyBytes = 512000,
}: {
  get: (owner: string, id: string) => SavedAttempt<T> | null;
  list: (owner: string) => SavedAttempt<T>[];
  save: (
    owner: string,
    session: T,
    revision: number | null,
  ) => { ok: boolean; attempt: SavedAttempt<T> };
  parse: (raw: string | null) => T | null;
  reconcile: (session: T, now: number) => T;
  duration: (session: T) => number;
  summary: (saved: SavedAttempt<T>) => S;
  maxBodyBytes?: number;
}) {
  function json(body: unknown, status = 200): Response {
    return Response.json(body, {
      status,
      headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
    });
  }

  async function GET(request: Request) {
    const user = await getAuthUser(request);
    if (!user)
      return json({ error: "Sign in with W-ID to access exam records" }, 401);
    if (!requestAccountMatches(request, user.sub))
      return json({ error: "The signed-in account has changed" }, 403);
    const url = new URL(request.url);
    try {
      const id = url.searchParams.get("id");
      if (id) {
        const attempt = get(user.sub, id);
        return attempt
          ? json({
              attempt: {
                ...attempt,
                session: reconcile(attempt.session, Date.now()),
              },
            })
          : json({ error: "Exam record not found" }, 404);
      }
      const all = list(user.sub);
      const { page, pageSize } = parsePageParams(url.searchParams, {
        pageSize: 10,
      });
      const summaries = all.map(summary);
      const draftId = url.searchParams.get("draftId");
      return json({
        ...paginateArray(summaries, page, Math.min(50, pageSize)),
        latest: all[0] ?? null,
        draft: draftId
          ? (all.find((a) => a.session.id === draftId) ?? null)
          : null,
      });
    } catch {
      return json({ error: "Exam records are temporarily unavailable" }, 503);
    }
  }

  async function POST(request: Request) {
    const user = await getAuthUser(request);
    if (!user)
      return json({ error: "Sign in with W-ID to save exam records" }, 401);
    if (!requestAccountMatches(request, user.sub))
      return json({ error: "The signed-in account has changed" }, 403);
    const origin = request.headers.get("origin");
    // Caddy terminates HTTPS; the server request may retain its HTTP origin.
    if (origin && origin !== new URL(request.url).origin && origin !== publicAppOrigin())
      return json({ error: "Invalid request origin" }, 403);
    if (!request.headers.get("content-type")?.includes("application/json"))
      return json({ error: "Expected JSON" }, 415);
    let body: { session?: unknown; revision?: unknown };
    try {
      const reader = request.body?.getReader();
      if (!reader) return json({ error: "Missing request body" }, 400);
      const decoder = new TextDecoder();
      let bytes = 0,
        text = "";
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > maxBodyBytes) {
          await reader.cancel();
          return json({ error: "Exam record is too large" }, 413);
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      body = JSON.parse(text + decoder.decode());
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const session = parse(JSON.stringify(body?.session) ?? null);
    if (
      !session ||
      !validAttemptId(session.id) ||
      !(
        body.revision === null ||
        (Number.isInteger(body.revision) && Number(body.revision) > 0)
      )
    )
      return json({ error: "Invalid exam record or revision" }, 400);
    if (
      session.startedAt > Date.now() + 30000 ||
      ("deadline" in session &&
        Number(session.deadline) > session.startedAt + duration(session) + 1000)
    )
      return json({ error: "Invalid exam timing" }, 400);
    try {
      const result = save(user.sub, session, body.revision as number | null);
      return json(
        {
          attempt: result.attempt,
          ...(result.ok
            ? {}
            : {
                error:
                  "This exam was updated on another device or already submitted",
              }),
        },
        result.ok ? 200 : 409,
      );
    } catch {
      return json(
        {
          error:
            "Exam record could not be saved. Your browser copy is unchanged.",
        },
        503,
      );
    }
  }

  return { GET, POST };
}

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiFetch, createTestSession, fetchHistoryAll } from "./api";
import { getProgressAccount } from "@/lib/gamification/store";

vi.mock("@/lib/gamification/store", () => ({ getProgressAccount: vi.fn() }));

const fetchMock = vi.fn();
beforeEach(() => {
  vi.mocked(getProgressAccount).mockReturnValue(null);
  fetchMock.mockReset().mockImplementation(async () => Response.json([]));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it("binds both account history and new assessment sessions to the visible account", async () => {
  vi.mocked(getProgressAccount).mockReturnValue("alice");
  await fetchHistoryAll();
  await createTestSession(["grammar"], "en");
  for (const [, init] of fetchMock.mock.calls) {
    expect(new Headers(init.headers).get("X-LingoLearn-Account")).toBe("alice");
  }
});

it("sends an explicit empty account for guest pages and preserves supplied Headers", async () => {
  await apiFetch("/api/session", { headers: new Headers({ "Content-Type": "application/json" }) });
  const headers = new Headers(fetchMock.mock.calls[0][1].headers);
  expect(headers.has("X-LingoLearn-Account")).toBe(true);
  expect(headers.get("X-LingoLearn-Account")).toBe("");
  expect(headers.get("Content-Type")).toBe("application/json");
});

it("preserves a caller's captured account when its asynchronous work outlives the current UI", async () => {
  vi.mocked(getProgressAccount).mockReturnValue("bob");
  await apiFetch("/api/result?sessionId=alice-result", {
    headers: { "X-LingoLearn-Account": "alice" },
  });
  expect(new Headers(fetchMock.mock.calls[0][1].headers).get("X-LingoLearn-Account")).toBe("alice");
});

it("applies a default timeout signal when the caller supplies none", async () => {
  await apiFetch("/api/history?all=1");
  const signal = fetchMock.mock.calls[0][1].signal;
  expect(signal).toBeInstanceOf(AbortSignal);
  expect(signal.aborted).toBe(false);
});

it("never replaces a caller-supplied signal", async () => {
  const controller = new AbortController();
  await apiFetch("/api/history?all=1", { signal: controller.signal });
  expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
});

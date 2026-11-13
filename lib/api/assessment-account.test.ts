import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { getSsoConfig } from "@/lib/auth/config";

let directory: string;
let alice: string, bob: string;
let sessionApi: typeof import("./session");
let db: typeof import("@/lib/db");

function request(endpoint: string, token: string, expected: string | undefined, body?: unknown, method = body === undefined ? "GET" : "POST") {
  return new Request(`http://localhost/api/${endpoint}`, {
    method,
    headers: {
      cookie: `lingolearn_session=${token}`,
      ...(expected === undefined ? {} : { "X-LingoLearn-Account": expected }),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeAll(async () => {
  directory = fs.mkdtempSync(path.join(process.cwd(), "data/.test-assessment-account-"));
  vi.stubEnv("ENGLEARN_DATA_DIR", directory);
  vi.stubEnv("W_ID_CLIENT_ID", "assessment-account-test");
  vi.stubEnv("W_ID_CLIENT_SECRET", "test-only-client-secret");
  vi.stubEnv("JWT_SECRET", "test-only-jwt-secret-at-least-thirty-two-characters");
  vi.stubEnv("W_ID_REDIRECT_URI", "http://localhost/api/auth/callback");
  const config = getSsoConfig()!;
  const exp = Math.floor(Date.now() / 1000) + 3600;
  alice = await config.signSessionClaims({ sub: "alice", exp });
  bob = await config.signSessionClaims({ sub: "bob", exp });
  sessionApi = await import("./session");
  db = await import("@/lib/db");
});
afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

it("rejects stale account and guest tabs before creating a session for the changed cookie", async () => {
  for (const expected of ["alice", ""]) {
    expect((await sessionApi.handleSessionPost(request("session", bob, expected, { modules: ["grammar"] }))).status).toBe(403);
  }
  expect(fs.existsSync(path.join(directory, "sessions.json"))).toBe(false);
  for (const [token, expected, owner] of [[alice, "alice", "alice"], [bob, undefined, "bob"], ["", "", undefined]] as const) {
    const response = await sessionApi.handleSessionPost(request("session", token, expected, { modules: ["grammar"] }));
    expect(response.status).toBe(200);
    expect(db.getSession((await response.json()).sessionId)?.userId).toBe(owner);
  }
});

it("does not reveal a changed account's history to a stale account or guest tab", async () => {
  const { handleHistoryGet } = await import("./history");
  db.saveResult({ sessionId: "bob-report", userId: "bob", completedAt: new Date().toISOString(), overallCEFR: "B1", modules: [] });
  for (const expected of ["alice", ""]) {
    const response = await handleHistoryGet(request("history?all=1", bob, expected));
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("bob-report");
  }
  expect((await (await handleHistoryGet(request("history?all=1", bob, "bob"))).json())[0].sessionId).toBe("bob-report");
});

it("enforces expected-account checks on existing session and result access", async () => {
  const { handleItemGet } = await import("./item");
  const { handleRespondPost } = await import("./respond");
  const { handleScorePost } = await import("./score");
  const { handleResultGet, handleResultDelete } = await import("./result");
  const created = await (await sessionApi.handleSessionPost(request("session", bob, "bob", { modules: ["writing"] }))).json();
  const before = db.getSession(created.sessionId);
  for (const handler of [sessionApi.handleSessionGet, sessionApi.handleSessionDelete, handleItemGet]) {
    expect((await handler(request(`session?sessionId=${created.sessionId}`, bob, "alice"))).status).toBe(403);
  }
  expect((await handleRespondPost(request("respond", bob, "alice", { sessionId: created.sessionId, response: { itemId: created.item.id, text: "Stale answer" } }))).status).toBe(403);
  expect((await handleScorePost(request("score", bob, "alice", { sessionId: created.sessionId, itemId: created.item.id, text: "Stale answer" }))).status).toBe(403);
  expect(db.getSession(created.sessionId)).toEqual(before);
  for (const handler of [handleResultGet, handleResultDelete]) {
    expect((await handler(request("result?sessionId=bob-report", bob, "alice"))).status).toBe(403);
  }
  expect(db.getResult("bob-report")).not.toBeNull();
});

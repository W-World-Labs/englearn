import { afterAll, beforeAll, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getSsoConfig } from "@/lib/auth/config";
import type { TestResult } from "@/lib/types";

let directory: string;
let alice: string, bob: string, expired: string;
const request = (query: string, token = "") => new Request(`http://localhost${query}`, {
  headers: { cookie: `lingolearn_session=${token}` },
});

beforeAll(async () => {
  directory = fs.mkdtempSync(path.join(process.cwd(), "data/.test-history-"));
  vi.stubEnv("ENGLEARN_DATA_DIR", directory);
  vi.stubEnv("W_ID_CLIENT_ID", "assessment-test");
  vi.stubEnv("W_ID_CLIENT_SECRET", "test-only-client-secret");
  vi.stubEnv("JWT_SECRET", "test-only-jwt-secret-at-least-thirty-two-characters");
  vi.stubEnv("W_ID_REDIRECT_URI", "http://localhost/api/auth/callback");
  const config = getSsoConfig()!;
  const exp = Math.floor(Date.now() / 1000) + 3600;
  alice = await config.signSessionClaims({ sub: "alice", exp });
  bob = await config.signSessionClaims({ sub: "bob", is_admin: true, exp });
  expired = await config.signSessionClaims({ sub: "alice", exp: 1 });
  const { saveResult } = await import("@/lib/db");
  for (const [sessionId, userId] of [["alice-report", "alice"], ["bob-report", "bob"], ["guest-report", undefined]]) {
    saveResult({ sessionId, userId, completedAt: "2026-09-22T00:00:00Z", overallCEFR: "B1", modules: [] } as TestResult);
  }
});
afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

it("never lists guest capability IDs, including for malformed or expired credentials", async () => {
  const { handleHistoryGet } = await import("./history");
  for (const token of ["", "forged", expired, "%E0%A4%A"]) {
    for (const query of ["?all=1", "?page=1&pageSize=50"]) {
      const response = await handleHistoryGet(request(`/api/history${query}`, token));
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      const body = await response.json();
      expect(Array.isArray(body) ? body : body.items).toEqual([]);
    }
  }
});

it("isolates account history even for admins or a supplied owner query", async () => {
  const { handleHistoryGet } = await import("./history");
  for (const [token, id] of [[alice, "alice-report"], [bob, "bob-report"]]) {
    const rows = await (await handleHistoryGet(request("/api/history?all=1&userId=alice", token))).json();
    expect(rows.map((row: TestResult) => row.sessionId)).toEqual([id]);
  }
});

it("preserves guest saved-link access and rejects access to another account's report", async () => {
  const { handleResultGet, handleResultDelete } = await import("./result");
  const guest = await handleResultGet(request("/api/result?sessionId=guest-report"));
  expect(guest.status).toBe(200);
  expect(guest.headers.get("cache-control")).toBe("private, no-store");
  for (const handler of [handleResultGet, handleResultDelete]) {
    expect((await handler(request("/api/result?sessionId=alice-report", bob))).status).toBe(403);
    expect((await handler(request("/api/result?sessionId=alice-report"))).status).toBe(403);
  }
  expect((await handleResultGet(request("/api/result?sessionId=alice-report", alice))).status).toBe(200);
});

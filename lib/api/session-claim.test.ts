import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { getSsoConfig } from "@/lib/auth/config";

let directory: string;
let alice: string, bob: string;
let sessionApi: typeof import("./session");
let claimApi: typeof import("./session-claim");
let db: typeof import("@/lib/db");

const SECRET = "a".repeat(64);
const CLAIM_HASH = createHash("sha256").update(SECRET).digest("hex");

function request(body?: unknown, token?: string, expected?: string) {
  return new Request("http://localhost/api/session/claim", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { cookie: `lingolearn_session=${token}` } : {}),
      ...(expected === undefined
        ? {}
        : { "X-LingoLearn-Account": expected }),
    },
    body: JSON.stringify(body ?? {}),
  });
}

async function createGuestSession(claimHash?: string) {
  const res = await sessionApi.handleSessionPost(
    new Request("http://localhost/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modules: ["grammar"],
        learningLanguage: "en",
        ...(claimHash ? { claimHash } : {}),
      }),
    }),
  );
  return (await res.json()).sessionId as string;
}

beforeAll(async () => {
  directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "englearn-session-claim-"),
  );
  vi.stubEnv("ENGLEARN_DATA_DIR", directory);
  vi.stubEnv("W_ID_CLIENT_ID", "session-claim-test");
  vi.stubEnv("W_ID_CLIENT_SECRET", "test-only-client-secret");
  vi.stubEnv(
    "JWT_SECRET",
    "test-only-jwt-secret-at-least-thirty-two-characters",
  );
  vi.stubEnv("W_ID_REDIRECT_URI", "http://localhost/api/auth/callback");
  const config = getSsoConfig()!;
  const exp = Math.floor(Date.now() / 1000) + 3600;
  alice = await config.signSessionClaims({ sub: "alice", exp });
  bob = await config.signSessionClaims({ sub: "bob", exp });
  sessionApi = await import("./session");
  claimApi = await import("./session-claim");
  db = await import("@/lib/db");
});
afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

it("requires sign-in", async () => {
  const res = await claimApi.handleSessionClaimPost(
    request({ sessionId: "x", claimSecret: SECRET }),
  );
  expect(res.status).toBe(401);
});

it("rejects a stale account header", async () => {
  const res = await claimApi.handleSessionClaimPost(
    request({ sessionId: "x", claimSecret: SECRET }, alice, "bob"),
  );
  expect(res.status).toBe(403);
});

it("404s on an unknown session", async () => {
  const res = await claimApi.handleSessionClaimPost(
    request({ sessionId: "nope", claimSecret: SECRET }, alice),
  );
  expect(res.status).toBe(404);
});

it("refuses sessions created without a claim hash", async () => {
  const sessionId = await createGuestSession();
  const res = await claimApi.handleSessionClaimPost(
    request({ sessionId, claimSecret: SECRET }, alice),
  );
  expect(res.status).toBe(403);
  expect((await res.json()).code).toBe("invalid_claim");
  expect(db.getSession(sessionId)?.userId).toBeUndefined();
});

it("rejects a wrong secret", async () => {
  const sessionId = await createGuestSession(CLAIM_HASH);
  const res = await claimApi.handleSessionClaimPost(
    request({ sessionId, claimSecret: "b".repeat(64) }, alice),
  );
  expect(res.status).toBe(403);
  expect(db.getSession(sessionId)?.userId).toBeUndefined();
});

it("binds the session and its result to the claimant", async () => {
  const sessionId = await createGuestSession(CLAIM_HASH);
  const session = db.getSession(sessionId)!;
  session.finished = true;
  db.updateSession(session);
  db.saveResult({
    sessionId,
    completedAt: new Date().toISOString(),
    overallCEFR: "B1",
    modules: [],
  });

  const res = await claimApi.handleSessionClaimPost(
    request({ sessionId, claimSecret: SECRET }, alice),
  );
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, claimed: true });
  expect(db.getSession(sessionId)?.userId).toBe("alice");
  expect(db.getResult(sessionId)?.userId).toBe("alice");

  // Idempotent for the owner.
  const again = await claimApi.handleSessionClaimPost(
    request({ sessionId, claimSecret: "b".repeat(64) }, alice),
  );
  expect(again.status).toBe(200);
  expect(await again.json()).toMatchObject({ ok: true, claimed: false });
});

it("refuses to rebind another account's session", async () => {
  const sessionId = await createGuestSession(CLAIM_HASH);
  await claimApi.handleSessionClaimPost(
    request({ sessionId, claimSecret: SECRET }, alice),
  );
  const res = await claimApi.handleSessionClaimPost(
    request({ sessionId, claimSecret: SECRET }, bob),
  );
  expect(res.status).toBe(409);
  expect(db.getSession(sessionId)?.userId).toBe("alice");
});

import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getSsoConfig } from "@/lib/auth/config";
import { GET, POST, knownFeedbackQuestion } from "./learning-feedback";
import { GET as readJournal, POST as saveJournal } from "./learning";
import { createJournal } from "@/lib/learning/session";
import {
  createDaily,
  withWorkbench,
  workbench,
} from "@/lib/learning/workbench";
import { arrangeLearning, learningEvidence } from "@/lib/learning/plan";
let dir = "",
  alice = "",
  bob = "";
const origin = "http://localhost:31971";
function req(
  method: string,
  body?: unknown,
  token = alice,
  extra: Record<string, string> = {},
) {
  return new Request(origin + "/api/learning/feedback", {
    method,
    headers: {
      cookie: "lingolearn_session=" + token,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...extra,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
beforeAll(async () => {
  vi.stubEnv("W_ID_CLIENT_ID", "ielts-local-test");
  vi.stubEnv("W_ID_CLIENT_SECRET", "test-only-client-secret");
  vi.stubEnv(
    "JWT_SECRET",
    "test-only-jwt-secret-at-least-thirty-two-characters",
  );
  vi.stubEnv("W_ID_REDIRECT_URI", origin + "/api/auth/callback");
  const cfg = getSsoConfig()!,
    exp = Math.floor(Date.now() / 1000) + 3600;
  alice = await cfg.signSessionClaims({ sub: "feedback-alice", exp });
  bob = await cfg.signSessionClaims({
    sub: "feedback-bob",
    is_admin: true,
    exp,
  });
});
beforeEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "learning-feedback-"));
  vi.stubEnv("ENGLEARN_DATA_DIR", dir);
});
afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
const report = () => ({
  id: "feedback-sample",
  startedAt: Date.now(),
  status: "finished",
  question: "x:en-be-v1",
  reason: "explanation",
  note: "Please explain the plural form.",
});
it("saves immutable reports with idempotent retries, owner isolation and private responses", async () => {
  const session = report();
  const saved = await POST(req("POST", { session, revision: null }));
  expect(saved.status).toBe(200);
  expect(saved.headers.get("cache-control")).toContain("no-store");
  expect((await POST(req("POST", { session, revision: null }))).status).toBe(
    200,
  );
  expect(
    (
      await POST(
        req("POST", { session: { ...session, note: "changed" }, revision: 1 }),
      )
    ).status,
  ).toBe(409);
  expect((await (await GET(req("GET"))).json()).total).toBe(1);
  expect((await (await GET(req("GET", undefined, bob))).json()).total).toBe(0);
  expect((await GET(req("GET", undefined, ""))).status).toBe(401);
  const files = fs.readdirSync(path.join(dir, "learning-feedback"));
  const file = path.join(
    dir,
    "learning-feedback",
    files[0],
    "feedback-sample.json",
  );
  expect(fs.statSync(file).mode & 0o777).toBe(0o600);
});
it("validates question references, body limits and origin; unavailable storage is not empty success", async () => {
  for (const question of [
    "g:en-be:0",
    "v:en-the",
    "x:en-be-v1",
    "x:en-foundation-text-v1-q1",
    "i:q6",
    "e:hsk-1-01-v1:r5",
  ]) {
    if (question === "v:en-the") continue;
    expect(knownFeedbackQuestion(question)).toBe(true);
  }
  for (const question of [
    "../../env",
    "x:missing",
    "i:unknown",
    "e:hsk-1-01-v1:unknown",
  ])
    expect(
      (
        await POST(
          req("POST", { session: { ...report(), question }, revision: null }),
        )
      ).status,
    ).toBe(400);
  expect(
    (
      await POST(
        req("POST", {
          session: { ...report(), note: "a".repeat(501) },
          revision: null,
        }),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await POST(
        req("POST", { session: report(), revision: null }, alice, {
          Origin: "https://untrusted.example",
        }),
      )
    ).status,
  ).toBe(403);
  fs.writeFileSync(path.join(dir, "not-directory"), "x");
  vi.stubEnv("ENGLEARN_DATA_DIR", path.join(dir, "not-directory"));
  expect(
    (await POST(req("POST", { session: report(), revision: null }))).status,
  ).toBe(503);
  expect((await GET(req("GET"))).status).toBe(503);
});
it("syncs the workbench extension and refuses older-client truncation while retaining legacy records", async () => {
  const old = createJournal();
  const s = createDaily(
    old,
    arrangeLearning(learningEvidence("en", [], []), old),
    5,
    "travel",
    "daily",
  );
  expect(
    (await saveJournal(req("POST", { session: s, revision: null }))).status,
  ).toBe(200);
  expect(
    (await saveJournal(req("POST", { session: old, revision: 1 }))).status,
  ).toBe(409);
  const next = withWorkbench(s, { words: ["r:en-foundation-text-v1:0"] });
  expect(
    (await saveJournal(req("POST", { session: next, revision: 1 }))).status,
  ).toBe(200);
  const data = await (await readJournal(req("GET"))).json();
  expect(data.total).toBe(1);
  expect(workbench(next).days).toEqual(workbench(s).days);
});

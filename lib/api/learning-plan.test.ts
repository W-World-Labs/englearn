import { beforeAll, afterAll, beforeEach, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { getSsoConfig } from "@/lib/auth/config";
import { createJournal } from "@/lib/learning/session";
import {
  createVocabulary,
  answerVocabulary,
  advanceVocabulary,
} from "@/lib/vocabulary/session";
let directory = "",
  alice = "",
  bob = "",
  expired = "";
let GET: typeof import("./learning-plan").GET;
let saveResult: typeof import("@/lib/db").saveResult;
let learningStore: typeof import("./learning").learningStore;
let vocabularyStore: typeof import("./vocabulary").vocabularyStore;
const origin = "http://localhost:31971";
const req = (query = "language=en", token = alice) =>
  new Request(origin + "/api/learning/plan?" + query, {
    headers: { cookie: "lingolearn_session=" + token },
  });
beforeAll(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "englearn-plan-api-"));
  vi.stubEnv("ENGLEARN_DATA_DIR", directory);
  vi.stubEnv("W_ID_CLIENT_ID", "ielts-local-test");
  vi.stubEnv("W_ID_CLIENT_SECRET", "test-only-client-secret");
  vi.stubEnv(
    "JWT_SECRET",
    "test-only-jwt-secret-at-least-thirty-two-characters",
  );
  vi.stubEnv("W_ID_REDIRECT_URI", origin + "/api/auth/callback");
  const cfg = getSsoConfig()!,
    exp = Math.floor(Date.now() / 1000) + 3600;
  alice = await cfg.signSessionClaims({ sub: "plan-alice", exp });
  bob = await cfg.signSessionClaims({ sub: "plan-bob", is_admin: true, exp });
  expired = await cfg.signSessionClaims({ sub: "plan-alice", exp: 1 });
  vi.resetModules();
  ({ GET } = await import("./learning-plan"));
  ({ saveResult } = await import("@/lib/db"));
  ({ learningStore } = await import("./learning"));
  ({ vocabularyStore } = await import("./vocabulary"));
});
beforeEach(() => {
  for (const f of fs.readdirSync(directory))
    fs.rmSync(path.join(directory, f), { recursive: true, force: true });
});
afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
it("requires a valid session and supported language, ignoring supplied owner/admin authority", async () => {
  for (const token of ["", expired, alice + "bad"])
    expect((await GET(req("language=en", token))).status).toBe(401);
  for (const query of ["", "language=fr", "language=../../en"])
    expect((await GET(req(query))).status).toBe(400);
  const now = Date.now();
  saveResult({
    sessionId: "grammar-result",
    userId: "plan-alice",
    learningLanguage: "en",
    completedAt: new Date(now).toISOString(),
    overallCEFR: "C2",
    modules: [
      {
        module: "grammar",
        cefr: "B2",
        theta: 1,
        se: 0.4,
        itemsAdministered: 8,
      },
    ],
  });
  const a = await GET(req());
  expect(a.headers.get("cache-control")).toContain("no-store");
  expect(a.headers.get("vary")).toBe("Cookie");
  const body = await a.json();
  expect(body.plan.stage).toBe("intermediate");
  expect(body.evidence.grammar.items).toBe(8);
  expect(JSON.stringify(body)).not.toContain("plan-alice");
  const b = await (await GET(req("language=en&userId=plan-alice", bob))).json();
  expect(b.plan.basis).toBe("starter");
  expect(b.evidence.grammar).toBeNull();
  expect(
    (await (await GET(req("language=ja"))).json()).evidence.grammar,
  ).toBeNull();
});
it("derives repeatable plans from owned persisted units and vocabulary with no read-time writes", async () => {
  const now = Date.now();
  const s = createJournal(now - 10000);
  s.draft = { lessonId: "en-be", startedAt: now - 1000, answers: [0] };
  learningStore.save("plan-alice", s, null);
  let v = createVocabulary("en", "en", "quick", now - 10000, "vocabulary");
  while (v.status === "running")
    v = advanceVocabulary(answerVocabulary(v, "unknown"), now - 1000);
  vocabularyStore.save("plan-alice", v, null);
  const walk = (p: string): Record<string, string> =>
    Object.fromEntries(
      fs.readdirSync(p).flatMap((f) => {
        const full = path.join(p, f);
        return fs.statSync(full).isDirectory()
          ? Object.entries(walk(full))
          : [[full, fs.readFileSync(full, "utf8")]];
      }),
    );
  const before = walk(directory);
  const a = await (await GET(req())).json(),
    b = await (await GET(req())).json();
  expect(a.plan).toEqual(b.plan);
  expect(a.plan.lessons[0]).toEqual({ id: "en-be", reason: "resume" });
  expect(a.plan.wordIds.length).toBeGreaterThan(0);
  expect(walk(directory)).toEqual(before);
  expect(
    (await (await GET(req("language=en", bob))).json()).plan.wordIds,
  ).toHaveLength(0);
});
it("reports corrupt evidence as unavailable rather than silently treating the account as a beginner", async () => {
  fs.writeFileSync(path.join(directory, "results.json"), "{broken");
  expect((await GET(req())).status).toBe(503);
  fs.unlinkSync(path.join(directory, "results.json"));
  const dir = path.join(
    directory,
    "learning-journals",
    createHash("sha256").update("plan-alice").digest("hex"),
  );
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "grammar-v1.json"), "{broken");
  expect((await GET(req())).status).toBe(503);
  expect((await GET(req("language=en", bob))).status).toBe(200);
});

it("rejects a stale tab's expected account before disclosing learning evidence", async () => {
  const changed = req("language=en", bob);
  changed.headers.set("X-LingoLearn-Account", "plan-alice");
  const response = await GET(changed);
  expect(response.status).toBe(403);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).not.toHaveProperty("evidence");

  const matched = req("language=en", bob);
  matched.headers.set("X-LingoLearn-Account", "plan-bob");
  expect((await GET(matched)).status).toBe(200);
});

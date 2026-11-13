import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getSsoConfig } from "@/lib/auth/config";
import type { ClientResponse, ModuleType } from "@/lib/types";

let directory: string, token: string;
let sessionApi: typeof import("./session");
let respond: typeof import("./respond").handleRespondPost;
let score: typeof import("./score").handleScorePost;
let db: typeof import("@/lib/db");
let items: typeof import("@/lib/items");
const request = (endpoint: string, body: unknown) => new Request(`http://localhost/api/${endpoint}`, {
  method: "POST", headers: { "Content-Type": "application/json", cookie: `lingolearn_session=${token}` },
  body: JSON.stringify(body),
});
async function start(module: ModuleType = "grammar") {
  return (await sessionApi.handleSessionPost(request("session", { modules: [module], learningLanguage: "en" }))).json();
}
function answer(sessionId: string, response: ClientResponse) {
  return respond(request("respond", { sessionId, response }));
}
const result = () => Response.json({ choices: [{ message: { content: '{"score":1,"feedback":"Clear and accurate."}' } }] });

beforeAll(async () => {
  directory = fs.mkdtempSync(path.join(process.cwd(), "data/.test-mutations-"));
  vi.stubEnv("ENGLEARN_DATA_DIR", directory);
  vi.stubEnv("W_ID_CLIENT_ID", "assessment-test");
  vi.stubEnv("W_ID_CLIENT_SECRET", "test-only-client-secret");
  vi.stubEnv("JWT_SECRET", "test-only-jwt-secret-at-least-thirty-two-characters");
  vi.stubEnv("W_ID_REDIRECT_URI", "http://localhost/api/auth/callback");
  vi.stubEnv("LLM_PROVIDER", "openai");
  vi.stubEnv("OPENAI_BASE_URL", "http://scorer.invalid/v1");
  token = await getSsoConfig()!.signSessionClaims({ sub: "learner", exp: Math.floor(Date.now() / 1000) + 3600 });
  sessionApi = await import("./session");
  respond = (await import("./respond")).handleRespondPost;
  score = (await import("./score")).handleScorePost;
  db = await import("@/lib/db");
  items = await import("@/lib/items");
});
afterEach(() => vi.unstubAllGlobals());
afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

it("rejects malformed mutation bodies without throwing or calling the scorer", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  for (const body of [null, [], 1, "text", {}, { sessionId: 123, response: {} }]) {
    expect((await respond(request("respond", body))).status).toBe(400);
    expect((await score(request("score", body))).status).toBe(400);
  }
  expect(fetch).not.toHaveBeenCalled();
});

it("rejects unissued, cross-module and cross-language items without mutating the session", async () => {
  const s = await start();
  const before = db.getSession(s.sessionId);
  const otherGrammar = items.getItemsByModule("grammar", "en").find(i => i.id !== s.item.id)!;
  for (const id of [otherGrammar.id, items.getItemsByModule("writing", "en")[0].id, items.getItemsByModule("grammar", "ja")[0].id]) {
    expect((await answer(s.sessionId, { itemId: id, selectedIndex: 0, text: "Answer" })).status).toBe(409);
    expect(db.getSession(s.sessionId)).toEqual(before);
  }
});

it("validates answer shapes against the pending question", async () => {
  const s = await start();
  for (const selectedIndex of [-1, 999, 0.5, "0", null]) {
    expect((await answer(s.sessionId, { itemId: s.item.id, selectedIndex } as ClientResponse)).status).toBe(400);
  }
  const vocab = await start("vocabulary");
  expect((await answer(vocab.sessionId, { itemId: vocab.item.id })).status).toBe(400);
  expect(db.getSession(s.sessionId)?.responses).toEqual([]);
  expect(db.getSession(vocab.sessionId)?.responses).toEqual([]);
});

it("accepts only one of two overlapping submissions and preserves the next pending item", async () => {
  const s = await start();
  const body = { itemId: s.item.id, selectedIndex: 0 };
  const responses = await Promise.all([answer(s.sessionId, body), answer(s.sessionId, body)]);
  expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
  const stored = db.getSession(s.sessionId)!;
  expect(stored.responses).toHaveLength(1);
  expect(stored.administeredItemIds).toHaveLength(2);
  expect((await answer(s.sessionId, body)).status).toBe(409);
  expect(db.getSession(s.sessionId)).toEqual(stored);
});

it("scores only the pending open question", async () => {
  const s = await start();
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  for (const body of [{ text: "Unbound answer" }, { sessionId: s.sessionId, itemId: s.item.id, text: "Wrong format" }, { sessionId: s.sessionId, itemId: items.getItemsByModule("writing")[0].id, text: "Unissued" }]) {
    expect([400, 409]).toContain((await score(request("score", body))).status);
  }
  expect(fetch).not.toHaveBeenCalled();
  expect(db.getSession(s.sessionId)?.responses).toEqual([]);
});

it("keeps scored-but-unsubmitted answers resumable and counts only committed responses", async () => {
  const s = await start("writing");
  const fetch = vi.fn(async () => result()); vi.stubGlobal("fetch", fetch);
  const body = { sessionId: s.sessionId, itemId: s.item.id, text: "My answer." };
  expect((await score(request("score", body))).status).toBe(200);
  expect((await score(request("score", body))).status).toBe(200);
  expect(fetch).toHaveBeenCalledTimes(1);
  const resumed = await (await sessionApi.handleSessionGet(new Request(`http://localhost/api/session?sessionId=${s.sessionId}`, { headers: { cookie: `lingolearn_session=${token}` } }))).json();
  expect(resumed.item.id).toBe(s.item.id);
  expect(resumed.moduleCounts.writing).toBe(0);
  expect(db.getSession(s.sessionId)?.responses).toEqual([]);
  expect((await answer(s.sessionId, { itemId: s.item.id, text: "My answer." })).status).toBe(200);
  expect(db.getSession(s.sessionId)?.responses[0]).toMatchObject({ score: 1, aiFeedback: "Clear and accurate." });
  expect(db.getSession(s.sessionId)).not.toHaveProperty("pendingScore");
});

it("never applies a previous score to edited answer text", async () => {
  const s = await start("writing");
  vi.stubGlobal("fetch", vi.fn(async () => result()));
  await score(request("score", { sessionId: s.sessionId, itemId: s.item.id, text: "A good answer." }));
  await answer(s.sessionId, { itemId: s.item.id, text: "" });
  expect(db.getSession(s.sessionId)?.responses[0]).toMatchObject({ score: 0, correct: false });
  expect(db.getSession(s.sessionId)?.responses[0].aiFeedback).toBeUndefined();
});

it("discards a late score after submission, instead of rewriting committed answers", async () => {
  const s = await start("writing");
  let resolve!: (response: Response) => void;
  let started!: () => void;
  const called = new Promise<void>(r => { started = r; });
  vi.stubGlobal("fetch", vi.fn(() => { started(); return new Promise<Response>(r => { resolve = r; }); }));
  const pending = score(request("score", { sessionId: s.sessionId, itemId: s.item.id, text: "Late answer" }));
  await called;
  expect((await answer(s.sessionId, { itemId: s.item.id, text: "Submitted answer" })).status).toBe(200);
  const before = db.getSession(s.sessionId);
  resolve(result());
  expect((await pending).status).toBe(409);
  expect(db.getSession(s.sessionId)).toEqual(before);
});

it("cannot resurrect a deleted session when a scorer returns", async () => {
  const s = await start("writing");
  vi.stubGlobal("fetch", vi.fn(async () => { db.deleteSession(s.sessionId); return result(); }));
  expect((await score(request("score", { sessionId: s.sessionId, itemId: s.item.id, text: "Answer" }))).status).toBe(404);
  expect(db.getSession(s.sessionId)).toBeNull();
});

it("keeps completed answers immutable without calling the scorer", async () => {
  const s = await start("writing");
  const stored = db.getSession(s.sessionId)!;
  stored.finished = true;
  db.updateSession(stored);
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  expect((await score(request("score", { sessionId: s.sessionId, itemId: s.item.id, text: "Overwrite" }))).status).toBe(409);
  expect(fetch).not.toHaveBeenCalled();
  expect(db.getSession(s.sessionId)).toEqual(stored);
});

it("resumes and commits legacy score placeholders without counting them twice", async () => {
  const s = await start("writing");
  const stored = db.getSession(s.sessionId)!;
  stored.responses.push({ itemId: s.item.id, module: "writing", text: "Legacy answer", score: 0.9, aiFeedback: "Legacy feedback" });
  db.updateSession(stored);
  const { getPendingItemId, moduleResponseCounts } = await import("@/lib/session-helpers");
  expect(getPendingItemId(stored)).toBe(s.item.id);
  expect(moduleResponseCounts(stored).writing).toBe(0);
  expect((await answer(s.sessionId, { itemId: s.item.id, text: "Legacy answer" })).status).toBe(200);
  expect(db.getSession(s.sessionId)?.responses).toHaveLength(1);
  expect(db.getSession(s.sessionId)?.responses[0].score).toBe(0.9);
});

it("finishes an open-response module with one committed grade per issued item", async () => {
  const s = await start("writing");
  vi.stubGlobal("fetch", vi.fn(async () => result()));
  let item = s.item;
  let done = false;
  let count = 0;
  while (!done && count < 35) {
    const text = `Answer ${count}`;
    expect((await score(request("score", { sessionId: s.sessionId, itemId: item.id, text }))).status).toBe(200);
    const response = await answer(s.sessionId, { itemId: item.id, text });
    expect(response.status).toBe(200);
    const payload = await response.json();
    item = payload.item;
    done = payload.done;
    count++;
  }
  expect(done).toBe(true);
  expect(db.getSession(s.sessionId)?.responses).toHaveLength(count);
  expect(db.getResult(s.sessionId)).toMatchObject({ totalItems: count, modules: [{ itemsAdministered: count, aiScore: 1 }] });
});

it.each([500, "{}", '{"score":null}', '{"score":"invalid"}', "not-json"])("keeps provider failure %j retryable without recording a zero grade", async (failure) => {
  const s = await start("writing");
  const fetch = vi.fn()
    .mockResolvedValueOnce(typeof failure === "number" ? new Response("unavailable", { status: failure }) : Response.json({ choices: [{ message: { content: failure } }] }))
    .mockResolvedValueOnce(result());
  vi.stubGlobal("fetch", fetch);
  const body = { sessionId: s.sessionId, itemId: s.item.id, text: "My answer" };
  expect((await score(request("score", body))).status).toBe(200);
  expect(db.getSession(s.sessionId)).not.toHaveProperty("pendingScore");
  expect(db.getSession(s.sessionId)?.responses).toEqual([]);
  expect((await (await score(request("score", body))).json()).score).toBe(1);
  expect(fetch).toHaveBeenCalledTimes(2);
});

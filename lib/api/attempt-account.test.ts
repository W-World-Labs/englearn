import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSsoConfig } from "@/lib/auth/config";
import { createJournal } from "@/lib/learning/session";
import { createVocabulary } from "@/lib/vocabulary/session";
import { createPractice } from "@/lib/exams/session";
import { createSession } from "@/lib/ielts/session";
import { GET as journalGet, POST as journalPost } from "./learning";
import { GET as feedbackGet, POST as feedbackPost } from "./learning-feedback";
import { GET as vocabularyGet, POST as vocabularyPost } from "./vocabulary";
import { handleIeltsGet, handleIeltsPost } from "./ielts";
import { examHandlers } from "./exams";

let directory = "", bob = "";
beforeAll(async () => {
  vi.stubEnv("W_ID_CLIENT_ID", "attempt-account-test");
  vi.stubEnv("W_ID_CLIENT_SECRET", "test-only-client-secret");
  vi.stubEnv("JWT_SECRET", "test-only-jwt-secret-at-least-thirty-two-characters");
  vi.stubEnv("W_ID_REDIRECT_URI", "http://localhost:3000/api/auth/callback");
  bob = await getSsoConfig()!.signSessionClaims({
    sub: "bob", is_admin: true, exp: Math.floor(Date.now() / 1000) + 3600,
  });
});
beforeEach(() => {
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "attempt-account-"));
  vi.stubEnv("ENGLEARN_DATA_DIR", directory);
});
afterAll(() => {
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

const cases = [
  { name: "learning journal", GET: journalGet, POST: journalPost, create: () => createJournal() },
  { name: "vocabulary", GET: vocabularyGet, POST: vocabularyPost, create: () => createVocabulary("en", "en", "quick", Date.now(), "vocabulary-account") },
  { name: "IELTS", GET: handleIeltsGet, POST: handleIeltsPost, create: () => createSession("reading", Date.now(), "ielts-account") },
  ...(["hsk", "topik", "jlpt"] as const).map((family) => ({
    name: family,
    ...examHandlers(family)!,
    create: () => createPractice(
      family === "hsk" ? "hsk-3-01-v1" : family === "topik" ? "topik-i-01-v1" : "jlpt-n5-01-v1",
      "all", Date.now(), family + "-account",
    ),
  })),
  {
    name: "question feedback", GET: feedbackGet, POST: feedbackPost,
    create: () => ({
      id: "feedback-account", startedAt: Date.now(), status: "finished",
      question: "x:en-be-v1", reason: "answer", note: "Check this answer.",
    }),
  },
];

function request(method: string, expected: string | null, body?: unknown, query = "") {
  return new Request("http://localhost:3000/api/attempts" + query, {
    method,
    headers: {
      cookie: "lingolearn_session=" + bob,
      "Content-Type": "application/json",
      ...(expected === null ? {} : { "X-LingoLearn-Account": expected }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

it.each(cases)("binds $name reads and writes to the tab's verified account", async ({ GET, POST, create }) => {
  const session = create();
  const payload = { session, revision: null };
  const rejected = await POST(request("POST", "alice", payload));
  expect(rejected.status).toBe(403);
  expect(rejected.headers.get("cache-control")).toContain("no-store");
  expect((await (await GET(request("GET", "bob"))).json()).total).toBe(0);

  expect((await POST(request("POST", "bob", payload))).status).toBe(200);
  for (const query of ["", "?id=" + session.id, "?draftId=" + session.id]) {
    const response = await GET(request("GET", "alice", undefined, query));
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).not.toHaveProperty("attempt");
  }
  expect((await GET(request("GET", "bob", undefined, "?id=" + session.id))).status).toBe(200);
  expect((await GET(request("GET", null, undefined, "?id=" + session.id))).status).toBe(200);
  expect((await POST(request("POST", "", payload))).status).toBe(403);
  expect((await (await GET(request("GET", "bob"))).json()).total).toBe(1);
});

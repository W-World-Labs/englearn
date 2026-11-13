import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { getSsoConfig } from "@/lib/auth/config";
import {
  createVocabulary,
  answerVocabulary,
  advanceVocabulary,
} from "@/lib/vocabulary/session";
import { GET, POST } from "./vocabulary";
import { vocabularyWord } from "@/lib/vocabulary/bank";
let directory = "",
  alice = "",
  bob = "",
  expired = "";
const origin = "http://localhost:31971";
function request(
  method: string,
  body?: unknown,
  token = alice,
  query = "",
  headers: Record<string, string> = {},
) {
  return new Request(`${origin}/api/vocabulary/attempts${query}`, {
    method,
    headers: {
      cookie: `lingolearn_session=${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeAll(async () => {
  vi.stubEnv("W_ID_CLIENT_ID", "ielts-local-test");
  vi.stubEnv("W_ID_CLIENT_SECRET", "test-only-client-secret");
  vi.stubEnv(
    "JWT_SECRET",
    "test-only-jwt-secret-at-least-thirty-two-characters",
  );
  vi.stubEnv("W_ID_REDIRECT_URI", `${origin}/api/auth/callback`);
  const config = getSsoConfig()!,
    exp = Math.floor(Date.now() / 1000) + 3600;
  alice = await config.signSessionClaims({ sub: "alice", login: "alice", exp });
  bob = await config.signSessionClaims({ sub: "bob", is_admin: true, exp });
  expired = await config.signSessionClaims({ sub: "alice", exp: 1 });
});
beforeEach(() => {
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
  directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "englearn-vocabulary-api-"),
  );
  vi.stubEnv("ENGLEARN_DATA_DIR", directory);
});
afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

const session = () => {
  const s = createVocabulary(
    "ja",
    "zh",
    "quick",
    Date.now(),
    "vocabulary-record",
  );
  s.adaptive!.version = 1;
  return s;
};
it("authenticates the vocabulary endpoint and enforces account ownership on disk", async () => {
  for (const token of ["", expired, alice + "forged"])
    expect((await GET(request("GET", undefined, token))).status).toBe(401);
  const s = session();
  s.answers[s.questions[0].id] = "unknown";
  const saved = await POST(
    request("POST", {
      session: s,
      revision: null,
      userId: "bob",
      score: 99999,
    }),
  );
  expect(saved.status).toBe(200);
  const file = path.join(
    directory,
    "vocabulary-attempts",
    createHash("sha256").update("alice").digest("hex"),
    s.id + ".json",
  );
  expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  expect(JSON.parse(fs.readFileSync(file, "utf8")).session).toEqual(s);
  expect(
    (await GET(request("GET", undefined, bob, "?id=" + s.id))).status,
  ).toBe(404);
  expect((await (await GET(request("GET", undefined, bob))).json()).total).toBe(
    0,
  );
  expect((await GET(request("GET"))).headers.get("cache-control")).toContain(
    "no-store",
  );
});
it("keeps test configuration immutable and uses revisions for conflicts and idempotent retries", async () => {
  const s = session();
  await POST(request("POST", { session: s, revision: null }));
  const changed = { ...s, answers: { [s.questions[0].id]: "unknown" } };
  expect(
    (await POST(request("POST", { session: changed, revision: null }))).status,
  ).toBe(409);
  expect(
    (await POST(request("POST", { session: changed, revision: 1 }))).status,
  ).toBe(200);
  const retry = await POST(request("POST", { session: changed, revision: 1 }));
  expect((await retry.json()).attempt.revision).toBe(2);
  expect(
    (
      await POST(
        request("POST", {
          session: { ...changed, meaningLanguage: "en" },
          revision: 2,
        }),
      )
    ).status,
  ).toBe(409);
});
it("rejects incomplete submission and prevents rewriting a finished result", async () => {
  const s = session();
  await POST(request("POST", { session: s, revision: null }));
  let complete = { ...s, status: "finished" as const, completedAt: Date.now() };
  expect(
    (await POST(request("POST", { session: complete, revision: 1 }))).status,
  ).toBe(400);
  let running = s;
  while (running.status === "running")
    running = advanceVocabulary(
      answerVocabulary(running, running.questions[running.index].id),
      Date.now(),
    );
  complete = {
    ...running,
    status: "finished",
    completedAt: running.completedAt!,
  };
  expect(
    (await POST(request("POST", { session: complete, revision: 1 }))).status,
  ).toBe(200);
  const modified = {
    ...complete,
    answers: {
      ...complete.answers,
      [complete.questions.at(-1)!.id]: "unknown",
    },
  };
  expect(
    (await POST(request("POST", { session: modified, revision: 2 }))).status,
  ).toBe(409);
});
it("rejects cross-origin writes and malformed records while keeping the endpoint additive", async () => {
  expect(
    (
      await POST(
        request("POST", { session: session(), revision: null }, alice, "", {
          Origin: "https://another.example",
        }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await POST(
        request("POST", {
          session: { ...session(), language: "ar" },
          revision: null,
        }),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await POST(
        request("POST", {
          session: { ...session(), startedAt: Date.now() + 60000 },
          revision: null,
        }),
      )
    ).status,
  ).toBe(400);
});

it("accepts batched offline progression and rejects pool changes, rewinds and committed answer edits", async () => {
  const initial = session();
  await POST(request("POST", { session: initial, revision: null }));
  const next = advanceVocabulary(
    answerVocabulary(initial, "unknown"),
    Date.now(),
  );
  const further = advanceVocabulary(
    answerVocabulary(next, "unknown"),
    Date.now(),
  );
  expect(
    (await POST(request("POST", { session: further, revision: 1 }))).status,
  ).toBe(200);
  expect(
    (await POST(request("POST", { session: further, revision: 1 }))).status,
  ).toBe(200);
  const history = await (await GET(request("GET"))).json();
  expect(history.items[0]).toMatchObject({ answered: 2, total: 20 });
  expect(
    (await POST(request("POST", { session: next, revision: 2 }))).status,
  ).toBe(409);
  // Another wrong option leaves the adaptive path valid but cannot rewrite a locked answer.
  const changed = structuredClone(further);
  const q = changed.questions[0];
  changed.answers[q.id] = q.options.find((id) => id !== q.id)!;
  expect(
    (await POST(request("POST", { session: changed, revision: 2 }))).status,
  ).toBe(409);
  const repooled = structuredClone(further);
  const pool = repooled.adaptive!.pool;
  const unused = pool.filter(
    (q) => !further.questions.some((shown) => shown.id === q.id),
  );
  unused[0].options.reverse();
  expect(
    (await POST(request("POST", { session: repooled, revision: 2 }))).status,
  ).toBe(409);
});

it("continues legacy fixed-stratum account records without adding adaptive fields", async () => {
  const { adaptive, ...legacy } = session();
  const counts = [0, 0, 0, 0];
  legacy.questions = adaptive!.pool.filter(
    (q) => counts[vocabularyWord(q.id)!.band]++ < 5,
  );
  expect(
    (await POST(request("POST", { session: legacy, revision: null }))).status,
  ).toBe(200);
  let resumed = advanceVocabulary(
    answerVocabulary(legacy, "unknown"),
    Date.now(),
  );
  resumed = answerVocabulary({ ...resumed, index: 0 }, resumed.questions[0].id);
  const saved = await POST(request("POST", { session: resumed, revision: 1 }));
  expect(saved.status).toBe(200);
  const record = (await saved.json()).attempt;
  expect(record.session).toEqual(resumed);
  expect(record.session).not.toHaveProperty("adaptive");
  expect(
    (
      await (
        await GET(request("GET", undefined, alice, "?id=" + legacy.id))
      ).json()
    ).attempt,
  ).toEqual(record);
});

it("saves early dynamic completion, reports actual totals and rejects premature or continued submissions", async () => {
  const s = createVocabulary("en", "zh", "quick", Date.now(), "dynamic-record");
  expect(
    (await POST(request("POST", { session: s, revision: null }))).status,
  ).toBe(200);
  const early = {
    ...answerVocabulary(s, "unknown"),
    status: "finished",
    completedAt: Date.now(),
  };
  expect(
    (await POST(request("POST", { session: early, revision: 1 }))).status,
  ).toBe(400);
  let complete = s;
  while (complete.status === "running")
    complete = advanceVocabulary(
      answerVocabulary(complete, "unknown"),
      Date.now(),
    );
  expect(complete.questions.length).toBeGreaterThanOrEqual(12);
  expect(complete.questions.length).toBeLessThan(20);
  expect(
    (await POST(request("POST", { session: complete, revision: 1 }))).status,
  ).toBe(200);
  const history = await (await GET(request("GET"))).json();
  expect(history.items[0]).toMatchObject({
    answered: complete.questions.length,
    total: complete.questions.length,
    adaptiveVersion: 2,
    status: "finished",
  });
  expect(history.latest.session).toEqual(complete);
  expect(
    (await POST(request("POST", { session: complete, revision: 1 }))).status,
  ).toBe(200);
  const extra = complete.adaptive!.pool.find(
    (q) => !complete.questions.some((shown) => shown.id === q.id),
  )!;
  expect(
    (
      await POST(
        request("POST", {
          session: { ...complete, questions: [...complete.questions, extra] },
          revision: 2,
        }),
      )
    ).status,
  ).toBe(400);
});

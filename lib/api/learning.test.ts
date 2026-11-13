import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { getSsoConfig } from "@/lib/auth/config";
import { LESSONS } from "@/lib/learning/catalog";
import {
  answerLesson,
  createJournal,
  finishLesson,
  startLesson,
} from "@/lib/learning/session";
import { GET, POST } from "./learning";
import { startReview, rateReview, finishReview } from "@/lib/learning/review";
import {
  activityQuestion,
  answerActivity,
  finishActivity,
  startActivity,
  workbench,
} from "@/lib/learning/workbench";

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
  return new Request(`${origin}/api/learning/journal${query}`, {
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
  const cfg = getSsoConfig()!,
    exp = Math.floor(Date.now() / 1000) + 3600;
  alice = await cfg.signSessionClaims({ sub: "learning-alice", exp });
  bob = await cfg.signSessionClaims({
    sub: "learning-bob",
    is_admin: true,
    exp,
  });
  expired = await cfg.signSessionClaims({ sub: "learning-alice", exp: 1 });
});
beforeEach(() => {
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "englearn-learning-api-"));
  vi.stubEnv("ENGLEARN_DATA_DIR", directory);
});
afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
function completed() {
  let s = startLesson(createJournal(), LESSONS[0].id);
  for (const q of LESSONS[0].questions) s = answerLesson(s, q.answer);
  return finishLesson(s, "first-round");
}
it("isolates journals by verified W-ID subject, including platform admins", async () => {
  for (const token of ["", expired, alice + "invalid"]) {
    expect((await GET(request("GET", undefined, token))).status).toBe(401);
    expect(
      (
        await POST(
          request("POST", { session: completed(), revision: null }, token),
        )
      ).status,
    ).toBe(401);
  }
  const s = completed();
  expect(
    (
      await POST(
        request("POST", {
          session: { ...s, userId: "learning-bob", score: 1000 },
          revision: null,
        }),
      )
    ).status,
  ).toBe(200);
  const file = path.join(
    directory,
    "learning-journals",
    createHash("sha256").update("learning-alice").digest("hex"),
    s.id + ".json",
  );
  expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  expect(fs.statSync(path.dirname(file)).mode & 0o777).toBe(0o700);
  expect(JSON.parse(fs.readFileSync(file, "utf8")).session).toEqual(s);
  expect(
    (await GET(request("GET", undefined, bob, "?id=grammar-v1"))).status,
  ).toBe(404);
  expect((await (await GET(request("GET", undefined, bob))).json()).total).toBe(
    0,
  );
  const response = await GET(request("GET"));
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect((await response.json()).items[0]).toMatchObject({
    completedLessons: 1,
    revision: 1,
  });
});
it("preserves history across offline batches and handles stale writes idempotently", async () => {
  const s = completed();
  await POST(request("POST", { session: s, revision: null }));
  const changed = answerLesson(
    startLesson({ ...s, bookPage: 18 }, LESSONS[1].id),
    1,
  );
  expect(
    (await POST(request("POST", { session: changed, revision: null }))).status,
  ).toBe(409);
  const saved = await POST(request("POST", { session: changed, revision: 1 }));
  expect(saved.status).toBe(200);
  expect(
    (
      await (
        await POST(request("POST", { session: changed, revision: 1 }))
      ).json()
    ).attempt.revision,
  ).toBe(2);
  const history = await (
    await GET(request("GET", undefined, alice, "?draftId=grammar-v1"))
  ).json();
  expect(history.latest.session).toEqual(changed);
  expect(history.draft).toEqual(history.latest);
  const rewritten = structuredClone(changed);
  rewritten.events[0].answers[0] = 2;
  expect(
    (await POST(request("POST", { session: rewritten, revision: 2 }))).status,
  ).toBe(409);
  expect(
    (
      await POST(
        request("POST", { session: { ...changed, events: [] }, revision: 2 }),
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await (
        await GET(request("GET", undefined, alice, "?id=grammar-v1"))
      ).json()
    ).attempt,
  ).toEqual(history.latest);
});
it("rejects malformed/future records, cross-origin writes, oversized bodies and path injection", async () => {
  const s = completed();
  expect(
    (
      await POST(
        request("POST", { session: s, revision: null }, alice, "", {
          Origin: "https://other.example",
        }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await POST(
        request("POST", { session: s, revision: null }, alice, "", {
          "Content-Type": "text/plain",
        }),
      )
    ).status,
  ).toBe(415);
  for (const session of [
    { ...s, bookPage: 341 },
    {
      ...s,
      draft: { lessonId: "missing", startedAt: Date.now(), answers: [] },
    },
    { ...s, events: [{ ...s.events[0], at: Date.now() + 60000 }] },
  ])
    expect(
      (await POST(request("POST", { session, revision: null }))).status,
    ).toBe(400);
  expect(
    (
      await POST(
        request("POST", {
          session: s,
          revision: null,
          extra: "x".repeat(5000000),
        }),
      )
    ).status,
  ).toBe(413);
  expect(
    (await GET(request("GET", undefined, alice, "?id=../../other"))).status,
  ).toBe(404);
});
it("reports corrupt storage as unavailable rather than returning empty learning history", async () => {
  const folder = path.join(
    directory,
    "learning-journals",
    createHash("sha256").update("learning-alice").digest("hex"),
  );
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, "grammar-v1.json"), "{");
  expect((await GET(request("GET"))).status).toBe(503);
  expect(
    (await POST(request("POST", { session: completed(), revision: null })))
      .status,
  ).toBe(503);
});

it("keeps old journals readable while saving recall drafts and immutable completed history", async () => {
  const old = completed();
  await POST(request("POST", { session: old, revision: null }));
  const restored = (
    await (await GET(request("GET", undefined, alice, "?id=grammar-v1"))).json()
  ).attempt;
  expect(restored.session).toEqual(old);
  expect(restored.session).not.toHaveProperty("reviews");
  const cards = [`g:${LESSONS[0].id}:0`, `g:${LESSONS[0].id}:1`];
  const draft = rateReview(startReview(old, cards, "recall-one"), 0);
  expect(
    (await POST(request("POST", { session: draft, revision: 1 }))).status,
  ).toBe(200);
  const rewritten = structuredClone(draft);
  rewritten.reviewDraft!.ratings[0] = 2;
  expect(
    (await POST(request("POST", { session: rewritten, revision: 2 }))).status,
  ).toBe(409);
  const finished = finishReview(rateReview(draft, 2));
  expect(
    (await POST(request("POST", { session: finished, revision: 2 }))).status,
  ).toBe(200);
  expect(
    (await POST(request("POST", { session: old, revision: 3 }))).status,
  ).toBe(409);
  expect(
    (await POST(request("POST", { session: finished, revision: 2 }))).status,
  ).toBe(200);
  const saved = (
    await (await GET(request("GET", undefined, alice, "?id=grammar-v1"))).json()
  ).attempt;
  expect(saved.session).toEqual(finished);
  expect(saved.revision).toBe(3);
  expect(
    (await GET(request("GET", undefined, bob, "?id=grammar-v1"))).status,
  ).toBe(404);
});

it("accepts historical offline recall with no client owner or score authority", async () => {
  const s = completed(),
    at = s.startedAt - 1000;
  const round = {
    id: "offline-import",
    startedAt: at - 1000,
    at,
    cards: [`g:${LESSONS[0].id}:0`],
    ratings: [1],
  };
  const response = await POST(
    request("POST", {
      session: {
        ...s,
        reviews: [{ ...round, owner: "learning-bob", score: 100 }],
        reviewDraft: null,
      },
      revision: null,
    }),
  );
  expect(response.status).toBe(200);
  const saved = (await response.json()).attempt.session;
  expect(saved.reviews).toEqual([round]);
  expect(saved.events).toEqual(s.events);
  expect(saved.startedAt).toBe(s.startedAt);
});

it("rejects malformed recall, duplicate IDs and cross-language rounds without writing a journal", async () => {
  const s = completed(),
    time = Date.now();
  const round = {
    id: "recall",
    startedAt: time,
    at: time,
    cards: [`g:${LESSONS[0].id}:0`],
    ratings: [0],
  };
  for (const reviews of [
    [{ ...round, ratings: [9] }],
    [{ ...round, cards: ["v:unknown"] }],
    [round, round],
    [{ ...round, id: s.events[0].id }],
    [
      {
        ...round,
        cards: [
          ...round.cards,
          `g:${LESSONS.find((l) => l.language === "ja")!.id}:0`,
        ],
        ratings: [0, 2],
      },
    ],
  ])
    expect(
      (
        await POST(
          request("POST", { session: { ...s, reviews }, revision: null }),
        )
      ).status,
    ).toBe(400);
  expect(
    (await GET(request("GET", undefined, alice, "?id=grammar-v1"))).status,
  ).toBe(404);
});

it("preserves checked activity answers when a batch also starts the next draft", async () => {
  const now = Date.now();
  let saved = startActivity(
    createJournal(now - 10000),
    "practice",
    "en-be",
    "checked-activity",
    now - 9000,
  );
  const first = activityQuestion(workbench(saved).draft!.items[0])!;
  saved = answerActivity(saved, (first.answer + 1) % first.choices.length);
  expect(
    (await POST(request("POST", { session: saved, revision: null }))).status,
  ).toBe(200);
  const second = activityQuestion(workbench(saved).draft!.items[1])!;
  const finished = finishActivity(answerActivity(saved, second.answer), now - 8000);
  const next = startActivity(finished, "practice", "en-be", "next-activity", now - 7000);
  const changed = structuredClone(next);
  changed.workbench!.rounds[0].answers[0] = first.answer;

  expect(
    (await POST(request("POST", { session: changed, revision: 1 }))).status,
  ).toBe(409);
  const unchanged = await GET(request("GET", undefined, alice, "?id=grammar-v1"));
  expect((await unchanged.json()).attempt.session).toEqual(saved);
  expect(
    (await POST(request("POST", { session: next, revision: 1 }))).status,
  ).toBe(200);
});

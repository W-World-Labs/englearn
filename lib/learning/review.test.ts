import { expect, it } from "vitest";
import { LESSONS } from "./catalog";
import { STUDY_CARDS, studyCard } from "./cards";
import {
  createJournal,
  parseJournal,
  updateJournal,
  type StudyJournal,
} from "./session";
import {
  cardProgress,
  DAY,
  finishReview,
  mergeReviewImport,
  parseReviewImport,
  parseReview,
  planReview,
  rateReview,
  reviewCards,
  reviewCounts,
  seededReviewCards,
  startReview,
  type ReviewFilter,
  type ReviewRound,
} from "./review";
import { withWorkbench } from "./workbench";

const now = 1700000000000;
const first = STUDY_CARDS.find((c) => c.language === "en")!;
function complete(
  s: StudyJournal,
  id: string,
  at: number,
  rating: 0 | 1 | 2 = 2,
) {
  let next = startReview(s, [first.id], id, at);
  next = rateReview(next, rating);
  return finishReview(next, at);
}
it("turns actual lesson errors into a mixed-concept review queue without changing assessment history", () => {
  const s = createJournal(now);
  s.events = LESSONS.slice(0, 2).map((l, i) => ({
    id: `unit-${i}`,
    lessonId: l.id,
    at: now,
    answers: l.questions.map((q, j) => (j < 2 ? (q.answer + 1) % 3 : q.answer)),
  }));
  const weak = reviewCards(s, "en", "weak", now);
  expect(weak).toHaveLength(4);
  const plan = planReview(weak, 3);
  expect(new Set(plan).size).toBe(3);
  expect(studyCard(plan[0])!.lessonId).not.toBe(studyCard(plan[1])!.lessonId);
  expect(reviewCards(s, "ja", "weak", now)).toHaveLength(0);
  const next = finishReview(
    rateReview(startReview(s, [plan[0]], "recall", now), 2),
    now,
  );
  expect(next.events).toEqual(s.events);
  expect(reviewCards(next, "en", "weak", now)).toHaveLength(3);
});
it("keeps early successful recall from postponing review, and brings failed cards forward", () => {
  let s = complete(createJournal(now), "first", now);
  expect(cardProgress(s)[first.id].dueAt).toBe(now + DAY);
  s = complete(s, "early", now + 1);
  expect(cardProgress(s)[first.id]).toMatchObject({
    dueAt: now + DAY,
    repetition: 1,
  });
  s = complete(s, "due", now + DAY);
  expect(cardProgress(s)[first.id]).toMatchObject({
    dueAt: now + 7 * DAY,
    repetition: 2,
  });
  s = complete(s, "weak", now + 2 * DAY, 0);
  expect(cardProgress(s)[first.id]).toMatchObject({
    dueAt: now + 3 * DAY,
    repetition: 0,
    rating: 0,
  });
});
it("retains both course and recall drafts while resuming a checked rating", () => {
  const s = createJournal(now);
  s.draft = { lessonId: LESSONS[0].id, startedAt: now, answers: [0] };
  const next = rateReview(
    startReview(
      s,
      STUDY_CARDS.slice(0, 3).map((c) => c.id),
      "review",
      now,
    ),
    1,
  );
  expect(next.draft).toEqual(s.draft);
  expect(parseJournal(JSON.stringify(next))).toEqual(next);
  expect(finishReview(next, now)).toBe(next);
  const changed = structuredClone(next);
  changed.reviewDraft!.ratings[0] = 2;
  expect(updateJournal(next, changed)).toBeNull();
  const removed = structuredClone(complete(s, "complete", now));
  removed.reviews = [];
  expect(updateJournal(complete(s, "complete", now), removed)).toBeNull();
});
it("imports earlier offline events in chronological review order, deduplicates and explicitly restores drafts", () => {
  const earlier = complete(
      createJournal(now - 2 * DAY),
      "offline-old",
      now - 2 * DAY,
    ),
    newer = complete(createJournal(now), "online-new", now);
  const pending = rateReview(
    startReview(
      earlier,
      STUDY_CARDS.slice(0, 3).map((c) => c.id),
      "offline-draft",
      now,
    ),
    0,
  );
  const input = parseReviewImport(
    JSON.stringify({
      format: "lingolearn-review-results",
      version: 1,
      rounds: earlier.reviews,
      draft: pending.reviewDraft,
      owner: "ignored",
    }),
  )!;
  expect(input).not.toHaveProperty("owner");
  const imported = mergeReviewImport(newer, input, true)!;
  expect(imported.reviews).toHaveLength(2);
  expect(imported.reviewDraft).toEqual(pending.reviewDraft);
  expect(imported.startedAt).toBe(now);
  expect(parseJournal(JSON.stringify(imported))).toEqual(imported);
  expect(cardProgress(imported)[first.id].lastAt).toBe(now);
  expect(mergeReviewImport(imported, input, true)).toEqual(imported);
  const changed = structuredClone(input);
  changed.rounds[0].ratings = [0];
  expect(mergeReviewImport(imported, changed)).toBeNull();
  expect(mergeReviewImport(newer, input, false)!.reviewDraft).toBeNull();
});
it("rejects malformed, mixed-language, future, duplicate and excessive import data", () => {
  const good = complete(createJournal(now), "valid", now).reviews![0];
  const ja = STUDY_CARDS.find((c) => c.language === "ja")!.id;
  for (const bad of [
    { ...good, cards: [first.id, ja], ratings: [2, 2] },
    { ...good, cards: [first.id, first.id], ratings: [2, 2] },
    { ...good, ratings: [3] },
    { ...good, at: Date.now() + 60000 },
    { ...good, cards: ["<script>"] },
    { ...good, startedAt: -1 },
    { ...good, ratings: [] },
    { ...good, id: "../../escape" },
  ])
    expect(parseReview(bad, true)).toBeNull();
  expect(
    parseReviewImport(
      JSON.stringify({
        format: "lingolearn-review-results",
        version: 2,
        rounds: [good],
      }),
    ),
  ).toBeNull();
  expect(
    parseReviewImport(
      JSON.stringify({
        format: "lingolearn-review-results",
        version: 1,
        rounds: [good, good],
      }),
    ),
  ).toBeNull();
  const s = createJournal(now);
  s.events = [
    { id: "valid", lessonId: LESSONS[0].id, at: now, answers: [0, 0, 0, 0] },
  ];
  expect(
    mergeReviewImport(s, {
      format: "lingolearn-review-results",
      version: 1,
      rounds: [good],
    }),
  ).toBeNull();
});
it("preserves old journals byte-for-byte after parsing and rejects review history truncation by an older client", () => {
  const old = createJournal(now);
  expect(parseJournal(JSON.stringify(old))).toEqual(old);
  expect(parseJournal(JSON.stringify(old))).not.toHaveProperty("reviews");
  const next = complete(old, "one", now);
  expect(updateJournal(next, old)).toBeNull();
});
it("turns a seeded word list into a same-language recall round that joins the normal pools", () => {
  const en = STUDY_CARDS.filter(
    (c) => c.language === "en" && c.source === "vocabulary",
  ).slice(0, 2);
  const zh = STUDY_CARDS.find(
    (c) => c.language === "zh" && c.source === "vocabulary",
  )!;
  // Bare bank ids and full card ids resolve; duplicates, unknown ids and
  // other-course words drop without failing the rest of the list.
  const seeds = seededReviewCards(
    ` ${en[0].id.slice(2)}, ${en[1].id}, v:${en[0].id.slice(2)}, bogus, ${zh.id.slice(2)},`,
    "en",
  );
  expect(seeds.map((c) => c.id)).toEqual([en[0].id, en[1].id]);
  expect(seededReviewCards(undefined, "en")).toEqual([]);
  expect(seededReviewCards(zh.id, "en")).toEqual([]);
  let s = createJournal(now);
  expect(
    reviewCards(s, "en", "recommended", now).some(
      (c) => c.id === en[0].id,
    ),
  ).toBe(false);
  s = rateReview(
    startReview(
      s,
      seeds.map((c) => c.id),
      "seeded",
      now,
    ),
    0,
  );
  s = finishReview(rateReview(s, 2), now);
  const progress = cardProgress(s);
  expect(progress[en[0].id].rating).toBe(0);
  expect(progress[en[1].id].rating).toBe(2);
  const recommended = reviewCards(s, "en", "recommended", now).map(
    (c) => c.id,
  );
  expect(recommended).toContain(en[0].id);
  expect(recommended).not.toContain(en[1].id);
});
it("counts every recall pool in one pass and matches reviewCards per filter", () => {
  const second = STUDY_CARDS.filter((c) => c.language === "en")[1]!;
  let s = withWorkbench(createJournal(now), {
    words: [first.id, second.id],
  });
  s = complete(s, "old", now - 2 * DAY); // first: rated good, due yesterday
  const counts = reviewCounts(s, "en", now);
  for (const f of [
    "recommended",
    "weak",
    "due",
    "all",
  ] as ReviewFilter[])
    expect(counts[f]).toBe(reviewCards(s, "en", f, now).length);
  expect(counts).toMatchObject({ recommended: 2, weak: 0, due: 1 });
  expect(reviewCounts(s, "ja", now)).toMatchObject({
    recommended: 0,
    weak: 0,
    due: 0,
  });
  // The same card reviewed moments ago is scheduled out, not due.
  s = complete(s, "fresh", now);
  expect(reviewCounts(s, "en", now)).toMatchObject({
    recommended: 1,
    weak: 0,
    due: 0,
  });
  // A failed card counts as weak and due at once.
  s = finishReview(
    rateReview(startReview(s, [second.id], "slip", now - DAY), 0),
    now - DAY,
  );
  expect(reviewCounts(s, "en", now)).toMatchObject({
    recommended: 1,
    weak: 1,
    due: 1,
  });
});
it("accepts only matching completion of an existing recall draft", () => {
  const draft = rateReview(
    startReview(createJournal(now), [first.id], "same", now),
    1,
  );
  const correct = { ...draft.reviewDraft!, at: now } as ReviewRound;
  const merged = mergeReviewImport(draft, {
    format: "lingolearn-review-results",
    version: 1,
    rounds: [correct],
  })!;
  expect(merged.reviewDraft).toBeNull();
  expect(updateJournal(draft, merged)).toEqual(merged);
  const wrong = { ...correct, ratings: [2] as (0 | 1 | 2)[] };
  expect(
    mergeReviewImport(draft, {
      format: "lingolearn-review-results",
      version: 1,
      rounds: [wrong],
    }),
  ).toBeNull();
});

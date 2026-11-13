import { expect, it } from "vitest";
import { STUDY_CARDS } from "./cards";
import { makePack, packHtml } from "./materials";
import { offlineScript } from "./offline";
import {
  finishReview,
  mergeReviewImport,
  parseReviewImport,
  rateReview,
  startReview,
} from "./review";
import { createJournal, parseJournal, type StudyJournal } from "./session";

const NOW = 1700000000000;
const EN_CARDS = STUDY_CARDS.filter((card) => card.language === "en").map(
  (card) => card.id,
);

/** Mirror of the offline export: `JSON.stringify({format, version, rounds, draft})`. */
function exportOffline(journal: StudyJournal): string {
  return JSON.stringify(
    {
      format: "lingolearn-review-results",
      version: 1,
      rounds: journal.reviews ?? [],
      draft: journal.reviewDraft ?? null,
    },
    null,
    2,
  );
}

function completeRound(
  journal: StudyJournal,
  id: string,
  cards: string[],
  at: number,
): StudyJournal {
  const ratings = [2, 0, 1, 2, 0] as const;
  let next = startReview(journal, cards, id, at);
  for (let i = 0; i < cards.length; i += 1)
    next = rateReview(next, ratings[i % ratings.length]);
  return finishReview(next, at + 1);
}

it("round-trips completed offline rounds into an empty journal", () => {
  const source = completeRound(
    createJournal(NOW),
    "offline-1",
    EN_CARDS.slice(0, 3),
    NOW,
  );
  const incoming = parseReviewImport(exportOffline(source))!;
  expect(incoming.rounds).toEqual(source.reviews);
  const imported = mergeReviewImport(createJournal(NOW), incoming)!;
  expect(imported.reviews).toEqual(source.reviews);
  expect(parseJournal(JSON.stringify(imported))).toEqual(imported);
});

it("restores a pending offline draft only when explicitly requested", () => {
  let source = createJournal(NOW);
  source = startReview(source, EN_CARDS.slice(0, 2), "offline-draft", NOW);
  source = rateReview(source, 1);
  const incoming = parseReviewImport(exportOffline(source))!;
  expect(incoming.draft).toEqual(source.reviewDraft);
  const withoutDraft = mergeReviewImport(createJournal(NOW), incoming)!;
  expect(withoutDraft.reviewDraft ?? null).toBeNull();
  const withDraft = mergeReviewImport(createJournal(NOW), incoming, true)!;
  expect(withDraft.reviewDraft).toEqual(source.reviewDraft);
});

it("accepts a draft-only export and rejects an entirely empty state", () => {
  const empty = JSON.stringify({
    format: "lingolearn-review-results",
    version: 1,
    rounds: [],
    draft: null,
  });
  expect(parseReviewImport(empty)).toBeNull();
  let source = createJournal(NOW);
  source = startReview(source, EN_CARDS.slice(0, 2), "only-draft", NOW);
  source = rateReview(source, 2);
  const incoming = parseReviewImport(exportOffline(source));
  expect(incoming).not.toBeNull();
  expect(incoming!.rounds).toEqual([]);
  expect(incoming!.draft).toEqual(source.reviewDraft);
});

it("rejects malformed and partial offline payloads without throwing", () => {
  const good = completeRound(
    createJournal(NOW),
    "good",
    EN_CARDS.slice(0, 2),
    NOW,
  ).reviews![0];
  const otherLanguage = STUDY_CARDS.find((card) => card.language === "ja")!.id;
  const cases: string[] = [
    "not json",
    JSON.stringify(null),
    JSON.stringify({}),
    JSON.stringify({ format: "other", version: 1, rounds: [good] }),
    JSON.stringify({
      format: "lingolearn-review-results",
      version: 2,
      rounds: [good],
    }),
    JSON.stringify({
      format: "lingolearn-review-results",
      version: "1",
      rounds: [good],
    }),
    JSON.stringify({
      format: "lingolearn-review-results",
      version: 1,
      rounds: {},
    }),
    JSON.stringify({
      format: "lingolearn-review-results",
      version: 1,
      rounds: [],
    }),
    JSON.stringify({
      format: "lingolearn-review-results",
      version: 1,
      rounds: [],
      draft: null,
    }),
    JSON.stringify({
      format: "lingolearn-review-results",
      version: 1,
      rounds: [good, good],
    }),
    JSON.stringify({
      format: "lingolearn-review-results",
      version: 1,
      rounds: [{ ...good, id: "../escape" }],
    }),
    JSON.stringify({
      format: "lingolearn-review-results",
      version: 1,
      rounds: [{ ...good, ratings: [3] }],
    }),
    JSON.stringify({
      format: "lingolearn-review-results",
      version: 1,
      rounds: [
        { ...good, cards: [good.cards[0], otherLanguage], ratings: [2, 2] },
      ],
    }),
    JSON.stringify({
      format: "lingolearn-review-results",
      version: 1,
      rounds: [{ ...good, startedAt: Date.now() + 60000 }],
    }),
    "x".repeat(5000001),
  ];
  for (const raw of cases) {
    expect(() => parseReviewImport(raw), raw.slice(0, 60)).not.toThrow();
    expect(parseReviewImport(raw), raw.slice(0, 60)).toBeNull();
  }
});

it("rejects conflicting offline merges and treats a repeated import as idempotent", () => {
  const source = completeRound(
    createJournal(NOW),
    "merge",
    EN_CARDS.slice(0, 3),
    NOW,
  );
  const incoming = parseReviewImport(exportOffline(source))!;
  const merged = mergeReviewImport(createJournal(NOW), incoming)!;
  expect(mergeReviewImport(merged, incoming)).toEqual(merged);
  const tampered = structuredClone(incoming);
  tampered.rounds[0].ratings = [0];
  expect(mergeReviewImport(merged, tampered)).toBeNull();
});

it("keeps the offline export format and version aligned with the import parser", () => {
  expect(offlineScript).toContain("lingolearn-review-results");
  expect(offlineScript).toContain("version:1");
  expect(offlineScript).toContain("format");
  const round = completeRound(
    createJournal(NOW),
    "fmt",
    EN_CARDS.slice(0, 2),
    NOW,
  ).reviews![0];
  expect(
    parseReviewImport(
      JSON.stringify({
        format: "lingolearn-review-results",
        version: 1,
        rounds: [round],
      }),
    ),
  ).not.toBeNull();
  expect(
    parseReviewImport(
      JSON.stringify({
        format: "lingolearn-review-results",
        version: 2,
        rounds: [round],
      }),
    ),
  ).toBeNull();
  expect(
    parseReviewImport(
      JSON.stringify({
        format: "LingoLearn-Review-Results",
        version: 1,
        rounds: [round],
      }),
    ),
  ).toBeNull();
});

it("round-trips the embedded pack-data JSON used by the offline HTML", () => {
  const cards = STUDY_CARDS.filter((card) => card.language === "en")
    .slice(0, 3)
    .map((card) => card.id);
  const pack = makePack(cards, "en")!;
  const html = packHtml(pack);
  const match = html.match(
    /<script id="pack-data" type="application\/json">([\s\S]*?)<\/script>/,
  );
  expect(match, "pack-data script present").not.toBeNull();
  const parsed = JSON.parse(match![1]);
  expect(parsed.pack.id).toBe(pack.id);
  expect(parsed.pack.version).toBe(1);
  expect(parsed.pack.cards.map((card: { id: string }) => card.id)).toEqual(
    cards,
  );
  expect(typeof parsed.credit).toBe("string");
});

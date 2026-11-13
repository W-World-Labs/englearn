import { expect, it } from "vitest";
import { WORDS, VOCABULARY_LANGUAGES, vocabularyWord } from "./bank";
import {
  createVocabulary,
  answerVocabulary,
  advanceVocabulary,
  vocabularyTotal,
  parseVocabulary,
  vocabularySummary,
  type VocabularySession,
} from "./session";
import { scoreVocabulary } from "./score";
const create = (mode: "quick" | "full" = "quick") => {
  const s = createVocabulary("en", "zh", mode, 1000, "sample", () => 0.37);
  s.adaptive!.version = 1;
  return s;
};
function finish(s: VocabularySession, correct = true): VocabularySession {
  while (s.status === "running") {
    const q = s.questions[s.index];
    s = advanceVocabulary(
      answerVocabulary(s, correct ? q.id : "unknown"),
      2000,
    );
  }
  return s;
}
const band = (s: VocabularySession) =>
  vocabularyWord(s.questions[s.index].id)!.band;
const step = (s: VocabularySession, correct: boolean) =>
  advanceVocabulary(
    answerVocabulary(s, correct ? s.questions[s.index].id : "unknown"),
    2000,
  );

it("v1 compatibility: adapts upward after strong recent accuracy and downward after low accuracy", () => {
  const s = create();
  expect(band(s)).toBe(1);
  expect(advanceVocabulary(s, 2000)).toBe(s);
  expect(band(step(s, false))).toBe(0);
  const higher = step(step(s, true), true);
  expect(band(higher)).toBe(2);
  expect(band(step(higher, false))).toBe(1);
  const low = finish(s, false),
    high = finish(s);
  const counts = (s: VocabularySession, b: number) =>
    s.questions.filter((q) => vocabularyWord(q.id)!.band === b).length;
  expect(counts(low, 0)).toBeGreaterThan(counts(high, 0));
  expect(counts(high, 3)).toBeGreaterThan(counts(low, 3));
});
it("v1 compatibility: covers every band without repeats and resumes deterministically for five languages and varied responses", { timeout: 60000 }, () => {
  expect(WORDS).toHaveLength(1500);
  for (const language of VOCABULARY_LANGUAGES)
    for (const mode of ["quick", "full"] as const)
      for (const pattern of [0, 1, 2, 3]) {
        let s = createVocabulary(language, "en", mode, 1000, "sample");
        s.adaptive!.version = 1;
        expect(s.questions).toHaveLength(1);
        for (const q of s.adaptive!.pool) {
          const word = vocabularyWord(q.id)!;
          for (const id of q.options.filter((id) => id !== q.id))
            if (word.group)
              expect(vocabularyWord(id)!.group).not.toBe(word.group);
        }
        while (s.status === "running") {
          expect(parseVocabulary(JSON.stringify(s))).toEqual(s);
          const q = s.questions[s.index];
          const answer =
            pattern === 1 || (pattern === 2 && s.index % 2)
              ? q.id
              : pattern === 3
                ? q.options.find((id) => id !== q.id)!
                : "unknown";
          const answered = answerVocabulary(s, answer);
          const restored = parseVocabulary(JSON.stringify(answered))!;
          s = advanceVocabulary(answered, 2000);
          expect(advanceVocabulary(restored, 2000)).toEqual(s);
        }
        expect(parseVocabulary(JSON.stringify(s))).toEqual(s);
        expect(s.questions).toHaveLength(vocabularyTotal(s));
        expect(new Set(s.questions.map((q) => q.id)).size).toBe(
          vocabularyTotal(s),
        );
        for (let b = 0; b < 4; b++)
          expect(
            s.questions.filter((q) => vocabularyWord(q.id)!.band === b).length,
          ).toBeGreaterThanOrEqual(3);
      }
});
it("locks committed answers while allowing review and draft edits", () => {
  const s = create(),
    q = s.questions[0];
  const answered = answerVocabulary(s, q.id);
  expect(answerVocabulary(answered, "unknown").answers[q.id]).toBe("unknown");
  const next = advanceVocabulary(answered, 2000);
  const back = { ...next, index: 0 };
  expect(answerVocabulary(back, "unknown")).toBe(back);
  expect(advanceVocabulary(back, 2000)).toEqual(next);
  expect(parseVocabulary(JSON.stringify(back))).toEqual(back);
  const completed = finish(next);
  expect(answerVocabulary(completed, "unknown")).toBe(completed);
});
it("rejects altered paths, pools, missing prior answers and incomplete claimed results", () => {
  const s = create();
  for (const change of [
    { status: "finished", completedAt: 2000 },
    { index: 20 },
    { bank: "unknown" },
    { adaptive: null },
    { adaptive: { ...s.adaptive, version: 3 } },
    { answers: { [s.questions[0].id]: "fake" } },
  ])
    expect(parseVocabulary(JSON.stringify({ ...s, ...change }))).toBeNull();
  const changed = structuredClone(s);
  changed.questions[0] = changed.adaptive!.pool.find(
    (q) => vocabularyWord(q.id)!.band === 0,
  )!;
  expect(parseVocabulary(JSON.stringify(changed))).toBeNull();
  const foreign = structuredClone(s);
  foreign.adaptive!.pool[0].options[0] = WORDS.find(
    (w) => w.language === "ja",
  )!.id;
  expect(parseVocabulary(JSON.stringify(foreign))).toBeNull();
  const duplicate = structuredClone(s);
  duplicate.adaptive!.pool[0] = duplicate.adaptive!.pool[1];
  expect(parseVocabulary(JSON.stringify(duplicate))).toBeNull();
  const progressed = step(s, false);
  expect(
    parseVocabulary(JSON.stringify({ ...progressed, answers: {} })),
  ).toBeNull();
  const reordered = structuredClone(progressed);
  reordered.questions[1] = {
    ...reordered.questions[1],
    options: [...reordered.questions[1].options].reverse(),
  };
  expect(parseVocabulary(JSON.stringify(reordered))).toBeNull();
  expect(
    parseVocabulary(
      JSON.stringify({ ...s, injectedResult: 99999, userId: "someone-else" }),
    ),
  ).toEqual(s);
});
it("preserves fixed-stratum v0.6 drafts and finished records without migration", () => {
  for (const mode of ["quick", "full"] as const) {
    const { adaptive, ...legacy } = create(mode);
    const counts = [0, 0, 0, 0];
    legacy.questions = adaptive!.pool.filter(
      (q) => counts[vocabularyWord(q.id)!.band]++ < vocabularyTotal(legacy) / 4,
    );
    expect(parseVocabulary(JSON.stringify(legacy))).toEqual(legacy);
    const saved = finish(legacy);
    expect(parseVocabulary(JSON.stringify(saved))).toEqual(saved);
    expect(scoreVocabulary(saved)!.correct).toBe(vocabularyTotal(legacy));
    expect(
      answerVocabulary({ ...legacy, index: 0 }, "unknown").answers[
        legacy.questions[0].id
      ],
    ).toBe("unknown");
  }
  expect(
    vocabularySummary({ session: create(), revision: 1, updatedAt: 2000 }),
  ).toMatchObject({ answered: 0, total: 20 });
});
it("does not produce a size for incomplete or entirely unconfirmed vocabulary", () => {
  expect(scoreVocabulary(create())).toBeNull();
  const score = scoreVocabulary(finish(create(), false))!;
  expect(score.estimate).toBeNull();
  expect(score.correct).toBe(0);
  expect(score.unknown).toBe(20);
  expect(score.lower).toBe(0);
  expect(score.upper).toBeGreaterThan(0);
});
it("bounds estimates and narrows model uncertainty with more observations", () => {
  const quick = scoreVocabulary(finish(create()))!;
  const full = scoreVocabulary(finish(create("full")))!;
  expect(full.correct).toBe(40);
  expect(full.ceiling).toBe(true);
  expect(full.estimate).toBeGreaterThan(quick.estimate!);
  expect(full.upper).toBeLessThanOrEqual(10000);
  expect(full.lower).toBeLessThanOrEqual(full.estimate!);
  expect(full.upper - full.lower).toBeLessThan(quick.upper - quick.lower);
});
it("reduces the estimate when meanings are missed without mutating submitted answers", () => {
  const all = finish(create("full")),
    original = structuredClone(all);
  const partial = structuredClone(all);
  partial.questions.forEach((q, index) => {
    if (index % 2) partial.answers[q.id] = "unknown";
  });
  expect(scoreVocabulary(partial)!.estimate).toBeLessThan(
    scoreVocabulary(all)!.estimate!,
  );
  expect(scoreVocabulary(partial)!.correct).toBe(20);
  expect(all).toEqual(original);
});

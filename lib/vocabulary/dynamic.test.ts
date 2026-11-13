import { expect, it } from "vitest";
import { BANDS, VOCABULARY_LANGUAGES, vocabularyWord } from "./bank";
import {
  createVocabulary,
  answerVocabulary,
  advanceVocabulary,
  parseVocabulary,
  vocabularyLimit,
  vocabularySummary,
  type VocabularySession,
} from "./session";
import {
  scoreVocabulary,
  vocabularyEvidence,
  vocabularyPolicy,
  vocabularyStopping,
} from "./score";
const create = (mode: "quick" | "full" = "quick") =>
  createVocabulary("en", "zh", mode, 1000, "dynamic", () => 0.37);
function finish(
  s: VocabularySession,
  answer: (s: VocabularySession) => string,
) {
  for (let i = 0; i < 41 && s.status === "running"; i++)
    s = advanceVocabulary(answerVocabulary(s, answer(s)), 2000);
  expect(s.status).toBe("finished");
  return s;
}
it("varies test length with evidence and keeps the more demanding mode stricter", () => {
  for (const mode of ["quick", "full"] as const) {
    const clear = finish(create(mode), (s) => s.questions[s.index].id);
    const uncertain = finish(create(mode), (s) =>
      s.index % 2 ? s.questions[s.index].id : "unknown",
    );
    const policy = vocabularyPolicy(mode);
    expect(clear.questions.length).toBeGreaterThanOrEqual(policy.perBand * 4);
    expect(clear.questions.length).toBeLessThan(uncertain.questions.length);
    expect(uncertain.questions.length).toBeLessThanOrEqual(policy.maximum);
    expect(vocabularyStopping(clear).reason).toBe("precision");
    expect(vocabularyStopping(uncertain).reason).not.toBe("precision");
    console.info(mode, {
      clear: clear.questions.length,
      uncertain: uncertain.questions.length,
      stop: vocabularyStopping(uncertain).reason,
    });
  }
});
it("requires per-band coverage and preserves dynamic decisions across refresh in all languages", { timeout: 60000 }, () => {
  for (const language of VOCABULARY_LANGUAGES)
    for (const mode of ["quick", "full"] as const) {
      let s = createVocabulary(language, "en", mode, 1000, "dynamic");
      while (s.status === "running") {
        const answered = answerVocabulary(
          s,
          s.index % 3 ? s.questions[s.index].id : "unknown",
        );
        expect(parseVocabulary(JSON.stringify(answered))).toEqual(answered);
        const decision = vocabularyStopping(answered);
        if (decision.covered < 4) expect(decision.reason).toBeNull();
        s = advanceVocabulary(answered, 2000);
        expect(
          advanceVocabulary(parseVocabulary(JSON.stringify(answered))!, 2000),
        ).toEqual(s);
        expect(s.questions.length).toBeLessThanOrEqual(vocabularyLimit(s));
      }
      expect(parseVocabulary(JSON.stringify(s))).toEqual(s);
      expect(
        scoreVocabulary(s)!.bands.every(
          (b) => b.total >= vocabularyPolicy(mode).perBand,
        ),
      ).toBe(true);
      expect(
        vocabularySummary({ session: s, revision: 1, updatedAt: 2000 }),
      ).toMatchObject({
        answered: s.questions.length,
        total: s.questions.length,
        adaptiveVersion: 2,
      });
    }
});
it("rejects premature completion, continuing after a stop, forged choices and unrecognised versions", () => {
  const initial = create();
  expect(
    parseVocabulary(
      JSON.stringify({
        ...answerVocabulary(initial, initial.questions[0].id),
        status: "finished",
        completedAt: 2000,
      }),
    ),
  ).toBeNull();
  const complete = finish(initial, (s) => s.questions[s.index].id);
  const extra = complete.adaptive!.pool.find(
    (q) => !complete.questions.some((shown) => shown.id === q.id),
  )!;
  expect(
    parseVocabulary(
      JSON.stringify({
        ...complete,
        status: "running",
        completedAt: undefined,
        questions: [...complete.questions, extra],
        index: complete.questions.length,
      }),
    ),
  ).toBeNull();
  const bad = structuredClone(complete);
  bad.questions[1] = complete.adaptive!.pool.find(
    (q) => !complete.questions.some((shown) => shown.id === q.id),
  )!;
  expect(parseVocabulary(JSON.stringify(bad))).toBeNull();
  expect(
    parseVocabulary(
      JSON.stringify({
        ...initial,
        adaptive: { ...initial.adaptive, version: 3 },
      }),
    ),
  ).toBeNull();
});
it("does not count pending questions and predicts information using the posterior variance identity", () => {
  const s = create();
  expect(vocabularyEvidence(s).bands.every((b) => b.total === 0)).toBe(true);
  const answered = answerVocabulary(s, s.questions[0].id);
  const evidence = vocabularyEvidence(answered);
  for (const [i, b] of evidence.bands.entries()) {
    const bins = (BANDS[i].to - BANDS[i].from + 1) / 100;
    const probabilities = b.posterior.map((_, j) => 0.25 + (0.75 * j) / bins);
    const success = b.posterior.reduce(
      (n, p, j) => n + p * probabilities[j],
      0,
    );
    function variance(correct: boolean) {
      const p = b.posterior.map(
        (p, j) =>
          (p * (correct ? probabilities[j] : 1 - probabilities[j])) /
          (correct ? success : 1 - success),
      );
      const mean = p.reduce((n, p, j) => n + p * j * 100, 0);
      return p.reduce((n, p, j) => n + p * (j * 100 - mean) ** 2, 0);
    }
    expect(b.gain).toBeCloseTo(
      b.variance - success * variance(true) - (1 - success) * variance(false),
      5,
    );
    expect(b.gain).toBeGreaterThan(0);
  }
});
it("targets the most informative available band after coverage and preserves the locked path", () => {
  let s = create();
  while (s.questions.length <= 12) {
    const answered = answerVocabulary(
      s,
      s.index % 2 ? s.questions[s.index].id : "unknown",
    );
    if (vocabularyStopping(answered).covered === 4) {
      expect(vocabularyStopping(answered).reason).toBeNull();
      const e = vocabularyEvidence(answered);
      const next = advanceVocabulary(answered, 2000);
      const selected = vocabularyWord(next.questions.at(-1)!.id)!.band;
      const available = answered.adaptive!.pool.filter(
        (q) => !answered.questions.some((shown) => shown.id === q.id),
      );
      const best = Math.max(
        ...e.bands.map((b, i) =>
          available.some((q) => vocabularyWord(q.id)!.band === i) ? b.gain : 0,
        ),
      );
      expect(e.bands[selected].gain).toBe(best);
      const back = { ...next, index: 0 };
      expect(answerVocabulary(back, "unknown")).toBe(back);
      expect(parseVocabulary(JSON.stringify(back))).toEqual(back);
      return;
    }
    s = advanceVocabulary(answered, 2000);
  }
  throw Error("Coverage not reached");
});
it("keeps no-confirmed-word results honest even when the within-model precision target is met", () => {
  const s = finish(create(), () => "unknown");
  const score = scoreVocabulary(s)!;
  expect(score.estimate).toBeNull();
  expect(score.unknown).toBe(s.questions.length);
  expect(score.upper).toBeGreaterThan(score.lower);
  expect(score.stopping!.covered).toBe(4);
});

it("never mislabels an exhausted bank: precision only when the target is met", () => {
  const s = create("full");
  const complete = {
    ...s,
    questions: s.adaptive!.pool,
    answers: Object.fromEntries(
      s.adaptive!.pool.map((q, i) => [q.id, i % 2 ? q.id : "unknown"]),
    ),
  };
  const stop = vocabularyStopping(complete);
  expect(stop.answered).toBe(s.adaptive!.pool.length);
  expect(stop.reason).not.toBeNull();
  // Precision may only be claimed when its target is actually met; with a
  // larger bank the same mixed responses can legitimately get there.
  if (stop.reason === "precision")
    expect(stop.standardError).toBeLessThanOrEqual(stop.targetSE);
});

it("keeps the previous 200-item adaptive pool resumable after bank growth", () => {
  const s = create("full");
  const legacy = structuredClone(s);
  // A record saved against the 200-item-per-language bank: its immutable pool
  // and question path must still replay after the bank grew to 300.
  legacy.adaptive!.pool = legacy.adaptive!.pool.slice(0, 200);
  const first = legacy.adaptive!.pool.find(
    (q) => vocabularyWord(q.id)!.band === 1,
  )!;
  legacy.questions = [first];
  legacy.answers = {};
  legacy.index = 0;
  legacy.status = "running";
  expect(legacy.adaptive!.pool).toHaveLength(200);
  expect(parseVocabulary(JSON.stringify(legacy))).toEqual(legacy);
  // Negative control: a non-historical pool length is still rejected.
  const bogus = structuredClone(legacy);
  bogus.adaptive!.pool = bogus.adaptive!.pool.slice(0, 199);
  bogus.questions = [
    bogus.adaptive!.pool.find((q) => vocabularyWord(q.id)!.band === 1)!,
  ];
  expect(bogus.adaptive!.pool).toHaveLength(199);
  expect(parseVocabulary(JSON.stringify(bogus))).toBeNull();
});

import { expect, it } from "vitest";
import {
  createVocabulary,
  answerVocabulary,
  advanceVocabulary,
  parseVocabulary,
} from "./session";
import { vocabularyWord } from "./bank";
import { scoreVocabulary, vocabularyRecognitionEvidence } from "./score";

it("starts with neutral evidence and treats unknown or incorrect answers as failures", () => {
  expect(vocabularyRecognitionEvidence(0, 0)).toBe(1);
  expect(vocabularyRecognitionEvidence(0, 10)).toBeLessThan(1);
  expect(vocabularyRecognitionEvidence(5, 20)).toBeLessThan(20);
  expect(vocabularyRecognitionEvidence(3, 3)).toBeLessThan(80);
  expect(vocabularyRecognitionEvidence(5, 5)).toBeGreaterThan(80);
  expect(vocabularyRecognitionEvidence(15, 20)).toBeGreaterThan(20);
  for (const [correct, total] of [
    [-1, 4],
    [5, 4],
    [1, 2.5],
    [NaN, 2],
  ])
    expect(vocabularyRecognitionEvidence(correct, total)).toBe(0);
});
it("is a mean-one mixture under uniform guessing at every possible test prefix", () => {
  for (let total = 0; total < 40; total++)
    for (let correct = 0; correct <= total; correct++) {
      const current = vocabularyRecognitionEvidence(correct, total);
      const success = vocabularyRecognitionEvidence(correct + 1, total + 1);
      const failure = vocabularyRecognitionEvidence(correct, total + 1);
      expect(
        Math.abs((0.25 * success + 0.75 * failure) / current - 1),
      ).toBeLessThan(1e-12);
      expect(0.1 * success + 0.9 * failure).toBeLessThanOrEqual(
        current * (1 + 1e-12),
      );
    }
});
it("bounds the exact chance of any false signal across all 40 stopping opportunities", () => {
  for (const threshold of [20, 80]) {
    let mass = [1],
      crossed = 0;
    for (let total = 1; total <= 40; total++) {
      const next = Array(total + 1).fill(0);
      mass.forEach((p, c) => {
        next[c] += 0.75 * p;
        next[c + 1] += 0.25 * p;
      });
      mass = next.map((p, c) => {
        if (vocabularyRecognitionEvidence(c, total) >= threshold) {
          crossed += p;
          return 0;
        }
        return p;
      });
    }
    expect(crossed).toBeLessThanOrEqual(1 / threshold);
    expect(crossed + mass.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    console.info("uniform guessing: any threshold crossing by question 40", {
      threshold,
      probability: crossed,
    });
  }
});
it("withholds a chance-level count without changing answers, selection or model stopping", () => {
  let s = createVocabulary(
    "en",
    "en",
    "quick",
    1000,
    "recognition",
    () => 0.37,
  );
  while (s.status === "running") {
    const q = s.questions[s.index];
    s = advanceVocabulary(
      answerVocabulary(
        s,
        s.index % 4 === 0 ? q.id : q.options.find((id) => id !== q.id)!,
      ),
      2000,
    );
  }
  const original = structuredClone(s);
  const result = scoreVocabulary(s)!;
  expect(result.correct).toBeGreaterThan(0);
  expect(result.recognitionSupported).toBe(false);
  expect(result.estimate).toBeNull();
  expect(result.bands.every((b) => !b.recognitionSupported)).toBe(true);
  expect(s).toEqual(original);
  expect(parseVocabulary(JSON.stringify(s))).toEqual(original);
});
it("allows an estimate for strong responses and separates band support from sample correctness", () => {
  let s = createVocabulary(
    "en",
    "en",
    "quick",
    1000,
    "recognition",
    () => 0.37,
  );
  while (s.status === "running")
    s = advanceVocabulary(answerVocabulary(s, s.questions[s.index].id), 2000);
  const result = scoreVocabulary(s)!;
  expect(result.estimate).toBeGreaterThan(0);
  expect(result.recognitionSupported).toBe(true);
  expect(
    result.bands.some((b) => b.correct === b.total && !b.recognitionSupported),
  ).toBe(true);
  expect(result.bands.some((b) => b.recognitionSupported)).toBe(true);
  expect(result.upper).toBeLessThanOrEqual(10000);
});

it("applies conservative reporting to legacy records without changing their stored answers", () => {
  const s = createVocabulary(
    "en",
    "en",
    "full",
    1000,
    "legacy-report",
    () => 0.37,
  );
  const { adaptive, ...legacy } = s;
  // A genuine legacy (v0.6, no adaptive) fixed-stratum record: exactly 40
  // questions, 10 per band. The live pool is larger now, so select per band.
  legacy.questions = [0, 1, 2, 3].flatMap((band) =>
    adaptive!.pool
      .filter((q) => vocabularyWord(q.id)!.band === band)
      .slice(0, 10),
  );
  legacy.status = "finished";
  legacy.completedAt = 2000;
  legacy.answers = Object.fromEntries(
    legacy.questions.map((q, i) => [q.id, i % 4 === 0 ? q.id : "unknown"]),
  );
  const raw = JSON.stringify(legacy);
  const restored = parseVocabulary(raw)!;
  expect(scoreVocabulary(restored)!.correct).toBe(10);
  expect(scoreVocabulary(restored)!.estimate).toBeNull();
  expect(restored).toEqual(legacy);
  expect(JSON.stringify(legacy)).toBe(raw);
});

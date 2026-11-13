import { expect, it } from "vitest";
import {
  createVocabulary,
  answerVocabulary,
  advanceVocabulary,
} from "../lib/vocabulary/session";
import { vocabularyWord } from "../lib/vocabulary/bank";
import {
  scoreVocabulary,
  vocabularyPolicy,
  vocabularyStopping,
} from "../lib/vocabulary/score";

// Model sensitivity audit, not validation on human learners or real item parameters.
// Withheld estimates are not zero. Conditional RMSE uses different selected subsets
// and must not be presented as an unbiased accuracy improvement.
// Generate a fixed response for every bank item before adaptive selection so both
// the dynamic test and 40-item comparator observe the same synthetic responses.
const profiles = {
  guessing: [0, 0, 0, 0],
  foundation: [0.9, 0.5, 0.1, 0],
  intermediate: [0.95, 0.8, 0.5, 0.2],
  advanced: [0.99, 0.95, 0.85, 0.7],
};
function seeded(seed: number) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}
for (const [profile, knowledge] of Object.entries(profiles))
  it(`simulates ${profile} without exceeding coverage or item limits`, () => {
    for (const mode of ["quick", "full"] as const) {
      const lengths: number[] = [];
      const reasons: Record<string, number> = {};
      let squaredError = 0,
        fullSquaredError = 0,
        intervalContains = 0,
        reported = 0,
        fullReported = 0;
      const truth = knowledge.reduce(
        (n, k, i) => n + k * [1000, 2000, 3000, 4000][i],
        0,
      );
      for (let run = 0; run < 100; run++) {
        const random = seeded(1000 + run);
        let s = createVocabulary("en", "en", mode, 1000, "simulation", random);
        const pool = s.adaptive!.pool;
        const answers = Object.fromEntries(
          pool.map((q) => [
            q.id,
            random() < 0.25 + 0.75 * knowledge[vocabularyWord(q.id)!.band]
              ? q.id
              : "unknown",
          ]),
        );
        // Fixed 40-item comparator: 10 per band from the live pool, so the
        // audit stays comparable to the published v0.8 baseline after bank growth.
        const fullQuestions = [0, 1, 2, 3].flatMap((band) =>
          pool
            .filter((q) => vocabularyWord(q.id)!.band === band)
            .slice(0, 10),
        );
        const full = scoreVocabulary({
          ...s,
          adaptive: undefined,
          mode: "full",
          questions: fullQuestions,
          answers,
          status: "finished",
          completedAt: 2000,
        })!;
        for (let i = 0; i < 40 && s.status === "running"; i++)
          s = advanceVocabulary(
            answerVocabulary(s, answers[s.questions[s.index].id]),
            2000,
          );
        expect(s.status).toBe("finished");
        const result = scoreVocabulary(s)!;
        expect(
          result.bands.every((b) => b.total >= vocabularyPolicy(mode).perBand),
        ).toBe(true);
        expect(s.questions.length).toBeLessThanOrEqual(
          vocabularyPolicy(mode).maximum,
        );
        const stop = vocabularyStopping(s);
        if (stop.reason === "precision")
          expect(stop.standardError).toBeLessThanOrEqual(stop.targetSE);
        if (stop.reason === "low_gain") {
          expect(stop.expectedReduction).toBeLessThan(stop.minimumGain);
          expect(stop.standardError).toBeGreaterThan(stop.targetSE);
        }
        lengths.push(s.questions.length);
        reasons[stop.reason!] = (reasons[stop.reason!] || 0) + 1;
        if (result.estimate !== null) {
          reported++;
          squaredError += (result.estimate - truth) ** 2;
          if (result.lower <= truth && result.upper >= truth)
            intervalContains++;
        }
        if (full.estimate !== null) {
          fullReported++;
          fullSquaredError += (full.estimate - truth) ** 2;
        }
      }
      if (profile === "guessing") expect(reported).toBeLessThanOrEqual(5);
      lengths.sort((a, b) => a - b);
      console.info(
        JSON.stringify({
          profile,
          mode,
          runs: 100,
          minimum: lengths[0],
          median: lengths[50],
          maximum: lengths.at(-1),
          reasons,
          reported,
          withheld: 100 - reported,
          fullReported,
          rmseAmongReported: reported
            ? Math.round(Math.sqrt(squaredError / reported))
            : null,
          full40RmseAmongReported: fullReported
            ? Math.round(Math.sqrt(fullSquaredError / fullReported))
            : null,
          intervalContainsTruthAmongReported: intervalContains,
        }),
      );
    }
  }, 15000);

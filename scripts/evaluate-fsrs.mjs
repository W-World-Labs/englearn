// Read-only, aggregate evaluation. Run with Node 22 --experimental-strip-types.
// Install ts-fsrs@5.4.2 into a temporary tools directory, not the application.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { supermemo } from "../lib/learning/supermemo.ts";
const { fsrs, createEmptyCard, Rating } = await import(
  process.env.ENGLEARN_FSRS_MODULE || "ts-fsrs"
);
assert(
  process.argv[2],
  "Provide the private, anonymized input produced by export-recall-evaluation.py",
);
const input = JSON.parse(await readFile(process.argv[2], "utf8"));
const scheduler = fsrs({
  enable_fuzz: false,
  enable_short_term: false,
  request_retention: 0.9,
  maximum_interval: 365,
});
const DAY = 86400000,
  epoch = Date.UTC(2026, 0, 1);
function replay(seq) {
  let card = createEmptyCard(new Date(epoch)),
    previous = 0,
    rows = [],
    sm2 = { interval: 0, repetition: 0, efactor: 2.5 },
    due = 0;
  for (const [day, r] of seq) {
    assert([0, 1, 2].includes(r) && Number.isFinite(day) && day >= previous);
    const now = new Date(epoch + day * DAY),
      probability = card.reps
        ? scheduler.get_retrievability(card, now, false)
        : null;
    // Only unaided recall is an unambiguous success. Exclude "with help" from predictive scoring.
    if (card.reps && day - previous >= 1 && r !== 1)
      rows.push({ probability, outcome: r === 2 ? 1 : 0 });
    if (!sm2.repetition || day >= due || r === 0) {
      sm2 = supermemo(sm2, r === 0 ? 2 : r === 1 ? 3 : 4);
      sm2.interval = Math.min(365, sm2.interval);
      sm2.efactor = Math.min(3, sm2.efactor);
      due = day + sm2.interval;
    }
    card = scheduler.next(
      card,
      now,
      [Rating.Again, Rating.Hard, Rating.Good][r],
    ).card;
    previous = day;
    assert(Number.isFinite(card.due.getTime()) && card.scheduled_days <= 365);
  }
  return { rows, fsrsInterval: card.scheduled_days, sm2Interval: sm2.interval };
}
const observations = input.sequences.flatMap((s) => replay(s).rows);
const examples = [
  [
    [0, 2],
    [1, 2],
    [7, 2],
    [20, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 1],
    [3, 2],
  ],
  [
    [0, 2],
    [30, 0],
    [31, 2],
  ],
  [
    [0, 2],
    [0.01, 2],
    [1, 2],
  ],
];
console.log(
  JSON.stringify(
    {
      evaluatedAt: new Date().toISOString().slice(0, 10),
      candidate: "ts-fsrs 5.4.2 (MIT)",
      production: input.stats,
      eligible: observations.length,
      fsrsBrier: observations.length
        ? observations.reduce(
            (n, o) => n + (o.probability - o.outcome) ** 2,
            0,
          ) / observations.length
        : null,
      syntheticReplay: examples.map((ratings) => {
        const r = replay(ratings);
        return {
          ratings,
          fsrsInterval: r.fsrsInterval,
          sm2Interval: r.sm2Interval,
        };
      }),
      limitations:
        "Chronological default-parameter replay, no fitting. SM-2 has no calibrated prediction to compare Brier scores. With-help ratings are ambiguous, so excluded from accuracy. Synthetic examples test compatibility, not learning or workload gains.",
    },
    null,
    2,
  ),
);

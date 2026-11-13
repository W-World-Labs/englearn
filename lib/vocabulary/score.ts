import { BANDS, vocabularyWord } from "./bank";
import type { VocabularyMode, VocabularySession } from "./session";

/** Product reference targets in word forms, not empirically calibrated accuracy.
 * Keep v2 parameters immutable so saved paths and stopping decisions replay. */
export function vocabularyPolicy(mode: VocabularyMode) {
  return mode === "quick"
    ? { perBand: 3, maximum: 30, targetSE: 900, minimumGain: 15 }
    : { perBand: 5, maximum: 40, targetSE: 650, minimumGain: 8 };
}

/** Same uniform-prior, four-choice recognition model used by v0.6/v0.7.
 * Unknown and incorrect responses have proportional likelihoods (1-k).
 * Use answered items only; unasked or pending items provide no evidence. */
export function vocabularyEvidence(
  s: Pick<VocabularySession, "questions" | "answers">,
) {
  const bands = BANDS.map((band, i) => {
    const questions = s.questions.filter(
      (q) => vocabularyWord(q.id)!.band === i && s.answers[q.id],
    );
    const correct = questions.filter((q) => s.answers[q.id] === q.id).length;
    const unknown = questions.filter(
      (q) => s.answers[q.id] === "unknown",
    ).length;
    const total = questions.length;
    const bins = (band.to - band.from + 1) / 100;
    const weights = Array.from({ length: bins + 1 }, (_, j) => {
      const k = j / bins;
      return (
        Math.pow(0.25 + 0.75 * k, correct) * Math.pow(1 - k, total - correct)
      );
    });
    const sum = weights.reduce((a, b) => a + b, 0);
    const posterior = weights.map((p) => p / sum);
    const mean = posterior.reduce((n, p, j) => n + p * j * 100, 0);
    const variance = posterior.reduce(
      (n, p, j) => n + p * (j * 100 - mean) ** 2,
      0,
    );
    const probability = posterior.reduce(
      (n, p, j) => n + p * (0.25 + (0.75 * j) / bins),
      0,
    );
    const correctMean =
      posterior.reduce(
        (n, p, j) => n + p * (0.25 + (0.75 * j) / bins) * j * 100,
        0,
      ) / probability;
    const wrongMean = (mean - probability * correctMean) / (1 - probability);
    // Law of total variance: expected reduction after a binary response.
    const gain =
      probability * (1 - probability) * (correctMean - wrongMean) ** 2;
    return { ...band, correct, unknown, total, posterior, variance, gain };
  });
  const variance = bands.reduce((n, b) => n + b.variance, 0);
  return { bands, variance, standardError: Math.sqrt(variance) };
}

/** Combined precision / small predicted-gain stopping with mandatory coverage.
 * A limit or low_gain result does not mean the precision target was achieved. */
export function vocabularyStopping(
  s: VocabularySession,
  evidence = vocabularyEvidence(s),
) {
  const policy = vocabularyPolicy(s.mode);
  const answered = evidence.bands.reduce((n, b) => n + b.total, 0);
  const covered = evidence.bands.filter(
    (b) => b.total >= policy.perBand,
  ).length;
  const available =
    s.adaptive?.pool.filter(
      (q) => !s.questions.some((shown) => shown.id === q.id),
    ) ?? [];
  const bestGain = Math.max(
    0,
    ...evidence.bands.map((b, i) =>
      available.some((q) => vocabularyWord(q.id)!.band === i) ? b.gain : 0,
    ),
  );
  const expectedReduction =
    evidence.standardError -
    Math.sqrt(Math.max(0, evidence.variance - bestGain));
  let reason: "precision" | "low_gain" | "limit" | null = null;
  if (covered === 4 && answered === s.questions.length) {
    if (evidence.standardError <= policy.targetSE) reason = "precision";
    else if (answered >= policy.maximum) reason = "limit";
    else if (expectedReduction < policy.minimumGain) reason = "low_gain";
  }
  return {
    reason,
    answered,
    covered,
    minimum: policy.perBand * 4,
    ...policy,
    standardError: evidence.standardError,
    expectedReduction,
  };
}

/** Mixture likelihood ratio against conditional P(correct) <= 1/4.
 * Each fixed q alternative is a test supermartingale, so their equal mixture
 * remains valid under adaptive question selection and optional stopping.
 * Unknown is a failure, not an omitted observation. Not a cheating detector or
 * a posterior probability of mastery. Assumes four-choice uniform guessing. */
export function vocabularyRecognitionEvidence(correct: number, total: number) {
  if (
    !Number.isInteger(total) ||
    !Number.isInteger(correct) ||
    total < 0 ||
    correct < 0 ||
    correct > total
  )
    return 0;
  return (
    Array.from({ length: 20 }, (_, i) => {
      const q = 0.25 + (0.75 * (i + 1)) / 20;
      return (
        Math.pow(q / 0.25, correct) * Math.pow((1 - q) / 0.75, total - correct)
      );
    }).reduce((a, b) => a + b, 0) / 20
  );
}

export function scoreVocabulary(s: VocabularySession) {
  if (s.status !== "finished" || s.questions.some((q) => !s.answers[q.id]))
    return null;
  const evidence = vocabularyEvidence(s);
  const stopping =
    s.adaptive?.version === 2 ? vocabularyStopping(s, evidence) : null;
  if (
    stopping
      ? !stopping.reason || s.questions.length > stopping.maximum
      : s.questions.length !== (s.mode === "quick" ? 20 : 40)
  )
    return null;
  const bands = evidence.bands.map(
    ({ posterior: _p, variance: _v, gain: _g, ...band }) => ({
      ...band,
      // Four within-attempt band checks: 80 = 4 / .05 (union bound).
      recognitionSupported:
        vocabularyRecognitionEvidence(band.correct, band.total) >= 80,
    }),
  );
  let distribution = [1];
  for (const { posterior } of evidence.bands) {
    const next = Array(distribution.length + posterior.length - 1).fill(0);
    distribution.forEach((p, a) =>
      posterior.forEach((q, b) => {
        next[a + b] += p * q;
      }),
    );
    distribution = next;
  }
  const quantile = (p: number) => {
    let sum = 0;
    for (let i = 0; i < distribution.length; i++) {
      sum += distribution[i];
      if (sum >= p) return i * 100;
    }
    return 10000;
  };
  const correct = bands.reduce((n, b) => n + b.correct, 0);
  const unknown = bands.reduce((n, b) => n + b.unknown, 0);
  const recognitionEvidence = vocabularyRecognitionEvidence(
    correct,
    s.questions.length,
  );
  const recognitionSupported = recognitionEvidence >= 20;
  return {
    bands,
    recognitionEvidence,
    recognitionSupported,
    correct,
    unknown,
    stopping,
    total: s.questions.length,
    estimate: recognitionSupported ? quantile(0.5) : null,
    lower: correct === 0 ? 0 : quantile(0.05),
    upper: quantile(0.95),
    ceiling: bands[3].correct / bands[3].total >= 0.8,
    focusBand: bands.findIndex((b) => b.correct / b.total < 0.8),
  };
}

import {
  BANK_VERSION,
  BANDS,
  WORDS,
  isVocabularyLanguage,
  vocabularyWord,
  type VocabularyLanguage,
  type MeaningLanguage,
} from "./bank";
import type { AttemptSession, SavedAttempt } from "@/lib/exams/storage-types";
import {
  vocabularyEvidence,
  vocabularyPolicy,
  vocabularyStopping,
} from "./score";
export type VocabularyMode = "quick" | "full";
type VocabularyQuestion = { id: string; options: string[] };
export interface VocabularySession extends AttemptSession {
  bank: string;
  language: VocabularyLanguage;
  meaningLanguage: MeaningLanguage;
  mode: VocabularyMode;
  /** Absent on v0.6 fixed-stratum records. Pool order and options never change. */
  adaptive?: { version: 1 | 2; pool: VocabularyQuestion[] };
  questions: VocabularyQuestion[];
  answers: Record<string, string>;
  index: number;
}
export type VocabularySummary = Pick<
  VocabularySession,
  | "id"
  | "startedAt"
  | "completedAt"
  | "status"
  | "language"
  | "meaningLanguage"
  | "mode"
> & { answered: number; total: number; adaptiveVersion?: 1 | 2 };
export function vocabularyStorageKey(owner: string) {
  return `lingolearn:vocabulary:${encodeURIComponent(owner)}`;
}
function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function createVocabulary(
  language: VocabularyLanguage,
  meaningLanguage: MeaningLanguage,
  mode: VocabularyMode,
  now: number,
  id: string,
  random = Math.random,
): VocabularySession {
  const pool = WORDS.filter((word) => word.language === language);
  const questions = shuffle(pool, random).map((word) => {
    const candidates = pool.filter(
      (w) => w.id !== word.id && (!word.group || w.group !== word.group),
    );
    const samePos = shuffle(
      candidates.filter((w) => w.pos === word.pos),
      random,
    );
    const rest = shuffle(
      candidates.filter((w) => w.pos !== word.pos),
      random,
    );
    const options = shuffle(
      [word.id, ...[...samePos, ...rest].slice(0, 3).map((w) => w.id)],
      random,
    );
    return { id: word.id, options };
  });
  return {
    id,
    bank: BANK_VERSION,
    language,
    meaningLanguage,
    mode,
    startedAt: now,
    status: "running",
    adaptive: { version: 2, pool: questions },
    questions: [questions.find((q) => vocabularyWord(q.id)!.band === 1)!],
    answers: {},
    index: 0,
  };
}
export function vocabularyLimit(
  s: Pick<VocabularySession, "mode" | "adaptive">,
) {
  return s.adaptive?.version === 2
    ? vocabularyPolicy(s.mode).maximum
    : s.mode === "quick"
      ? 20
      : 40;
}
export function vocabularyTotal(s: VocabularySession) {
  return s.adaptive?.version === 2 && s.status === "finished"
    ? s.questions.length
    : vocabularyLimit(s);
}

/** Frequency is a difficulty proxy. This is an uncalibrated accuracy rule,
 * not IRT. v1 paths remain reproducible; v2 fills coverage first, then
 * targets the largest expected reduction in posterior count variance. */
function nextQuestion(s: VocabularySession): VocabularyQuestion | undefined {
  const dynamic = s.adaptive?.version === 2;
  const evidence = dynamic ? vocabularyEvidence(s) : null;
  if (evidence && vocabularyStopping(s, evidence).reason) return undefined;
  const minimum = dynamic ? vocabularyPolicy(s.mode).perBand : 3;
  const counts = BANDS.map(
    (_, band) =>
      s.questions.filter((q) => vocabularyWord(q.id)!.band === band).length,
  );
  let target = 1;
  const last = s.questions.at(-1);
  if (last) {
    target = vocabularyWord(last.id)!.band;
    const recent = s.questions
      .filter((q) => vocabularyWord(q.id)!.band === target)
      .slice(-3);
    const accuracy =
      recent.filter((q) => s.answers[q.id] === q.id).length / recent.length;
    if (recent.length >= 2 && accuracy >= 0.75) target++;
    else if (accuracy <= 0.5) target--;
    target = Math.max(0, Math.min(3, target));
  }
  const required = counts.reduce(
    (n, count) => n + Math.max(0, minimum - count),
    0,
  );
  const cover = dynamic
    ? required > 0
    : vocabularyLimit(s) - s.questions.length <= required;
  const available = s.adaptive!.pool.filter(
    (q) => !s.questions.some((shown) => shown.id === q.id),
  );
  const bands = BANDS.map((_, i) => i)
    .filter(
      (i) =>
        (!cover || counts[i] < minimum) &&
        available.some((q) => vocabularyWord(q.id)!.band === i),
    )
    .sort(
      (a, b) =>
        (evidence && !cover
          ? evidence.bands[b].gain - evidence.bands[a].gain
          : 0) ||
        Math.abs(a - target) - Math.abs(b - target) ||
        counts[a] - counts[b] ||
        a - b,
    );
  return available.find((q) => vocabularyWord(q.id)!.band === bands[0]);
}

export function answerVocabulary(
  s: VocabularySession,
  value: string,
): VocabularySession {
  const q = s.questions[s.index];
  if (
    s.status !== "running" ||
    (s.adaptive && s.index < s.questions.length - 1) ||
    (value !== "unknown" && !q.options.includes(value))
  )
    return s;
  return { ...s, answers: { ...s.answers, [q.id]: value } };
}

export function advanceVocabulary(
  s: VocabularySession,
  now: number,
): VocabularySession {
  if (s.status !== "running" || !s.answers[s.questions[s.index].id]) return s;
  if (s.index + 1 < s.questions.length) return { ...s, index: s.index + 1 };
  if (
    s.adaptive?.version === 2
      ? vocabularyStopping(s).reason
      : s.questions.length === vocabularyLimit(s)
  ) {
    if (Object.keys(s.answers).length !== s.questions.length) return s;
    return { ...s, status: "finished", completedAt: now };
  }
  const next = s.adaptive && nextQuestion(s);
  return next
    ? { ...s, questions: [...s.questions, next], index: s.index + 1 }
    : s;
}

function validQuestions(
  questions: VocabularyQuestion[],
  language: VocabularyLanguage,
) {
  const seen = new Set<string>();
  return questions.every((q) => {
    const word = q && vocabularyWord(q.id);
    if (
      !word ||
      word.language !== language ||
      seen.has(q.id) ||
      !Array.isArray(q.options) ||
      q.options.length !== 4 ||
      new Set(q.options).size !== 4 ||
      !q.options.includes(q.id) ||
      q.options.some((id) => vocabularyWord(id)?.language !== language)
    )
      return false;
    seen.add(q.id);
    return true;
  });
}

export function parseVocabulary(raw: string | null): VocabularySession | null {
  if (!raw || raw.length > 50000) return null;
  try {
    const s = JSON.parse(raw);
    if (
      !s ||
      typeof s !== "object" ||
      !/^[a-zA-Z0-9-]{1,100}$/.test(s.id) ||
      typeof s.id !== "string" ||
      s.bank !== BANK_VERSION ||
      !isVocabularyLanguage(s.language) ||
      !["en", "zh"].includes(s.meaningLanguage) ||
      !["quick", "full"].includes(s.mode) ||
      !["running", "finished"].includes(s.status) ||
      !Number.isFinite(s.startedAt) ||
      s.startedAt < 0
    )
      return null;
    const count = vocabularyLimit(s);
    if (
      !Array.isArray(s.questions) ||
      s.questions.length < 1 ||
      s.questions.length > count ||
      !Number.isInteger(s.index) ||
      s.index < 0 ||
      s.index >= s.questions.length ||
      !s.answers ||
      typeof s.answers !== "object" ||
      Array.isArray(s.answers)
    )
      return null;
    if (!validQuestions(s.questions, s.language)) return null;
    if (s.adaptive !== undefined) {
      // Pool sizes grow with bank expansions (40 -> 80 -> 120 -> 160 -> 200
      // -> 300 per language) while the bank version string stays put; every
      // historical size stays resumable. Question caps are unchanged.
      const currentPoolSize = WORDS.filter(
        (w) => w.language === s.language,
      ).length;
      if (
        !s.adaptive ||
        ![1, 2].includes(s.adaptive.version) ||
        !Array.isArray(s.adaptive.pool) ||
        ![40, 80, 120, 160, 200, currentPoolSize].includes(
          s.adaptive.pool.length,
        ) ||
        !validQuestions(s.adaptive.pool, s.language)
      )
        return null;
      // Replay the saved rule using only preceding answers, including offline
      // batches. A client cannot skip coverage or substitute an easier question.
      for (let i = 0; i < s.questions.length; i++) {
        if (i > 0 && !s.answers[s.questions[i - 1].id]) return null;
        const expected = nextQuestion({
          ...s,
          questions: s.questions.slice(0, i),
        });
        const q = s.questions[i];
        if (
          !expected ||
          expected.id !== q.id ||
          JSON.stringify(expected.options) !== JSON.stringify(q.options)
        )
          return null;
      }
    } else if (
      s.questions.length !== count ||
      BANDS.some(
        (_, band) =>
          s.questions.filter(
            (q: VocabularyQuestion) => vocabularyWord(q.id)!.band === band,
          ).length !==
          count / 4,
      )
    )
      return null;
    for (const [id, value] of Object.entries(s.answers)) {
      const q = s.questions.find((q: { id: string }) => q.id === id);
      if (!q || (value !== "unknown" && !q.options.includes(value)))
        return null;
    }
    if (
      s.status === "finished" &&
      (Object.keys(s.answers).length !== s.questions.length ||
        (s.adaptive?.version === 2
          ? !vocabularyStopping(s).reason
          : s.questions.length !== count) ||
        !Number.isFinite(s.completedAt) ||
        s.completedAt < s.startedAt)
    )
      return null;
    if (s.status === "running" && s.completedAt !== undefined) return null;
    return {
      id: s.id,
      bank: s.bank,
      language: s.language,
      meaningLanguage: s.meaningLanguage,
      mode: s.mode,
      startedAt: s.startedAt,
      status: s.status,
      ...(s.completedAt !== undefined ? { completedAt: s.completedAt } : {}),
      ...(s.adaptive
        ? {
            adaptive: {
              version: s.adaptive.version as 1 | 2,
              pool: s.adaptive.pool.map((q: VocabularyQuestion) => ({
                id: q.id,
                options: [...q.options],
              })),
            },
          }
        : {}),
      questions: s.questions.map((q: VocabularyQuestion) => ({
        id: q.id,
        options: [...q.options],
      })),
      answers: { ...s.answers },
      index: s.index,
    };
  } catch {
    return null;
  }
}
export function vocabularySummary({
  session: s,
}: SavedAttempt<VocabularySession>): VocabularySummary {
  return {
    id: s.id,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    status: s.status,
    language: s.language,
    meaningLanguage: s.meaningLanguage,
    mode: s.mode,
    answered: Object.keys(s.answers).length,
    total: vocabularyTotal(s),
    ...(s.adaptive ? { adaptiveVersion: s.adaptive.version } : {}),
  };
}

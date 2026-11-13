import {
  courseLessons,
  lessonById,
  STAGES,
  type LearningLanguage,
  type Stage,
} from "./catalog";
import { studyProgress, type StudyJournal } from "./session";
import { cardProgress, DAY, reviewCards } from "./review";
import { conceptAttempts, workbench } from "./workbench";
import { studyCard } from "./cards";
import { WORDS, vocabularyWord } from "@/lib/vocabulary/bank";
import {
  vocabularyEvidence,
  vocabularyRecognitionEvidence,
} from "@/lib/vocabulary/score";
import type { VocabularySession } from "@/lib/vocabulary/session";
import type { TestResult } from "@/lib/types";

/** Transparent practice rules, not a calibrated placement or CEFR certification. */
export const ASSESSMENT_MAX_AGE = 180 * DAY;
export const PRACTICE_MAX_AGE = 90 * DAY;
export interface LearningEvidence {
  language: LearningLanguage;
  grammar: { stage: Stage; at: number; items: number } | null;
  vocabulary: {
    stage: Stage;
    at: number;
    total: number;
    correct: number;
    missed: string[];
    seen: string[];
  } | null;
}
export interface LearningPlan {
  language: LearningLanguage;
  stage: Stage;
  basis: "assessment" | "practice" | "starter";
  adjustment: "up" | "down" | null;
  grammarDiagnostic: boolean;
  vocabularyDiagnostic: boolean;
  lessons: { id: string; reason: "resume" | "weak" | "due" | "new" }[];
  practice?: { lessons: number; days: number };
  promotion?: { qualifying: number; days: number };
  reviewCount: number;
  resumeRecall: boolean;
  vocabularyStage: Stage | null;
  wordIds: string[];
}
export interface AccountLearningPlan {
  version: 1;
  generatedAt: number;
  evidence: LearningEvidence;
  plan: LearningPlan;
}
const recent = (at: number, now: number, maxAge: number) =>
  Number.isFinite(at) && at > 0 && at <= now + 30000 && at >= now - maxAge;

/** Caller supplies only the verified owner's results. Each skill remains separate. */
export function learningEvidence(
  language: LearningLanguage,
  results: TestResult[],
  vocabulary: VocabularySession[],
  now = Date.now(),
): LearningEvidence {
  const grammar =
    results
      .filter(
        (r) =>
          r.learningLanguage === language &&
          recent(Date.parse(r.completedAt), now, ASSESSMENT_MAX_AGE),
      )
      .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
      .flatMap((r) => {
        const m = r.modules?.find((m) => m.module === "grammar");
        if (
          !m ||
          !Number.isInteger(m.itemsAdministered) ||
          m.itemsAdministered < 5 ||
          !Number.isFinite(m.se) ||
          m.se <= 0 ||
          m.se > 0.8 ||
          !Number.isFinite(m.theta) ||
          !["A1", "A2", "B1", "B2", "C1", "C2"].includes(m.cefr)
        )
          return [];
        return [
          {
            stage: (["A1", "A2"].includes(m.cefr)
              ? "foundation"
              : ["B1", "B2"].includes(m.cefr)
                ? "intermediate"
                : "advanced") as Stage,
            at: Date.parse(r.completedAt),
            items: m.itemsAdministered,
          },
        ];
      })[0] ?? null;
  const last = vocabulary
    .filter(
      (s) =>
        s.language === language &&
        s.status === "finished" &&
        recent(s.completedAt!, now, ASSESSMENT_MAX_AGE),
    )
    .sort((a, b) => b.completedAt! - a.completedAt!)[0];
  let words: LearningEvidence["vocabulary"] = null;
  if (last) {
    const bands = vocabularyEvidence(last).bands;
    const correct = bands.reduce((n, b) => n + b.correct, 0),
      total = bands.reduce((n, b) => n + b.total, 0);
    const supported = vocabularyRecognitionEvidence(correct, total) >= 20;
    const passed = (band: number) =>
      bands[band].total >= 3 && bands[band].correct / bands[band].total >= 0.75;
    const stage: Stage =
      supported && passed(0) && passed(1)
        ? passed(2)
          ? "advanced"
          : "intermediate"
        : "foundation";
    words = {
      stage,
      at: last.completedAt!,
      correct,
      total,
      missed: last.questions
        .filter((q) => last.answers[q.id] !== q.id)
        .map((q) => q.id),
      seen: last.questions.map((q) => q.id),
    };
  }
  return { language, grammar, vocabulary: words };
}

export function arrangeLearning(
  evidence: LearningEvidence,
  journal: StudyJournal | null,
  now = Date.now(),
): LearningPlan {
  const { language } = evidence,
    lessons = courseLessons(language),
    progress = studyProgress(journal);
  // Expire evidence even when a browser tab has stayed open beyond its freshness window.
  const grammar =
    evidence.grammar && recent(evidence.grammar.at, now, ASSESSMENT_MAX_AGE)
      ? evidence.grammar
      : null;
  const vocabulary =
    evidence.vocabulary &&
    recent(evidence.vocabulary.at, now, ASSESSMENT_MAX_AGE)
      ? evidence.vocabulary
      : null;
  const variantEvidence = new Map<string, ReturnType<typeof conceptAttempts>>();
  for (const l of lessons) {
    const rounds = workbench(journal).rounds.filter(
      (r) =>
        r.target === l.id &&
        ["practice", "retest"].includes(r.kind) &&
        recent(r.at, now, PRACTICE_MAX_AGE),
    );
    const last = rounds.at(-1);
    if (!last || last.at <= (progress[l.id]?.lastAt ?? 0)) continue;
    const answers = conceptAttempts(journal, l.id, now).filter(
      (a) => a.at >= now - PRACTICE_MAX_AGE && a.at > (grammar?.at ?? 0),
    );
    variantEvidence.set(
      l.id,
      answers.filter((a) => a.first),
    );
    const latest = answers.filter((a) => a.at === last.at);
    progress[l.id] = {
      ...progress[l.id],
      lastAt: last.at,
      dueAt: last.at + 3 * DAY,
      correct: latest.filter((a) => a.correct).length,
      total: latest.length,
      attempts: rounds.length,
    };
  }
  const recentLessons = lessons.filter(
    (l) =>
      progress[l.id] && recent(progress[l.id].lastAt, now, PRACTICE_MAX_AGE),
  );
  const evidenceFor = (stage: Stage, firstOnly = false) =>
    recentLessons
      .filter(
        (l) => l.stage === stage && progress[l.id].lastAt > (grammar?.at ?? 0),
      )
      .sort((a, b) => progress[b.id].lastAt - progress[a.id].lastAt)
      .slice(0, 3)
      .map((l) => {
        const fresh = variantEvidence.get(l.id);
        return fresh && firstOnly
          ? {
              ...progress[l.id],
              correct: fresh.filter((a) => a.correct).length,
              total: fresh.length,
            }
          : progress[l.id];
      });
  const passed = (stage: Stage) => {
    const rows = evidenceFor(stage, true);
    return (
      rows.length === 3 &&
      new Set(rows.map((p) => Math.floor(p.lastAt / DAY))).size >= 2 &&
      rows.every((p) => p.total >= 4 && p.correct / p.total >= 0.75) &&
      rows.reduce((n, p) => n + p.correct / p.total, 0) / 3 >= 0.8
    );
  };
  let stage = grammar?.stage ?? "foundation",
    adjustment: LearningPlan["adjustment"] = null;
  // One stage at a time, backed by distinct concepts on separate days. Repeated identical rounds cannot promote.
  while (stage !== "advanced" && passed(stage)) {
    stage = STAGES[STAGES.indexOf(stage) + 1];
    adjustment = "up";
  }
  const weak = evidenceFor(stage);
  if (
    stage !== "foundation" &&
    weak.length === 3 &&
    weak.reduce((n, p) => n + p.correct / p.total, 0) / 3 < 0.5
  ) {
    stage = STAGES[STAGES.indexOf(stage) - 1];
    adjustment = "down";
  }
  const planned: LearningPlan["lessons"] = [];
  function add(id: string, reason: LearningPlan["lessons"][number]["reason"]) {
    if (planned.length < 3 && !planned.some((p) => p.id === id))
      planned.push({ id, reason });
  }
  const draft = journal?.draft && lessonById(journal.draft.lessonId);
  if (draft?.language === language) add(draft.id, "resume");
  const eligible = lessons.filter(
    (l) => STAGES.indexOf(l.stage) <= STAGES.indexOf(stage),
  );
  eligible
    .filter(
      (l) =>
        progress[l.id] && progress[l.id].correct / progress[l.id].total < 0.75,
    )
    .sort(
      (a, b) =>
        progress[a.id].correct / progress[a.id].total -
          progress[b.id].correct / progress[b.id].total ||
        progress[a.id].lastAt - progress[b.id].lastAt,
    )
    .forEach((l) => add(l.id, "weak"));
  eligible
    .filter((l) => progress[l.id]?.dueAt <= now)
    .sort((a, b) => progress[a.id].dueAt - progress[b.id].dueAt)
    .forEach((l) => add(l.id, "due"));
  lessons
    .filter((l) => l.stage === stage && !progress[l.id])
    .forEach((l) => add(l.id, "new"));
  const recalls = cardProgress(journal);
  const missed =
    vocabulary?.missed.filter((id) => {
      const p = recalls["v:" + id];
      return (
        !p || p.lastAt <= vocabulary.at || p.rating !== 2 || p.dueAt <= now
      );
    }) ?? [];
  const words = missed.length
    ? missed
    : vocabulary
      ? WORDS.filter(
          (w) =>
            w.language === language &&
            !vocabulary.seen.includes(w.id) &&
            (vocabulary.stage === "foundation"
              ? w.band === 0
              : vocabulary.stage === "intermediate"
                ? w.band === 1 || w.band === 2
                : w.band === 3),
        ).map((w) => w.id)
      : [];
  return {
    language,
    stage,
    basis: adjustment
      ? "practice"
      : grammar
        ? "assessment"
        : recentLessons.length
          ? "practice"
          : "starter",
    adjustment,
    practice: recentLessons.length
      ? {
          lessons: recentLessons.length,
          days: new Set(
            recentLessons.map((l) => Math.floor(progress[l.id].lastAt / DAY)),
          ).size,
        }
      : undefined,
    promotion:
      stage === "advanced"
        ? undefined
        : (() => {
            const rows = evidenceFor(stage, true);
            return {
              qualifying: rows.filter(
                (p) => p.total >= 4 && p.correct / p.total >= 0.75,
              ).length,
              days: new Set(rows.map((p) => Math.floor(p.lastAt / DAY))).size,
            };
          })(),
    grammarDiagnostic: !grammar && recentLessons.length < 3,
    vocabularyDiagnostic: !vocabulary,
    lessons: planned,
    reviewCount: reviewCards(journal, language, "recommended", now).length,
    resumeRecall:
      !!journal?.reviewDraft &&
      journal.reviewDraft.cards.some(
        (id) => studyCard(id)?.language === language,
      ),
    vocabularyStage: vocabulary?.stage ?? null,
    wordIds: words
      .sort((a, b) => vocabularyWord(a)!.band - vocabularyWord(b)!.band)
      .slice(0, 12),
  };
}

import {
  COURSE_VERSION,
  LESSONS,
  courseLessons,
  lessonById,
  type LearningLanguage,
  type Lesson,
} from "./catalog";
import {
  parseWorkbench,
  updateWorkbench,
  type ActivityKind,
  type WorkbenchState,
} from "./workbench";
import {
  supermemo,
  type SuperMemoItem,
  type SuperMemoGrade,
} from "./supermemo";
import {
  DAY,
  MAX_JOURNAL_BYTES,
  MAX_REVIEW_ROUNDS,
  parseReview,
  reviewCounts,
  type ReviewDraft,
  type ReviewRound,
} from "./review";
import {
  parsePreparation,
  type IeltsPreparation,
} from "@/lib/ielts/preparation";
export { DAY } from "./review";
export const MAX_STUDY_EVENTS = 10000;
export interface StudyEvent {
  id: string;
  lessonId: string;
  at: number;
  answers: number[];
}
export interface StudyDraft {
  lessonId: string;
  startedAt: number;
  answers: number[];
}
/** One owner-scoped journal; learning never changes assessment scores or entitlements. */
export interface StudyJournal {
  id: "grammar-v1";
  course: typeof COURSE_VERSION;
  startedAt: number;
  status: "running";
  events: StudyEvent[];
  draft: StudyDraft | null;
  bookPage: number;
  reviews?: ReviewRound[];
  reviewDraft?: ReviewDraft | null;
  workbench?: WorkbenchState;
  ieltsPrep?: IeltsPreparation;
}
export function createJournal(now = Date.now()): StudyJournal {
  return {
    id: "grammar-v1",
    course: COURSE_VERSION,
    startedAt: now,
    status: "running",
    events: [],
    draft: null,
    bookPage: 1,
  };
}
export function scoreLesson(lesson: Lesson, answers: number[]) {
  return lesson.questions.reduce(
    (n, q, i) => n + Number(answers[i] === q.answer),
    0,
  );
}
function validAnswers(
  lesson: Lesson,
  answers: unknown,
  complete: boolean,
): answers is number[] {
  return (
    Array.isArray(answers) &&
    (complete
      ? answers.length === lesson.questions.length
      : answers.length <= lesson.questions.length) &&
    answers.every(
      (a, i) =>
        Number.isInteger(a) && a >= 0 && a < lesson.questions[i].choices.length,
    )
  );
}
export function parseJournal(raw: string | null): StudyJournal | null {
  if (!raw || raw.length > MAX_JOURNAL_BYTES) return null;
  try {
    const s = JSON.parse(raw) as StudyJournal;
    const latestAllowed = Date.now() + 30000;
    if (
      !s ||
      s.id !== "grammar-v1" ||
      s.course !== COURSE_VERSION ||
      s.status !== "running" ||
      !Number.isSafeInteger(s.startedAt) ||
      s.startedAt <= 0 ||
      s.startedAt > latestAllowed ||
      !Array.isArray(s.events) ||
      s.events.length > MAX_STUDY_EVENTS ||
      !Number.isInteger(s.bookPage) ||
      s.bookPage < 1 ||
      s.bookPage > 340
    )
      return null;
    const ids = new Set<string>();
    let at = s.startedAt;
    for (const event of s.events) {
      const lesson = lessonById(event?.lessonId);
      if (
        !lesson ||
        typeof event.id !== "string" ||
        !/^[a-zA-Z0-9-]{1,100}$/.test(event.id) ||
        ids.has(event.id) ||
        !Number.isSafeInteger(event.at) ||
        event.at < at ||
        event.at > latestAllowed ||
        !validAnswers(lesson, event.answers, true)
      )
        return null;
      ids.add(event.id);
      at = event.at;
    }
    if (s.draft !== null) {
      const lesson = lessonById(s.draft?.lessonId);
      if (
        !lesson ||
        !Number.isSafeInteger(s.draft.startedAt) ||
        s.draft.startedAt < at ||
        s.draft.startedAt > latestAllowed ||
        !validAnswers(lesson, s.draft.answers, false)
      )
        return null;
    }
    let reviews: ReviewRound[] | undefined;
    if (s.reviews !== undefined) {
      if (!Array.isArray(s.reviews) || s.reviews.length > MAX_REVIEW_ROUNDS)
        return null;
      reviews = [];
      for (const value of s.reviews) {
        const round = parseReview(value, true) as ReviewRound | null;
        if (!round || ids.has(round.id)) return null;
        ids.add(round.id);
        reviews.push(round);
      }
    }
    let reviewDraft: ReviewDraft | null | undefined;
    if (s.reviewDraft !== undefined) {
      reviewDraft =
        s.reviewDraft === null ? null : parseReview(s.reviewDraft, false);
      if (s.reviewDraft !== null && (!reviewDraft || ids.has(reviewDraft.id)))
        return null;
    }
    const workbench =
      s.workbench === undefined ? undefined : parseWorkbench(s.workbench, s);
    if (s.workbench !== undefined && !workbench) return null;
    const ieltsPrep =
      s.ieltsPrep === undefined ? undefined : parsePreparation(s.ieltsPrep);
    if (s.ieltsPrep !== undefined && !ieltsPrep) return null;
    // Normalize accepted fields so unknown fields cannot become executable content or stored scores.
    return {
      id: s.id,
      course: s.course,
      startedAt: s.startedAt,
      status: "running",
      bookPage: s.bookPage,
      ...(reviews !== undefined ? { reviews } : {}),
      ...(reviewDraft !== undefined ? { reviewDraft } : {}),
      ...(workbench ? { workbench } : {}),
      ...(ieltsPrep ? { ieltsPrep } : {}),
      events: s.events.map((e) => ({
        id: e.id,
        lessonId: e.lessonId,
        at: e.at,
        answers: [...e.answers],
      })),
      draft: s.draft
        ? {
            lessonId: s.draft.lessonId,
            startedAt: s.draft.startedAt,
            answers: [...s.draft.answers],
          }
        : null,
    };
  } catch {
    return null;
  }
}
export function startLesson(
  s: StudyJournal,
  lessonId: string,
  now = Date.now(),
): StudyJournal {
  if (!lessonById(lessonId)) return s;
  return {
    ...s,
    draft: {
      lessonId,
      startedAt: Math.max(now, s.events.at(-1)?.at ?? s.startedAt),
      answers: [],
    },
  };
}
export function answerLesson(s: StudyJournal, choice: number): StudyJournal {
  const draft = s.draft,
    lesson = draft && lessonById(draft.lessonId),
    question = lesson?.questions[draft!.answers.length];
  if (
    !draft ||
    !question ||
    !Number.isInteger(choice) ||
    choice < 0 ||
    choice >= question.choices.length
  )
    return s;
  return { ...s, draft: { ...draft, answers: [...draft.answers, choice] } };
}
export function finishLesson(
  s: StudyJournal,
  id: string,
  now = Date.now(),
): StudyJournal {
  const draft = s.draft,
    lesson = draft && lessonById(draft.lessonId);
  if (
    !draft ||
    !lesson ||
    draft.answers.length !== lesson.questions.length ||
    s.events.length >= MAX_STUDY_EVENTS ||
    s.events.some((e) => e.id === id) ||
    s.reviews?.some((r) => r.id === id) ||
    !/^[a-zA-Z0-9-]{1,100}$/.test(id)
  )
    return s;
  return {
    ...s,
    draft: null,
    events: [
      ...s.events,
      {
        id,
        lessonId: lesson.id,
        at: Math.max(now, draft.startedAt, s.events.at(-1)?.at ?? s.startedAt),
        answers: [...draft.answers],
      },
    ],
  };
}
export function updateJournal(
  previous: StudyJournal,
  incoming: StudyJournal,
): StudyJournal | null {
  if (!updateWorkbench(previous.workbench, incoming.workbench)) return null;
  // Older clients must not silently delete the owner's preparation workspace.
  if (previous.ieltsPrep && !incoming.ieltsPrep) return null;
  if (
    previous.startedAt !== incoming.startedAt ||
    incoming.events.length < previous.events.length ||
    JSON.stringify(previous.events) !==
      JSON.stringify(incoming.events.slice(0, previous.events.length))
  )
    return null;
  if (
    (incoming.reviews?.length ?? 0) < (previous.reviews?.length ?? 0) ||
    JSON.stringify(previous.reviews ?? []) !==
      JSON.stringify(
        (incoming.reviews ?? []).slice(0, previous.reviews?.length ?? 0),
      )
  )
    return null;
  const old = previous.reviewDraft,
    next = incoming.reviewDraft;
  if (
    old &&
    next?.id === old.id &&
    (old.startedAt !== next.startedAt ||
      JSON.stringify(old.cards) !== JSON.stringify(next.cards) ||
      JSON.stringify(old.ratings) !==
        JSON.stringify(next.ratings.slice(0, old.ratings.length)))
  )
    return null;
  const completed = old && incoming.reviews?.find((r) => r.id === old.id);
  if (
    old &&
    completed &&
    (old.startedAt !== completed.startedAt ||
      JSON.stringify(old.cards) !== JSON.stringify(completed.cards) ||
      JSON.stringify(old.ratings) !==
        JSON.stringify(completed.ratings.slice(0, old.ratings.length)))
  )
    return null;
  return incoming;
}
export interface LessonProgress extends SuperMemoItem {
  attempts: number;
  correct: number;
  total: number;
  lastAt: number;
  dueAt: number;
}
export function studyProgress(
  s: StudyJournal | null,
): Record<string, LessonProgress> {
  const progress: Record<string, LessonProgress> = {};
  for (const event of s?.events ?? []) {
    const lesson = lessonById(event.lessonId)!;
    const correct = scoreLesson(lesson, event.answers),
      total = lesson.questions.length;
    const previous = progress[lesson.id];
    const grade: SuperMemoGrade =
      correct === total ? 4 : correct / total >= 0.75 ? 3 : 2;
    // Early successful re-practice does not push the due date further into the future.
    // A weak attempt can always bring review forward. This is practice scheduling,
    // not a calibrated mastery estimate or CEFR level.
    const schedule = !previous || event.at >= previous.dueAt || grade < 3;
    const next = schedule
      ? supermemo(
          previous ?? { interval: 0, repetition: 0, efactor: 2.5 },
          grade,
        )
      : previous;
    const interval = Math.min(365, next.interval);
    progress[lesson.id] = {
      ...next,
      interval,
      efactor: Math.min(3, next.efactor),
      attempts: (previous?.attempts ?? 0) + 1,
      correct,
      total,
      lastAt: event.at,
      dueAt: schedule ? event.at + interval * DAY : previous.dueAt,
    };
  }
  return progress;
}
export type LessonCardStatus =
  | "draft"
  | "notStarted"
  | "due"
  | "needsPractice"
  | "learned";
/**
 * Course-card status for one lesson. A saved in-progress draft outranks the
 * scheduled labels — the learner has live work to return to.
 */
export function lessonCardStatus(
  progress: LessonProgress | undefined,
  draftLessonId: string | null | undefined,
  lessonId: string,
  now = Date.now(),
): LessonCardStatus {
  if (draftLessonId === lessonId) return "draft";
  if (!progress) return "notStarted";
  if (progress.dueAt <= now) return "due";
  return progress.correct / progress.total < 0.75
    ? "needsPractice"
    : "learned";
}
export function dueLessons(
  s: StudyJournal | null,
  language: string,
  now = Date.now(),
) {
  const progress = studyProgress(s);
  return LESSONS.filter(
    (l) => l.language === language && progress[l.id]?.dueAt <= now,
  ).sort((a, b) => progress[a.id].dueAt - progress[b.id].dueAt);
}
/**
 * Everything due on the review tab right now: scheduled course lessons plus
 * spaced-repetition recall cards. Badges use this so a returning learner sees
 * the full pile, not only the lesson share.
 */
export function dueReviewCount(
  s: StudyJournal | null,
  language: string,
  now = Date.now(),
) {
  return (
    dueLessons(s, language, now).length +
    reviewCounts(s, language as LearningLanguage, now).due
  );
}
export type LearningResumeTarget =
  | { lesson: string }
  | { tab: "today"; concept: string; activity: ActivityKind }
  | { tab: "review" };
/**
 * The /learn search that returns a learner to their most recently started
 * unfinished work: a lesson draft, a workbench activity draft, or a recall
 * draft. All three can coexist; the freshest start wins.
 */
export function learningResumeSearch(
  s: StudyJournal | null,
): LearningResumeTarget | undefined {
  if (!s) return undefined;
  const candidates: { startedAt: number; search: LearningResumeTarget }[] = [];
  if (s.draft?.lessonId)
    candidates.push({
      startedAt: s.draft.startedAt,
      search: { lesson: s.draft.lessonId },
    });
  const draft = s.workbench?.draft;
  if (draft)
    candidates.push({
      startedAt: draft.startedAt,
      search: { tab: "today", concept: draft.target, activity: draft.kind },
    });
  if (s.reviewDraft)
    candidates.push({
      startedAt: s.reviewDraft.startedAt,
      search: { tab: "review" },
    });
  return candidates.sort((a, b) => b.startedAt - a.startedAt)[0]?.search;
}
/**
 * The single best follow-up lesson after finishing one: the stalest due
 * lesson first (spaced reviews decay), then the first unstudied lesson in
 * course order. The just-finished lesson is never suggested back.
 */
export function nextLessonSuggestion(
  s: StudyJournal | null,
  language: string,
  excludeLessonId?: string,
  now = Date.now(),
): Lesson | null {
  const progress = studyProgress(s);
  const lessons = courseLessons(language).filter(
    (l) => l.id !== excludeLessonId,
  );
  const due = lessons
    .filter((l) => {
      const p = progress[l.id];
      return p && p.dueAt <= now;
    })
    .sort((a, b) => progress[a.id].dueAt - progress[b.id].dueAt);
  return due[0] ?? lessons.find((l) => !progress[l.id]) ?? null;
}

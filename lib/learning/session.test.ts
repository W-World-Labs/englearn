import { describe, expect, it, vi } from "vitest";
import {
  BOOK,
  COURSE_VERSION,
  LEARNING_LANGUAGES,
  LESSONS,
  STAGES,
  courseLessons,
} from "./catalog";
import {
  DAY,
  MAX_STUDY_EVENTS,
  answerLesson,
  createJournal,
  dueLessons,
  dueReviewCount,
  finishLesson,
  learningResumeSearch,
  lessonCardStatus,
  nextLessonSuggestion,
  parseJournal,
  startLesson,
  studyProgress,
  updateJournal,
  type StudyJournal,
} from "./session";
import { STUDY_CARDS } from "./cards";
import { finishReview, rateReview, startReview } from "./review";

const now = 1700000000000;
function round(s: StudyJournal, at: number, correct = 4, lesson = LESSONS[0]) {
  let next = startLesson(s, lesson.id, at);
  for (const [i, q] of lesson.questions.entries())
    next = answerLesson(
      next,
      i < correct ? q.answer : (q.answer + 1) % q.choices.length,
    );
  return finishLesson(next, `round-${s.events.length}`, at);
}

it("provides ordered courses in five languages with usable explanations and unique choices", () => {
  expect(LESSONS).toHaveLength(120);
  expect(new Set(LESSONS.map((l) => l.id)).size).toBe(120);
  expect(LESSONS.flatMap((l) => l.questions)).toHaveLength(480);
  for (const language of LEARNING_LANGUAGES)
    for (const stage of STAGES) {
      expect(courseLessons(language, stage)).toHaveLength(
        8,
      );
    }
  for (const lesson of LESSONS) {
    expect(lesson.id).toMatch(new RegExp(`^${lesson.language}-[a-z-]+$`));
    expect(lesson.examples.length).toBeGreaterThanOrEqual(2);
    for (const locale of ["en", "zh"] as const) {
      expect(lesson.title[locale].length).toBeGreaterThan(1);
      expect(lesson.explanation[locale].length).toBeGreaterThan(30);
    }
    for (const q of lesson.questions) {
      expect(new Set(q.choices).size).toBe(q.choices.length);
      expect(q.choices[q.answer]).toBeTruthy();
      expect(q.prompt).toBeTruthy();
    }
  }
});

it("resumes checked answers, rejects invalid choices, and completes each round only once", () => {
  const s = createJournal(now),
    lesson = LESSONS[0];
  expect(finishLesson(s, "one", now)).toBe(s);
  let draft = startLesson(s, lesson.id, now);
  expect(answerLesson(draft, 99)).toBe(draft);
  draft = answerLesson(draft, lesson.questions[0].answer);
  expect(parseJournal(JSON.stringify(draft))).toEqual(draft);
  expect(finishLesson(draft, "one", now)).toBe(draft);
  const finished = round(s, now);
  expect(finished.draft).toBeNull();
  expect(finished.events).toHaveLength(1);
  expect(finishLesson(finished, "one", now)).toBe(finished);
  expect(studyProgress(finished)[lesson.id].correct).toBe(4);
});

describe("review scheduling", () => {
  it("uses one day then six days; early successful repetitions keep the due date", () => {
    let s = round(createJournal(now), now);
    const id = LESSONS[0].id;
    expect(studyProgress(s)[id]).toMatchObject({
      interval: 1,
      repetition: 1,
      dueAt: now + DAY,
    });
    s = round(s, now + 1000);
    expect(studyProgress(s)[id]).toMatchObject({
      attempts: 2,
      repetition: 1,
      dueAt: now + DAY,
    });
    expect(dueLessons(s, "en", now + DAY - 1)).toHaveLength(0);
    expect(dueLessons(s, "en", now + DAY).map((l) => l.id)).toEqual([id]);
    expect(dueLessons(s, "ja", now + DAY)).toHaveLength(0);
    s = round(s, now + DAY);
    expect(studyProgress(s)[id]).toMatchObject({
      interval: 6,
      repetition: 2,
      dueAt: now + 7 * DAY,
    });
  });
  it("brings weak performance forward and resets the repetition sequence", () => {
    let s = round(createJournal(now), now);
    s = round(s, now + DAY);
    s = round(s, now + 2 * DAY, 1);
    expect(studyProgress(s)[LESSONS[0].id]).toMatchObject({
      correct: 1,
      repetition: 0,
      interval: 1,
      dueAt: now + 3 * DAY,
    });
  });
  it("adds due recall cards to the lesson count for the review badge", () => {
    const card = STUDY_CARDS.find(
      (c) => c.language === "en" && c.source === "vocabulary",
    )!;
    let s = round(createJournal(now - 2 * DAY), now - 2 * DAY);
    // The due lesson plus its question cards, which join the recall pool.
    expect(dueReviewCount(s, "en", now)).toBe(
      1 + LESSONS[0].questions.length,
    );
    s = finishReview(
      rateReview(startReview(s, [card.id], "r1", now - 2 * DAY), 2),
      now - 2 * DAY,
    );
    expect(dueReviewCount(s, "en", now)).toBe(
      2 + LESSONS[0].questions.length,
    );
    expect(dueReviewCount(s, "ja", now)).toBe(0);
    expect(dueReviewCount(null, "en", now)).toBe(0);
  });
  it("resumes the freshest unfinished draft for the home card", () => {
    const card = STUDY_CARDS.find(
      (c) => c.language === "en" && c.source === "vocabulary",
    )!;
    expect(learningResumeSearch(null)).toBeUndefined();
    const s = createJournal(now);
    expect(learningResumeSearch(s)).toBeUndefined();
    s.reviewDraft = {
      id: "r1",
      startedAt: now - 1000,
      cards: [card.id],
      ratings: [],
    };
    expect(learningResumeSearch(s)).toEqual({ tab: "review" });
    s.workbench = {
      version: 1,
      preferences: {},
      rounds: [],
      days: [],
      difficulty: [],
      words: [],
      draft: {
        id: "a1",
        kind: "practice",
        target: LESSONS[0].id,
        items: ["x1"],
        answers: [],
        startedAt: now,
      },
    };
    expect(learningResumeSearch(s)).toEqual({
      tab: "today",
      concept: LESSONS[0].id,
      activity: "practice",
    });
    s.draft = { lessonId: LESSONS[0].id, startedAt: now - 500, answers: [0] };
    expect(learningResumeSearch(s)).toEqual({
      tab: "today",
      concept: LESSONS[0].id,
      activity: "practice",
    });
    s.draft = { ...s.draft, startedAt: now + 500 };
    expect(learningResumeSearch(s)).toEqual({ lesson: LESSONS[0].id });
  });
  it("bounds long-running intervals and easiness", () => {
    let s = createJournal(now),
      at = now;
    for (let i = 0; i < 60; i++) {
      s = round(s, at);
      at = studyProgress(s)[LESSONS[0].id].dueAt;
    }
    expect(studyProgress(s)[LESSONS[0].id].interval).toBe(365);
    expect(studyProgress(s)[LESSONS[0].id].efactor).toBeLessThanOrEqual(3);
  });
});

it("preserves completed history while accepting offline batches and book/draft changes", () => {
  const initial = round(createJournal(now), now);
  const incoming = {
    ...round(round(initial, now + DAY), now + 2 * DAY),
    bookPage: 35,
  };
  expect(updateJournal(initial, incoming)).toEqual(incoming);
  expect(updateJournal(incoming, initial)).toBeNull();
  const rewritten = structuredClone(incoming);
  rewritten.events[0].answers[0] = 2;
  expect(updateJournal(initial, rewritten)).toBeNull();
  expect(
    updateJournal(initial, { ...incoming, startedAt: now - 1 }),
  ).toBeNull();
});

it("rejects corrupt, oversized, unknown, incomplete and future records; ignores extra fields", () => {
  vi.spyOn(Date, "now").mockReturnValue(now);
  try {
    const s = round(createJournal(now), now);
    expect(
      parseJournal(
        JSON.stringify({ ...s, score: 999, tenantId: "someone-else" }),
      ),
    ).toEqual(s);
    for (const bad of [
      null,
      "{",
      JSON.stringify({ ...s, course: "unknown" }),
      JSON.stringify({ ...s, bookPage: BOOK.pages + 1 }),
      JSON.stringify({ ...s, startedAt: now + 60000 }),
      JSON.stringify({ ...s, draft: undefined }),
      JSON.stringify({ ...s, events: [...s.events, ...s.events] }),
      JSON.stringify({
        ...s,
        events: [{ ...s.events[0], lessonId: "missing" }],
      }),
      JSON.stringify({ ...s, events: [{ ...s.events[0], at: now + 60000 }] }),
      JSON.stringify({ ...s, events: [{ ...s.events[0], answers: [0] }] }),
      JSON.stringify({
        ...s,
        draft: { lessonId: LESSONS[0].id, startedAt: now - 1, answers: [] },
      }),
      JSON.stringify({
        ...s,
        draft: { lessonId: LESSONS[0].id, startedAt: now + 60000, answers: [] },
      }),
      " ".repeat(2000001),
    ])
      expect(parseJournal(bad)).toBeNull();
    expect(s.course).toBe(COURSE_VERSION);
  } finally {
    vi.restoreAllMocks();
  }
});

it("suggests the stalest due lesson, then the first unstudied one", () => {
  const en = courseLessons("en");
  let s = createJournal(now);
  // A fresh journal walks the course in order.
  expect(nextLessonSuggestion(s, "en", undefined, now)?.id).toBe(en[0].id);
  expect(nextLessonSuggestion(s, "en", en[0].id, now)?.id).toBe(en[1].id);
  // Everything studied moments ago: nothing due, nothing left.
  for (const lesson of en) s = round(s, now, 4, lesson);
  expect(nextLessonSuggestion(s, "en", undefined, now)).toBeNull();
});

it("prefers an overdue lesson over unstudied ones and orders by staleness", () => {
  const en = courseLessons("en");
  let s = createJournal(now - 20 * DAY);
  s = round(s, now - 20 * DAY, 4, en[0]); // due ~19 days ago
  s = round(s, now - 5 * DAY, 4, en[1]); // due ~4 days ago
  s = round(s, now, 4, en[2]); // not due
  expect(nextLessonSuggestion(s, "en", undefined, now)?.id).toBe(en[0].id);
  // The just-finished lesson is never suggested back to itself.
  expect(nextLessonSuggestion(s, "en", en[0].id, now)?.id).toBe(en[1].id);
  // With all studied lessons excluded by recency, the first gap wins.
  let t = createJournal(now - 10 * DAY);
  t = round(t, now - 10 * DAY, 4, en[0]);
  expect(nextLessonSuggestion(t, "en", en[0].id, now)?.id).toBe(en[1].id);
});

it("marks a saved draft as in progress ahead of the scheduled labels", () => {
  const lesson = LESSONS[0];
  let s = createJournal(now);
  expect(
    lessonCardStatus(undefined, s.draft?.lessonId, lesson.id, now),
  ).toBe("notStarted");
  s = answerLesson(
    startLesson(s, lesson.id, now),
    lesson.questions[0].answer,
  );
  expect(
    lessonCardStatus(undefined, s.draft?.lessonId, lesson.id, now),
  ).toBe("draft");
  // A draft on another lesson does not relabel this card.
  expect(
    lessonCardStatus(undefined, s.draft?.lessonId, LESSONS[1].id, now),
  ).toBe("notStarted");
  const finished = round(createJournal(now), now, 2, lesson);
  const p = studyProgress(finished)[lesson.id];
  expect(lessonCardStatus(p, null, lesson.id, now)).toBe("needsPractice");
  expect(lessonCardStatus(p, null, lesson.id, now + DAY)).toBe("due");
  const learned = studyProgress(round(createJournal(now), now, 4, lesson))[
    lesson.id
  ];
  expect(lessonCardStatus(learned, null, lesson.id, now)).toBe("learned");
  // A fresh draft outranks even a due label.
  const redraft = startLesson(finished, lesson.id, now);
  expect(
    lessonCardStatus(p, redraft.draft?.lessonId, lesson.id, now + DAY),
  ).toBe("draft");
});

it("keeps the documented journal capacity within the request limit", () => {
  const s = round(createJournal(now), now);
  s.events = Array.from({ length: MAX_STUDY_EVENTS }, (_, i) => ({
    ...s.events[0],
    id: `round-${i}`,
  }));
  expect(
    Buffer.byteLength(JSON.stringify({ session: s, revision: 1 })),
  ).toBeLessThan(2000000);
  expect(parseJournal(JSON.stringify(s))).toEqual(s);
  expect(
    finishLesson(startLesson(s, LESSONS[0].id, now), "overflow", now).events,
  ).toHaveLength(MAX_STUDY_EVENTS);
});

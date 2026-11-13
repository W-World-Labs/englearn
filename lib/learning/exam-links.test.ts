import { expect, it } from "vitest";
import {
  EXAM_LESSON_LINKS,
  examLessonLink,
  lessonExamTargets,
  type LessonExamRoute,
} from "./exam-links";
import { courseLessons, lessonById } from "./catalog";
import { getPaper, practiceCorrect } from "@/lib/exams/catalog";
import { EXAM_ID, EXAM_ID_02, SECTIONS, isCorrect } from "@/lib/ielts/exam";
import { knownFeedbackQuestion } from "@/lib/api/learning-feedback";
it("links only versioned, supported concepts in the original item context and never changes marking", () => {
  const languages = new Set();
  for (const [ref, link] of Object.entries(EXAM_LESSON_LINKS)) {
    expect(knownFeedbackQuestion(ref)).toBe(true);
    const lesson = lessonById(link.lessonId)!;
    expect(lesson).toBeDefined();
    languages.add(lesson.language);
    if (ref.startsWith("e:")) {
      const [paper, id] = ref.slice(2).split(":"),
        p = getPaper(paper)!,
        q = p.questions.find((q) => q.id === id)!;
      expect(p.language.slice(0, 2)).toBe(lesson.language);
      expect(JSON.stringify(q)).toContain(link.anchor);
      const snapshot = JSON.stringify(q);
      expect(practiceCorrect(q, q.answer)).toBe(true);
      expect(practiceCorrect(q, "")).toBe(false);
      expect(JSON.stringify(q)).toBe(snapshot);
    } else {
      const q = Object.values(SECTIONS)
        .flatMap((s) => s.questions)
        .find((q) => q.id === ref.slice(2))!;
      const part = Object.values(SECTIONS)
        .flatMap((s) => s.parts)
        .find((p) => p.id === q.partId)!;
      expect(JSON.stringify([q, part]).toLowerCase()).toContain(
        link.anchor.toLowerCase(),
      );
      expect(lesson.language).toBe("en");
      expect(isCorrect(q, q.answers[0])).toBe(true);
    }
  }
  expect([...languages].sort()).toEqual(["en", "ja", "ko", "zh"]);
  expect(EXAM_LESSON_LINKS["e:hsk-1-01-v1:r2"]).toBeUndefined();
});

function examQuestionFor(ref: string) {
  const [paper, id] = ref.slice(2).split(":");
  return getPaper(paper)?.questions.find((q) => q.id === id);
}
function ieltsItemFor(ref: string) {
  const id = ref.slice(2);
  const q = Object.values(SECTIONS)
    .flatMap((section) => section.questions)
    .find((question) => question.id === id);
  const part = Object.values(SECTIONS)
    .flatMap((section) => section.parts)
    .find((candidate) => candidate.id === q?.partId);
  return { q, part };
}
const FAMILY_BY_PREFIX: Array<[string, string]> = [
  ["e:hsk", "zh"],
  ["e:topik", "ko"],
  ["e:jlpt", "ja"],
  ["i:", "en"],
];
function examFamily(ref: string) {
  return FAMILY_BY_PREFIX.find(([prefix]) => ref.startsWith(prefix))?.[1];
}

it("pins every anchor to its linked exam item text", () => {
  for (const [ref, link] of Object.entries(EXAM_LESSON_LINKS)) {
    if (ref.startsWith("e:")) {
      const question = examQuestionFor(ref);
      expect(question, `${ref} resolves to an exam question`).toBeDefined();
      expect(JSON.stringify(question), `${ref} anchor`).toContain(link.anchor);
    } else {
      const { q, part } = ieltsItemFor(ref);
      expect(q, `${ref} question`).toBeDefined();
      expect(part, `${ref} part`).toBeDefined();
      expect(JSON.stringify([q, part]).toLowerCase(), `${ref} anchor`).toContain(
        link.anchor.toLowerCase(),
      );
    }
  }
});

it("pins every anchor to its linked lesson text", () => {
  for (const [ref, link] of Object.entries(EXAM_LESSON_LINKS)) {
    const lesson = lessonById(link.lessonId);
    expect(lesson, `${ref} resolves to a lesson`).toBeDefined();
    const text = [
      lesson!.title.en,
      lesson!.title.zh,
      lesson!.explanation.en,
      lesson!.explanation.zh,
      ...lesson!.examples,
      ...lesson!.questions.flatMap((q) => [q.prompt, ...q.choices]),
    ].join("\n");
    expect(text, `${ref} anchor in ${link.lessonId} text`).toContain(
      link.anchor,
    );
  }
});

it("resolves every link to a real lesson whose language matches the exam family", () => {
  for (const [ref, link] of Object.entries(EXAM_LESSON_LINKS)) {
    const lesson = lessonById(link.lessonId);
    expect(lesson, `${ref} -> ${link.lessonId}`).toBeDefined();
    const family = examFamily(ref);
    expect(family, `${ref} family`).toBeDefined();
    expect(lesson!.language, `${ref} lesson language`).toBe(family);
    expect(
      lesson!.questions.length,
      `${ref} lesson has authored questions`,
    ).toBeGreaterThan(0);
  }
});

it("builds a reverse lesson-to-exam index with no orphan links", () => {
  const reverse = new Map<string, string[]>();
  for (const [ref, link] of Object.entries(EXAM_LESSON_LINKS)) {
    const linked = reverse.get(link.lessonId) ?? [];
    linked.push(ref);
    reverse.set(link.lessonId, linked);
  }
  const refs = Object.keys(EXAM_LESSON_LINKS);
  expect(reverse.size, "linked lessons").toBeGreaterThan(0);
  expect([...reverse.values()].flat().sort()).toEqual([...refs].sort());
  for (const [lessonId, linked] of reverse) {
    expect(lessonById(lessonId), `orphan lesson ${lessonId}`).toBeDefined();
    expect(linked.length, `${lessonId} links`).toBeGreaterThan(0);
    for (const ref of linked)
      expect(EXAM_LESSON_LINKS[ref].lessonId, ref).toBe(lessonId);
  }
});

it("derives link counts from the data instead of hardcoding them", () => {
  const refs = Object.keys(EXAM_LESSON_LINKS);
  expect(refs.length, "links").toBeGreaterThan(0);
  expect(new Set(refs).size, "unique refs").toBe(refs.length);
  const resolvable = refs.filter((ref) => knownFeedbackQuestion(ref));
  expect(resolvable, "resolvable refs").toHaveLength(refs.length);
  const lessons = new Set(refs.map((ref) => EXAM_LESSON_LINKS[ref].lessonId));
  expect(lessons.size, "distinct lessons").toBeGreaterThan(0);
  expect(lessons.size, "lessons <= links").toBeLessThanOrEqual(refs.length);
});

it("keeps anchors and lesson ids non-empty and bounded", () => {
  for (const [ref, link] of Object.entries(EXAM_LESSON_LINKS)) {
    expect(ref.length, `${ref} key`).toBeGreaterThan(0);
    expect(link.lessonId.trim().length, `${ref} lessonId`).toBeGreaterThan(0);
    expect(typeof link.anchor, `${ref} anchor type`).toBe("string");
    expect(link.anchor.trim().length, `${ref} anchor`).toBeGreaterThan(0);
    expect(link.anchor.length, `${ref} anchor length`).toBeLessThanOrEqual(50);
  }
});

it("gates IELTS links to the authored practice set while language-exam links always resolve", () => {
  const refs = Object.keys(EXAM_LESSON_LINKS);
  const ieltsRef = refs.find((ref) => ref.startsWith("i:"))!;
  const examRef = refs.find((ref) => ref.startsWith("e:"))!;
  // Context-free callers (reverse index, e: refs) resolve against set 01.
  expect(examLessonLink(ieltsRef)).toEqual(EXAM_LESSON_LINKS[ieltsRef]);
  expect(examLessonLink(ieltsRef, EXAM_ID)).toEqual(
    EXAM_LESSON_LINKS[ieltsRef],
  );
  // Another set — or any unknown set — must never resolve a foreign question.
  expect(examLessonLink(ieltsRef, EXAM_ID_02)).toBeUndefined();
  expect(examLessonLink(ieltsRef, "academic-practice-99-v1")).toBeUndefined();
  expect(examLessonLink(examRef)).toEqual(EXAM_LESSON_LINKS[examRef]);
  expect(examLessonLink(examRef, EXAM_ID_02)).toEqual(
    EXAM_LESSON_LINKS[examRef],
  );
  expect(examLessonLink("i:missing")).toBeUndefined();
  expect(examLessonLink("e:missing:q1")).toBeUndefined();
  expect(examLessonLink("")).toBeUndefined();
});

const ROUTE_LANGUAGE: Record<LessonExamRoute, string> = {
  topik: "ko",
  hsk: "zh",
  jlpt: "ja",
  ielts: "en",
};

it("maps each linked lesson to its exam workspace routes without duplicates", () => {
  expect(lessonExamTargets("zh-concession")).toEqual(["hsk"]);
  expect(lessonExamTargets("zh-classifiers")).toEqual(["hsk"]);
  expect(lessonExamTargets("ko-locations")).toEqual(["topik"]);
  expect(lessonExamTargets("ja-objects-places")).toEqual(["jlpt"]);
  expect(lessonExamTargets("en-passive")).toEqual(
    EXAM_ID === "academic-practice-01-v1" ? ["ielts"] : [],
  );
  expect(lessonExamTargets(courseLessons("es")[0].id)).toEqual([]);
  const linked = new Set(
    Object.values(EXAM_LESSON_LINKS).map((link) => link.lessonId),
  );
  for (const lessonId of linked) {
    const lesson = lessonById(lessonId)!;
    const routes = lessonExamTargets(lessonId);
    expect(routes.length, `${lessonId} routes`).toBeGreaterThan(0);
    for (const route of routes)
      expect(lesson.language, `${lessonId} -> ${route}`).toBe(
        ROUTE_LANGUAGE[route],
      );
  }
});

it("accepts every linked ref as a known feedback question and rejects unknown refs", () => {
  for (const ref of Object.keys(EXAM_LESSON_LINKS))
    expect(knownFeedbackQuestion(ref), ref).toBe(true);
  expect(knownFeedbackQuestion("e:no-such-paper:q1")).toBe(false);
  expect(knownFeedbackQuestion("i:no-such-question")).toBe(false);
  expect(knownFeedbackQuestion("")).toBe(false);
});

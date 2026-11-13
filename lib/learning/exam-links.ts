import { EXAM_ID } from "@/lib/ielts/exam";
import { getPaper } from "@/lib/exams/catalog";
/** Explicit, version-specific links. Related grammar is practice support, not a diagnosis of why an exam answer was wrong. */
export const EXAM_LESSON_LINKS: Record<
  string,
  { lessonId: string; anchor: string }
> = {
  "e:hsk-1-01-v1:r5": { lessonId: "zh-classifiers", anchor: "书" },
  "e:hsk-2-01-v1:r1": { lessonId: "zh-comparison", anchor: "高" },
  "e:hsk-2-01-v1:r7": { lessonId: "zh-experience", anchor: "经历" },
  "e:topik-i-01-v1:r1": { lessonId: "ko-locations", anchor: "학교" },
  "e:topik-i-01-v1:r6": { lessonId: "ko-ongoing", anchor: "고 있다" },
  "e:jlpt-n5-01-v1:g2": { lessonId: "ja-polite-past", anchor: "ました" },
  "e:jlpt-n5-01-v1:g5": { lessonId: "ja-objects-places", anchor: "勉強します" },
  "e:jlpt-n4-01-v1:g5": { lessonId: "ja-experience", anchor: "あります" },
  "e:jlpt-n2-01-v1:g2": {
    lessonId: "ja-partial-negation",
    anchor: "わけではない",
  },
  "i:q6": { lessonId: "en-comparison", anchor: "more" },
  "i:q8": { lessonId: "en-comparison", anchor: "than" },
  "i:q9": { lessonId: "en-passive", anchor: "be" },
  "i:q14": { lessonId: "en-passive", anchor: "be" },
  "i:l12": { lessonId: "en-passive", anchor: "by" },
  "e:topik-i-02-v1:g1": { lessonId: "ko-locations", anchor: "에서" },
  "e:topik-i-02-v1:g2": { lessonId: "ko-reasons", anchor: "니까" },
  "e:topik-ii-02-v1:g2": { lessonId: "ko-contrast", anchor: "반면에" },
  "e:topik-ii-02-v1:g6": { lessonId: "ko-no-choice", anchor: "수밖에 없" },
  "e:hsk-1-02-v1:r7": { lessonId: "zh-classifiers", anchor: "量词" },
  "e:hsk-2-02-v1:r3": { lessonId: "zh-comparison", anchor: "比我" },
  "e:hsk-2-02-v1:r10": { lessonId: "zh-experience", anchor: "经历" },
  "e:hsk-3-02-v1:r5": { lessonId: "zh-scope", anchor: "全部" },
  "e:hsk-3-02-v1:r13": { lessonId: "zh-concession", anchor: "虽然" },
  "e:hsk-4-02-v1:r1": { lessonId: "zh-regardless", anchor: "条件" },
  "e:hsk-5-02-v1:r6": { lessonId: "zh-concession", anchor: "转折" },
  "e:hsk-6-02-v1:r8": { lessonId: "zh-concession", anchor: "虽然" },
  "e:jlpt-n5-02-v1:g4": { lessonId: "ja-objects-places", anchor: "あります" },
  "e:jlpt-n5-02-v1:g5": { lessonId: "ja-polite-past", anchor: "でした" },
  "e:jlpt-n4-02-v1:g1": { lessonId: "ja-reasons", anchor: "から" },
  "e:hsk-1-01-v1:l2": { lessonId: "zh-location", anchor: "学校" },
  "e:hsk-1-01-v1:r7": { lessonId: "zh-location", anchor: "桌子" },
  "e:hsk-1-02-v1:r10": { lessonId: "zh-location", anchor: "下面" },
  "e:hsk-2-02-v1:r2": { lessonId: "zh-location", anchor: "在" },
  "e:hsk-3-01-v1:r7": { lessonId: "zh-proportion", anchor: "越来越" },
  "e:jlpt-n3-02-v1:g6": { lessonId: "ja-proportion", anchor: "ほど" },
  "e:jlpt-n3-02-v1:g7": { lessonId: "ja-adjectives", anchor: "静か" },
  "e:jlpt-n4-02-v1:v3": { lessonId: "ja-potential", anchor: "読め" },
  "e:jlpt-n4-02-v1:g4": { lessonId: "ja-potential", anchor: "読める" },
  "e:topik-i-01-v1:l2": { lessonId: "ko-negation", anchor: "안 " },
  "e:topik-i-02-v1:g4": { lessonId: "ko-future", anchor: "거예요" },
  "e:topik-ii-01-v1:r5": {
    lessonId: "ko-proportion",
    anchor: "-(으)ㄹ수록",
  },
  "e:hsk-3-01-v1:r3": { lessonId: "zh-purpose", anchor: "为了" },
  "e:hsk-6-01-v1:l5": { lessonId: "zh-purpose", anchor: "为了" },
  "e:hsk-3-02-v1:r2": { lessonId: "zh-purpose", anchor: "为了" },
  "e:jlpt-n4-01-v1:g3": { lessonId: "ja-permission", anchor: "てもいい" },
  "e:jlpt-n3-01-v1:g2": { lessonId: "ja-purpose", anchor: "ように" },
  "e:jlpt-n3-01-v1:g4": { lessonId: "ja-guess", anchor: "はず" },
  "e:jlpt-n2-02-v1:g4": { lessonId: "ja-guess", anchor: "に違いない" },
  "e:jlpt-n1-01-v1:g3": { lessonId: "ja-purpose", anchor: "ために" },
  "e:topik-i-01-v1:r4": { lessonId: "ko-purpose", anchor: "려고" },
  "e:topik-i-01-v1:r5": { lessonId: "ko-purpose", anchor: "려고" },
  "e:hsk-1-01-v1:r1": { lessonId: "zh-demonstratives", anchor: "这" },
  "e:hsk-3-01-v1:w2": { lessonId: "zh-demonstratives", anchor: "那本" },
  "e:hsk-1-01-v1:l1": { lessonId: "zh-time", anchor: "几点" },
  "e:hsk-2-01-v1:l1": { lessonId: "zh-time", anchor: "几点" },
  "e:hsk-2-01-v1:r5": { lessonId: "zh-time", anchor: "星期" },
  "e:hsk-2-02-v1:r1": { lessonId: "zh-time", anchor: "点" },
  "e:hsk-3-02-v1:r11": { lessonId: "zh-time", anchor: "星期" },
  "e:hsk-4-02-v1:r9": { lessonId: "zh-time", anchor: "点" },
  "e:hsk-6-01-v1:r1": { lessonId: "zh-causative", anchor: "使" },
  "e:hsk-6-01-v1:l4": { lessonId: "zh-causative", anchor: "使" },
  "e:hsk-3-02-v1:r6": { lessonId: "zh-ba", anchor: "把" },
  "e:hsk-3-02-v1:r7": { lessonId: "zh-bei", anchor: "被" },
  "e:jlpt-n4-01-v1:g1": { lessonId: "ja-conditionals", anchor: "たら" },
  "e:jlpt-n3-02-v1:r6": { lessonId: "ja-conditionals", anchor: "たら" },
  "e:jlpt-n2-01-v1:g5": { lessonId: "ja-conditionals", anchor: "なら" },
  "e:jlpt-n3-02-v1:g4": { lessonId: "ja-hearsay", anchor: "らしい" },
  "e:jlpt-n5-01-v1:l1": { lessonId: "ja-time", anchor: "何時" },
  "e:jlpt-n5-01-v1:r1": { lessonId: "ja-time", anchor: "曜日" },
  "e:jlpt-n4-01-v1:l2": { lessonId: "ja-time", anchor: "曜日" },
  "e:jlpt-n5-02-v1:r4": { lessonId: "ja-time", anchor: "何時" },
  "e:jlpt-n3-01-v1:r5": { lessonId: "ja-time", anchor: "水曜日" },
  "e:jlpt-n4-02-v1:r6": { lessonId: "ja-time", anchor: "日曜日" },
  "e:jlpt-n1-02-v1:v3": { lessonId: "ja-causative", anchor: "させ" },
  "e:topik-ii-01-v1:r2": { lessonId: "ko-conditionals", anchor: "으면" },
  "e:topik-ii-02-v1:r8": { lessonId: "ko-conditionals", anchor: "면" },
  "e:topik-ii-01-v1:l3": { lessonId: "ko-causative", anchor: "게 만" },
  "e:topik-ii-01-v1:l2": { lessonId: "ko-hearsay", anchor: "다고" },
  "e:topik-ii-02-v1:r5": { lessonId: "ko-relatives", anchor: "은" },
  "e:topik-i-01-v1:l1": { lessonId: "ko-time", anchor: "요일" },
  "e:topik-i-01-v1:r3": { lessonId: "ko-time", anchor: "요일" },
  "e:topik-i-02-v1:r1": { lessonId: "ko-time", anchor: "요일" },
  "e:topik-i-02-v1:r5": { lessonId: "ko-time", anchor: "시간" },
  "e:topik-ii-02-v1:r6": { lessonId: "ko-time", anchor: "수요일" },
  "e:hsk-3-01-v1:r4": { lessonId: "zh-concession", anchor: "虽然" },
  "e:hsk-4-01-v1:l1": { lessonId: "zh-concession", anchor: "虽然" },
  "e:hsk-5-01-v1:l4": { lessonId: "zh-concession", anchor: "虽然" },
  "e:hsk-5-01-v1:l1": { lessonId: "zh-purpose", anchor: "为了" },
  "e:hsk-3-02-v1:r9": { lessonId: "zh-concession", anchor: "虽然" },
  "e:hsk-3-02-v1:r12": { lessonId: "zh-concession", anchor: "虽然" },
  "e:hsk-4-02-v1:r6": { lessonId: "zh-proportion", anchor: "越来越" },
  "e:hsk-4-02-v1:r11": { lessonId: "zh-concession", anchor: "虽然" },
  "e:hsk-5-02-v1:r8": { lessonId: "zh-concession", anchor: "虽然" },
  "e:hsk-6-02-v1:r2": { lessonId: "zh-concession", anchor: "虽然" },
  "e:hsk-6-02-v1:r3": { lessonId: "zh-proportion", anchor: "越来越" },
  "e:jlpt-n1-01-v1:l1": { lessonId: "ja-guess", anchor: "はず" },
  "e:jlpt-n1-01-v1:l5": { lessonId: "ja-guess", anchor: "はず" },
  "e:jlpt-n4-02-v1:g6": { lessonId: "ja-guess", anchor: "はず" },
  "e:jlpt-n2-02-v1:g3": { lessonId: "ja-hearsay", anchor: "らしい" },
  "e:jlpt-n1-02-v1:g4": { lessonId: "ja-hearsay", anchor: "らしい" },
  "e:jlpt-n1-02-v1:g3": { lessonId: "ja-purpose", anchor: "ように" },
  "e:jlpt-n2-02-v1:r5": { lessonId: "ja-purpose", anchor: "ように" },
  "e:jlpt-n1-01-v1:r2": { lessonId: "ja-purpose", anchor: "ように" },
  "e:topik-i-01-v1:l4": { lessonId: "ko-locations", anchor: "에서" },
  "e:topik-i-01-v1:r7": { lessonId: "ko-locations", anchor: "에서" },
  "e:topik-i-01-v1:r8": { lessonId: "ko-locations", anchor: "에서" },
  "e:topik-ii-01-v1:l5": { lessonId: "ko-conditionals", anchor: "으면" },
  "e:topik-ii-01-v1:l6": { lessonId: "ko-conditionals", anchor: "으면" },
  "e:topik-i-02-v1:v1": { lessonId: "ko-locations", anchor: "에서" },
  "e:topik-i-02-v1:v2": { lessonId: "ko-locations", anchor: "에서" },
  "e:topik-i-02-v1:r2": { lessonId: "ko-locations", anchor: "에서" },
  "e:topik-i-02-v1:r3": { lessonId: "ko-locations", anchor: "에서" },
  "e:topik-ii-02-v1:r1": { lessonId: "ko-locations", anchor: "에서" },
  "e:topik-ii-02-v1:r2": { lessonId: "ko-locations", anchor: "에서" },
};

/**
 * `i:` refs are authored against Practice 01 question ids and carry no set
 * qualifier, so callers must pass the session's examId — a different set can
 * never resolve a foreign question to a lesson.
 */
export function examLessonLink(ref: string, examId: string = EXAM_ID) {
  if (ref.startsWith("i:") && examId !== EXAM_ID) return undefined;
  return EXAM_LESSON_LINKS[ref];
}

export type LessonExamRoute = "topik" | "hsk" | "jlpt" | "ielts";

/**
 * Exam workspaces that practise this lesson's concept, in link-table order
 * and deduplicated per workspace route.
 */
export function lessonExamTargets(lessonId: string): LessonExamRoute[] {
  const routes: LessonExamRoute[] = [];
  for (const ref of Object.keys(EXAM_LESSON_LINKS)) {
    if (EXAM_LESSON_LINKS[ref].lessonId !== lessonId || !examLessonLink(ref))
      continue;
    const route: LessonExamRoute | undefined = ref.startsWith("i:")
      ? "ielts"
      : getPaper(ref.slice(2).split(":")[0])?.family;
    if (route && !routes.includes(route)) routes.push(route);
  }
  return routes;
}

import { localizedText } from "@/lib/i18n/localized";
import topik from "@/data/exams/topik.json";
import hsk from "@/data/exams/hsk.json";
import jlpt from "@/data/exams/jlpt.json";
export type ExamFamily = "topik" | "hsk" | "jlpt";
export type PracticeSection =
  | "listening"
  | "reading"
  | "writing"
  | "vocabulary"
  | "grammar_reading"
  | "language_reading";
export type PracticeMode = "all" | PracticeSection;
export interface Explanation {
  zh: string;
  en: string;
  ja?: string;
}
export interface PracticeQuestion {
  id: string;
  section: PracticeSection;
  kind: "choice" | "gap" | "order" | "writing";
  prompt: string;
  passage?: string;
  script?: string;
  picture?: string;
  pictureLabel?: string;
  table?: { caption: string; columns: string[]; rows: string[][] };
  options?: string[];
  answer?: string;
  accepted?: string[];
  explanation: Explanation;
  minChars?: number;
  maxChars?: number;
  readSeconds?: number;
}
export interface PracticePaper {
  id: string;
  family: ExamFamily;
  label: string;
  level: string;
  language: "ko-KR" | "zh-CN" | "ja-JP";
  format: string;
  description: Explanation;
  sections: { id: PracticeSection; minutes: number }[];
  questions: PracticeQuestion[];
  tips: { pattern: string; example: string; meaning: Explanation }[];
}
export const PAPERS = [...topik, ...hsk, ...jlpt] as PracticePaper[];
export function getPaper(id: string) {
  return PAPERS.find((paper) => paper.id === id);
}
export function papersFor(family: ExamFamily) {
  return PAPERS.filter((paper) => paper.family === family);
}
export function practiceSections(paper: PracticePaper, mode: PracticeMode) {
  return paper.sections.filter((s) => mode === "all" || s.id === mode);
}
export function normalizePracticeAnswer(answer: string) {
  return answer
    .normalize("NFKC")
    .trim()
    .replace(/[\s，。！？、,.!?]+/gu, "")
    .toLowerCase();
}
export function practiceCorrect(
  question: PracticeQuestion,
  answer: string = "",
) {
  if (question.kind === "writing" || !answer.trim()) return false;
  return [question.answer, ...(question.accepted ?? [])].some(
    (a) =>
      a !== undefined &&
      normalizePracticeAnswer(a) === normalizePracticeAnswer(answer),
  );
}
export function characterCount(
  text: string,
  language: PracticePaper["language"],
) {
  return language === "zh-CN"
    ? (text.match(/\p{Script=Han}/gu) ?? []).length
    : [...text.replace(/\r?\n/g, "")].length;
}

/** Stored choice keys stay A–D; JLPT presents numbered answer choices. */
export function practiceOptionLabel(language: string, index: number) {
  return language === "ja-JP"
    ? String(index + 1)
    : String.fromCharCode(65 + index);
}
export function explanationFor(text: Explanation, locale: string) {
  return localizedText(text, locale) ?? text.en;
}
export function practiceAnswerText(
  question: PracticeQuestion,
  answer: string,
  language: string,
) {
  if (!answer || question.kind !== "choice") return answer;
  const index = answer.charCodeAt(0) - 65;
  return `${practiceOptionLabel(language, index)} · ${question.options?.[index] ?? ""}`;
}

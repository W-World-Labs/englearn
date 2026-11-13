import data from "@/data/learning/grammar-v1.json";
import { DEDICATED_LANGUAGE_IDS } from "@/lib/i18n/languages";
export const LEARNING_LANGUAGES = DEDICATED_LANGUAGE_IDS;
export type LearningLanguage = (typeof LEARNING_LANGUAGES)[number];
export type StudyLocale = "en" | "zh";
export type StudyText = Record<StudyLocale, string>;
export const STAGES = ["foundation", "intermediate", "advanced"] as const;
export type Stage = (typeof STAGES)[number];
export interface Lesson {
  id: string;
  language: LearningLanguage;
  stage: Stage;
  title: StudyText;
  explanation: StudyText;
  examples: string[];
  questions: { prompt: string; choices: string[]; answer: number }[];
}
export const COURSE_CONTENT = data;
export const COURSE_VERSION = "grammar-v1";
export const LESSONS = data.lessons as Lesson[];
const byId = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));
export function lessonById(id: string) {
  return byId.get(id);
}
export function courseLessons(language: string, stage?: Stage) {
  // Stage order is structural, not positional: later lessons are appended
  // to the data file, so group by stage instead of relying on file order.
  return LESSONS.filter(
    (l) => l.language === language && (!stage || l.stage === stage),
  ).sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage));
}

export const BOOK = {
  id: "brehe-grammar",
  title: "Brehe’s Grammar Anatomy",
  author: "Steven Brehe",
  publisher: "University System of Georgia · University of North Georgia Press",
  source: "https://ung.edu/university-press/books/grammar-anatomy.php",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  pages: 340,
  file: "brehes-grammar-anatomy.pdf",
  sha256: "c757c4641bc390b2ba787adb4b6db65148eb88b0ad7056857b97e10a154168b7",
};

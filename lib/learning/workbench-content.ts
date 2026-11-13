import variants from "@/data/learning/variants-v1.json";
import readings from "@/data/learning/readings-v1.json";
import {
  lessonById,
  type LearningLanguage,
  type Stage,
  type StudyText,
} from "./catalog";
export interface VariantQuestion {
  id: string;
  lessonId: string;
  purpose: "practice" | "retest";
  prompt: string;
  choices: string[];
  answer: number;
}
export const VARIANTS = variants.items as VariantQuestion[];
const byId = new Map(VARIANTS.map((q) => [q.id, q]));
export const variantById = (id: string) => byId.get(id);
export const conceptVariants = (
  id: string,
  purpose: VariantQuestion["purpose"],
) =>
  lessonById(id)
    ? VARIANTS.filter((q) => q.lessonId === id && q.purpose === purpose)
    : [];
export interface GradedText {
  id: string;
  language: LearningLanguage;
  stage: Stage;
  title: StudyText;
  sentences: { text: string; explanation: StudyText }[];
  questions: {
    id: string;
    prompt: string;
    choices: string[];
    answer: number;
  }[];
  words: { id: string; word: string; meaning: StudyText }[];
}
export const GRADED_TEXTS = readings.items as GradedText[];
export const gradedText = (id: string) => GRADED_TEXTS.find((t) => t.id === id);
export const readingWord = (id: string) =>
  GRADED_TEXTS.flatMap((t) => t.words).find((w) => w.id === id);

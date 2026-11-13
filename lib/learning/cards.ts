import {
  LESSONS,
  lessonById,
  type LearningLanguage,
  type Stage,
  type StudyText,
} from "./catalog";
import { WORDS } from "@/lib/vocabulary/bank";
import { GRADED_TEXTS, VARIANTS } from "./workbench-content";

export interface StudyCard {
  id: string;
  language: LearningLanguage;
  source: "grammar" | "vocabulary" | "reading";
  stage: Stage;
  title: StudyText;
  front: string;
  choices: string[];
  answer: StudyText;
  explanation: StudyText;
  examples: string[];
  lessonId?: string;
}
export const STUDY_CARDS: StudyCard[] = [
  ...LESSONS.flatMap((lesson) =>
    lesson.questions.map((q, index) => ({
      id: `g:${lesson.id}:${index}`,
      language: lesson.language,
      source: "grammar" as const,
      stage: lesson.stage,
      title: lesson.title,
      front: q.prompt,
      choices: q.choices,
      answer: { en: q.choices[q.answer], zh: q.choices[q.answer] },
      explanation: lesson.explanation,
      examples: lesson.examples,
      lessonId: lesson.id,
    })),
  ),
  ...WORDS.map((word) => ({
    id: `v:${word.id}`,
    language: word.language,
    source: "vocabulary" as const,
    stage: (word.band === 0
      ? "foundation"
      : word.band < 3
        ? "intermediate"
        : "advanced") as Stage,
    title: { en: word.word, zh: word.word },
    front: word.word,
    choices: [],
    answer: word.meaning,
    explanation: {
      en: `${word.pos} · Frequency band ${word.band + 1}`,
      zh: `${word.pos} · 词频区间 ${word.band + 1}`,
    },
    examples: [],
  })),
  // Reserved delayed questions are excluded from recall and exports until their one-time check.
  ...VARIANTS.filter((q) => q.purpose === "practice").map((q) => {
    const lesson = lessonById(q.lessonId)!;
    return {
      id: "x:" + q.id,
      language: lesson.language,
      source: "grammar" as const,
      stage: lesson.stage,
      title: lesson.title,
      front: q.prompt,
      choices: q.choices,
      answer: { en: q.choices[q.answer], zh: q.choices[q.answer] },
      explanation: lesson.explanation,
      examples: lesson.examples,
      lessonId: lesson.id,
    };
  }),
  ...GRADED_TEXTS.flatMap((text) =>
    text.words.map((word) => ({
      id: word.id,
      language: text.language,
      source: "reading" as const,
      stage: text.stage,
      title: { en: word.word, zh: word.word },
      front: word.word,
      choices: [],
      answer: word.meaning,
      explanation: text.title,
      examples: text.sentences
        .filter((s) => s.text.includes(word.word))
        .map((s) => s.text),
    })),
  ),
];
const byId = new Map(STUDY_CARDS.map((card) => [card.id, card]));
export function studyCard(id: string) {
  return byId.get(id);
}
export function lessonCards(lessonId: string) {
  return STUDY_CARDS.filter((c) => c.lessonId === lessonId);
}
export const PACK_CREDIT =
  "LingoLearn original grammar lessons, readings and definitions · CC BY-SA 4.0. Vocabulary frequency data: wordfreq 3.1.1, Robyn Speer and contributors. Sources: https://llearn.myfastools.com/learn and https://llearn.myfastools.com/vocabulary-assets/NOTICE.md . Licence: https://creativecommons.org/licenses/by-sa/4.0/ . Reformatted as study materials; not a proficiency certificate.";

import { resolveContentPack, type ContentPackId } from "@/lib/items/packs";

const TARGET: Record<
  ContentPackId,
  { language: string; feedbackLanguage: string }
> = {
  en: { language: "English", feedbackLanguage: "English" },
  zh: { language: "Chinese", feedbackLanguage: "Simplified Chinese" },
  ko: { language: "Korean", feedbackLanguage: "Korean" },
  ja: { language: "Japanese", feedbackLanguage: "Japanese" },
  es: { language: "Spanish", feedbackLanguage: "Spanish" },
};

export function scoringLocale(learningLanguage?: string) {
  const pack = resolveContentPack(learningLanguage ?? "en");
  return TARGET[pack] ?? TARGET.en;
}

export function buildScoringSystemPrompt(learningLanguage?: string): string {
  const { language, feedbackLanguage } = scoringLocale(learningLanguage);
  return `You are a rigorous CEFR-aligned assessor for ${language} open responses (writing / speaking transcripts).

Rules:
- Score using the given prompt and rubric.
- Output score from 0.0 to 1.0 (1 = fully on-task, accurate, fluent).
- Consider task response, coherence, range, and accuracy.
- For speaking transcripts, tolerate disfluency; do not penalize missing punctuation alone.
- Write feedback in ${feedbackLanguage}, 2–3 sentences: one strength, one actionable improvement.`;
}

export function scoringToolDescription(learningLanguage?: string): string {
  const { feedbackLanguage } = scoringLocale(learningLanguage);
  return `Submit score 0–1 and brief feedback in ${feedbackLanguage}.`;
}
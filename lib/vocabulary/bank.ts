import data from "@/data/vocabulary/bank-v1.json";
import { DEDICATED_LANGUAGE_IDS } from "@/lib/i18n/languages";
export const VOCABULARY_LANGUAGES = DEDICATED_LANGUAGE_IDS;
export type VocabularyLanguage = (typeof VOCABULARY_LANGUAGES)[number];
export type MeaningLanguage = "en" | "zh";
export const BANK_VERSION = data.version;
export const BANDS = [
  { from: 1, to: 1000 },
  { from: 1001, to: 3000 },
  { from: 3001, to: 6000 },
  { from: 6001, to: 10000 },
];
export interface VocabularyWord {
  id: string;
  language: VocabularyLanguage;
  word: string;
  rank: number;
  band: number;
  pos: string;
  group?: string;
  meaning: Record<MeaningLanguage, string>;
}
export const WORDS = data.items as VocabularyWord[];
export function vocabularyWord(id: string) {
  return WORDS.find((word) => word.id === id);
}
export function isVocabularyLanguage(
  value: unknown,
): value is VocabularyLanguage {
  return VOCABULARY_LANGUAGES.includes(value as VocabularyLanguage);
}
export const LANGUAGE_NAMES: Record<VocabularyLanguage, string> = {
  en: "English",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  es: "Español",
};

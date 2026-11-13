/** Interface language of the app UI (extend by adding locale files). */
export type UiLocale =
  | "en"
  | "zh-CN"
  | "zh-TW"
  | "es"
  | "fr"
  | "de"
  | "ja"
  | "ko"
  | "pt"
  | "ru"
  | "ar"
  | "hi"
  | "it"
  | "vi"
  | "th"
  | "tr"
  | "id"
  | "pl"
  | "nl"
  | "he"
  | "uk"
  | "cs"
  | "ro"
  | "hu"
  | "ms"
  | "bn"
  | "fa"
  | "el"
  | "sv"
  | "no"
  | "da"
  | "fi";

/** Target language the user is learning (ISO 639-1 style id). */
export type LearningLanguageId = string;

/** How item banks are supplied for a course. */
export type ContentPack = "dedicated" | "universal";

export interface LearningLanguageMeta {
  id: LearningLanguageId;
  flag: string;
  /** BCP-47 tag for TTS / future localized items */
  locale: string;
  contentPack: ContentPack;
}

export type MessageParams = Record<string, string | number>;

export type MessageLeaf = string | string[];

export type MessageTree = {
  [key: string]: MessageLeaf | MessageTree;
};
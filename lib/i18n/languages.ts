import type {
  ContentPack,
  LearningLanguageId,
  LearningLanguageMeta,
} from "./types";

/** Curated launch list; any other ISO 639-1 code is accepted at runtime. */
export const DEDICATED_LANGUAGE_IDS = ["en", "zh", "ko", "ja", "es"] as const;

export const LEARNING_LANGUAGES: LearningLanguageMeta[] = [
  { id: "en", flag: "🇬🇧", locale: "en", contentPack: "dedicated" },
  { id: "zh", flag: "🇨🇳", locale: "zh-CN", contentPack: "dedicated" },
  { id: "ko", flag: "🇰🇷", locale: "ko", contentPack: "dedicated" },
  { id: "ja", flag: "🇯🇵", locale: "ja", contentPack: "dedicated" },
  { id: "es", flag: "🇪🇸", locale: "es", contentPack: "dedicated" },
  { id: "fr", flag: "🇫🇷", locale: "fr", contentPack: "universal" },
  { id: "de", flag: "🇩🇪", locale: "de", contentPack: "universal" },
  { id: "it", flag: "🇮🇹", locale: "it", contentPack: "universal" },
  { id: "pt", flag: "🇧🇷", locale: "pt", contentPack: "universal" },
  { id: "ru", flag: "🇷🇺", locale: "ru", contentPack: "universal" },
  { id: "ar", flag: "🇸🇦", locale: "ar", contentPack: "universal" },
  { id: "hi", flag: "🇮🇳", locale: "hi", contentPack: "universal" },
  { id: "vi", flag: "🇻🇳", locale: "vi", contentPack: "universal" },
  { id: "th", flag: "🇹🇭", locale: "th", contentPack: "universal" },
  { id: "tr", flag: "🇹🇷", locale: "tr", contentPack: "universal" },
  { id: "id", flag: "🇮🇩", locale: "id", contentPack: "universal" },
  { id: "pl", flag: "🇵🇱", locale: "pl", contentPack: "universal" },
  { id: "nl", flag: "🇳🇱", locale: "nl", contentPack: "universal" },
  { id: "sv", flag: "🇸🇪", locale: "sv", contentPack: "universal" },
  { id: "he", flag: "🇮🇱", locale: "he", contentPack: "universal" },
  { id: "uk", flag: "🇺🇦", locale: "uk", contentPack: "universal" },
  { id: "cs", flag: "🇨🇿", locale: "cs", contentPack: "universal" },
  { id: "ro", flag: "🇷🇴", locale: "ro", contentPack: "universal" },
  { id: "hu", flag: "🇭🇺", locale: "hu", contentPack: "universal" },
  { id: "ms", flag: "🇲🇾", locale: "ms", contentPack: "universal" },
  { id: "bn", flag: "🇧🇩", locale: "bn", contentPack: "universal" },
  { id: "fa", flag: "🇮🇷", locale: "fa", contentPack: "universal" },
  { id: "el", flag: "🇬🇷", locale: "el", contentPack: "universal" },
  { id: "no", flag: "🇳🇴", locale: "nb", contentPack: "universal" },
  { id: "da", flag: "🇩🇰", locale: "da", contentPack: "universal" },
  { id: "fi", flag: "🇫🇮", locale: "fi", contentPack: "universal" },
];

const byId = new Map(LEARNING_LANGUAGES.map((l) => [l.id, l]));
const runtime = new Map<string, LearningLanguageMeta>();

export function normalizeLearningLanguageId(
  raw: string | null | undefined,
): LearningLanguageId {
  const id = (raw ?? "en").toLowerCase().trim().slice(0, 8);
  if (/^[a-z]{2}(-[a-z]{2})?$/.test(id)) return id.split("-")[0];
  return "en";
}

export function resolveLearningLanguage(
  id: LearningLanguageId,
): LearningLanguageMeta {
  const key = normalizeLearningLanguageId(id);
  const known = byId.get(key) ?? runtime.get(key);
  if (known) return known;

  const created: LearningLanguageMeta = {
    id: key,
    flag: "🌐",
    locale: key,
    contentPack: "universal",
  };
  runtime.set(key, created);
  return created;
}

/** New assessments require an authored bank for the selected language. */
export function isCoursePlayable(id: LearningLanguageId): boolean {
  return DEDICATED_LANGUAGE_IDS.some(
    (supported) => supported === normalizeLearningLanguageId(id),
  );
}

export function getContentPack(id: LearningLanguageId): ContentPack {
  return resolveLearningLanguage(id).contentPack;
}



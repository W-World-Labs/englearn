import type { UiLocale } from "./types";

export const UI_LOCALES: Array<{ id: UiLocale; label: string; native: string }> =
  [
    { id: "zh-CN", label: "Chinese (Simplified)", native: "简体中文" },
    { id: "zh-TW", label: "Chinese (Traditional)", native: "繁體中文" },
    { id: "en", label: "English", native: "English" },
    { id: "es", label: "Spanish", native: "Español" },
    { id: "fr", label: "French", native: "Français" },
    { id: "de", label: "German", native: "Deutsch" },
    { id: "ja", label: "Japanese", native: "日本語" },
    { id: "ko", label: "Korean", native: "한국어" },
    { id: "pt", label: "Portuguese", native: "Português" },
    { id: "ru", label: "Russian", native: "Русский" },
    { id: "ar", label: "Arabic", native: "العربية" },
    { id: "hi", label: "Hindi", native: "हिन्दी" },
    { id: "it", label: "Italian", native: "Italiano" },
    { id: "vi", label: "Vietnamese", native: "Tiếng Việt" },
    { id: "th", label: "Thai", native: "ไทย" },
    { id: "tr", label: "Turkish", native: "Türkçe" },
    { id: "id", label: "Indonesian", native: "Bahasa Indonesia" },
    { id: "pl", label: "Polish", native: "Polski" },
    { id: "nl", label: "Dutch", native: "Nederlands" },
    { id: "he", label: "Hebrew", native: "עברית" },
    { id: "uk", label: "Ukrainian", native: "Українська" },
    { id: "cs", label: "Czech", native: "Čeština" },
    { id: "ro", label: "Romanian", native: "Română" },
    { id: "hu", label: "Hungarian", native: "Magyar" },
    { id: "ms", label: "Malay", native: "Bahasa Melayu" },
    { id: "bn", label: "Bengali", native: "বাংলা" },
    { id: "fa", label: "Persian", native: "فارسی" },
    { id: "el", label: "Greek", native: "Ελληνικά" },
    { id: "sv", label: "Swedish", native: "Svenska" },
    { id: "no", label: "Norwegian", native: "Norsk" },
    { id: "da", label: "Danish", native: "Dansk" },
    { id: "fi", label: "Finnish", native: "Suomi" },
  ];

export const DEFAULT_UI_LOCALE: UiLocale = "zh-CN";

const RTL_LOCALES = new Set<UiLocale>(["ar", "he", "fa"]);

export function isRtlLocale(locale: string): boolean {
  return RTL_LOCALES.has(locale as UiLocale);
}

/**
 * Locales with real message coverage — the only ones offered in the picker
 * and accepted from browser detection. Other known locales normalize but
 * fall back to English rather than a mostly-untranslated UI.
 */
export const PICKER_LOCALES = UI_LOCALES.filter((l) =>
  ["en", "zh-CN", "zh-TW", "es", "ja", "ko"].includes(l.id),
);

const PICKER_SET = new Set(PICKER_LOCALES.map((l) => l.id));

export function isPickerLocale(locale: string): boolean {
  return PICKER_SET.has(locale as UiLocale);
}

const UI_SET = new Set(UI_LOCALES.map((l) => l.id));

/**
 * Locale actually matched by a browser tag, or null when nothing in
 * UI_LOCALES fits — unlike normalizeUiLocale this never substitutes the
 * default, so detection can tell "no match" apart from a zh-CN match.
 */
export function matchUiLocale(raw: string | null | undefined): UiLocale | null {
  if (!raw) return null;
  const lower = raw.replace("_", "-");
  if (UI_SET.has(lower as UiLocale)) return lower as UiLocale;
  if (lower.startsWith("zh")) {
    return lower.includes("TW") || lower.includes("Hant")
      ? "zh-TW"
      : "zh-CN";
  }
  const primary = lower.split("-")[0];
  return UI_SET.has(primary as UiLocale) ? (primary as UiLocale) : null;
}

export function normalizeUiLocale(raw: string | null | undefined): UiLocale {
  return matchUiLocale(raw) ?? DEFAULT_UI_LOCALE;
}

/** Unknown UI codes fall back to English messages (see getMessagesForLocale). */
export function isKnownUiLocale(locale: string): boolean {
  return UI_SET.has(locale as UiLocale);
}
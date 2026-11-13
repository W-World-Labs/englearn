import {
  matchUiLocale,
  isPickerLocale,
  DEFAULT_UI_LOCALE,
} from "./ui-locales";
import type { UiLocale } from "./types";

/** Pick best UI locale from browser languages. */
export function detectBrowserUiLocale(): UiLocale {
  if (typeof navigator === "undefined") return DEFAULT_UI_LOCALE;

  const prefs = [
    ...(navigator.languages ?? []),
    navigator.language,
  ].filter(Boolean) as string[];

  for (const raw of prefs) {
    const normalized = matchUiLocale(raw);
    if (normalized && isPickerLocale(normalized)) return normalized;
  }

  // Unsupported browser language: English is the most complete fallback.
  return prefs.length > 0 ? "en" : DEFAULT_UI_LOCALE;
}

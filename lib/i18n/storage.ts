import type { LearningLanguageId, UiLocale } from "./types";
import { normalizeLearningLanguageId } from "./languages";
import {
  DEFAULT_UI_LOCALE,
  isPickerLocale,
  normalizeUiLocale,
} from "./ui-locales";

const UI_KEY = "lingolearn:uiLocale";
const COURSE_KEY = "lingolearn:course";

export function loadUiLocale(): UiLocale {
  if (typeof window === "undefined") return DEFAULT_UI_LOCALE;
  try {
    const stored = normalizeUiLocale(localStorage.getItem(UI_KEY));
    return isPickerLocale(stored) ? stored : "en";
  } catch {
    return DEFAULT_UI_LOCALE;
  }
}

export function saveUiLocale(locale: UiLocale): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(UI_KEY, locale);
}

export function loadLearningLanguage(): LearningLanguageId {
  if (typeof window === "undefined") return "en";
  try {
    return normalizeLearningLanguageId(localStorage.getItem(COURSE_KEY));
  } catch {
    return "en";
  }
}

export function saveLearningLanguage(id: LearningLanguageId): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COURSE_KEY, id);
}

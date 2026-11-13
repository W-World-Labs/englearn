import * as React from "react";
import type { LearningLanguageId, MessageParams, UiLocale } from "./types";
import { getMessagesForLocale, loadLocaleMessages } from "./messages";
import { createTranslator, getByPath } from "./translate";
import { detectBrowserUiLocale } from "./detect";
import {
  normalizeLearningLanguageId,
  resolveLearningLanguage,
} from "./languages";
import {
  loadLearningLanguage,
  loadUiLocale,
  saveLearningLanguage,
  saveUiLocale,
} from "./storage";

export interface I18nContextValue {
  locale: UiLocale;
  learningLanguage: LearningLanguageId;
  setLocale: (locale: UiLocale) => void;
  setLearningLanguage: (id: LearningLanguageId) => void;
  t: (path: string, params?: MessageParams) => string;
  /** Pick random line from feedback.correct / feedback.wrong arrays */
  tRandom: (path: string) => string;
  courseName: () => string;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // The first browser render must match SSR; restore device preferences after hydration.
  const [locale, setLocaleState] = React.useState<UiLocale>("zh-CN");
  const [learningLanguage, setCourseState] =
    React.useState<LearningLanguageId>("en");
  const requested = React.useRef(0);
  React.useEffect(() => {
    try {
      const firstVisit = !localStorage.getItem("lingolearn:uiLocale");
      const next = firstVisit ? detectBrowserUiLocale() : loadUiLocale();
      const ticket = ++requested.current;
      setCourseState(normalizeLearningLanguageId(loadLearningLanguage()));
      if (firstVisit) saveUiLocale(next);
      void loadLocaleMessages(next)
        .catch(() => {})
        .then(() => {
          if (requested.current === ticket) setLocaleState(next);
        });
    } catch {
      /* Device storage may be disabled; keep usable in-memory defaults. */
    }
  }, []);

  const messages = React.useMemo(() => getMessagesForLocale(locale), [locale]);

  const t = React.useMemo(() => createTranslator(messages), [messages]);

  const setLocale = React.useCallback((next: UiLocale) => {
    const ticket = ++requested.current;
    try {
      saveUiLocale(next);
    } catch {
      /* In-memory preference remains usable. */
    }
    void loadLocaleMessages(next)
      .catch(() => {})
      .then(() => {
        if (requested.current === ticket) setLocaleState(next);
      });
  }, []);

  const setLearningLanguage = React.useCallback((id: LearningLanguageId) => {
    const normalized = normalizeLearningLanguageId(id);
    resolveLearningLanguage(normalized);
    setCourseState(normalized);
    try {
      saveLearningLanguage(normalized);
    } catch {
      /* In-memory preference remains usable. */
    }
  }, []);

  const tRandom = React.useCallback(
    (path: string) => {
      const raw = getByPath(messages, path);
      if (Array.isArray(raw) && raw.length > 0) {
        return raw[Math.floor(Math.random() * raw.length)];
      }
      if (typeof raw === "string") return raw;
      return path;
    },
    [messages],
  );

  const courseName = React.useCallback(() => {
    const path = `courses.${learningLanguage}.name`;
    const raw = getByPath(messages, path);
    if (typeof raw === "string") return raw;
    return resolveLearningLanguage(learningLanguage).id.toUpperCase();
  }, [messages, learningLanguage]);

  const value = React.useMemo(
    () => ({
      locale,
      learningLanguage,
      setLocale,
      setLearningLanguage,
      t,
      tRandom,
      courseName,
    }),
    [
      locale,
      learningLanguage,
      setLocale,
      setLearningLanguage,
      t,
      tRandom,
      courseName,
    ],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

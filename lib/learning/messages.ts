import { getMessagesForLocale } from "@/lib/i18n/messages";
import { normalizeUiLocale } from "@/lib/i18n/ui-locales";
import type { learnEn } from "@/lib/i18n/messages/en";

export type LearningMessages = typeof learnEn;

export function learningMessages(locale: string): LearningMessages {
  return getMessagesForLocale(normalizeUiLocale(locale))[
    "learn"
  ] as LearningMessages;
}

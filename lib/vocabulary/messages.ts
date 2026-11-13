import { getMessagesForLocale } from "@/lib/i18n/messages";
import { normalizeUiLocale } from "@/lib/i18n/ui-locales";
import type { vocabEn } from "@/lib/i18n/messages/en";

export type VocabularyMessages = typeof vocabEn;

export function vocabularyMessages(locale: string): VocabularyMessages {
  return getMessagesForLocale(normalizeUiLocale(locale))[
    "vocab"
  ] as VocabularyMessages;
}

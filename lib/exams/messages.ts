import { getMessagesForLocale } from "@/lib/i18n/messages";
import { normalizeUiLocale } from "@/lib/i18n/ui-locales";
import type { examEn } from "@/lib/i18n/messages/en";

export type ExamMessages = typeof examEn;

export function examMessages(locale: string): ExamMessages {
  return getMessagesForLocale(normalizeUiLocale(locale))[
    "exam"
  ] as ExamMessages;
}

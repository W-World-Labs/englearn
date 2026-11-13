import { getMessagesForLocale } from "@/lib/i18n/messages";
import { normalizeUiLocale } from "@/lib/i18n/ui-locales";
import type { planEn } from "@/lib/i18n/messages/en";

export type PlanMessages = typeof planEn;

export function planMessages(locale: string): PlanMessages {
  return getMessagesForLocale(normalizeUiLocale(locale))[
    "plan"
  ] as PlanMessages;
}

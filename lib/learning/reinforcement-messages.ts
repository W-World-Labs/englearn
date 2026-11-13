import { getMessagesForLocale } from "@/lib/i18n/messages";
import { normalizeUiLocale } from "@/lib/i18n/ui-locales";
import type { reinforceEn } from "@/lib/i18n/messages/en";

export type ReinforcementMessages = typeof reinforceEn;

export function reinforcementMessages(locale: string): ReinforcementMessages {
  return getMessagesForLocale(normalizeUiLocale(locale))[
    "reinforce"
  ] as ReinforcementMessages;
}

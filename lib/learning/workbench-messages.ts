import { getMessagesForLocale } from "@/lib/i18n/messages";
import { normalizeUiLocale } from "@/lib/i18n/ui-locales";
import type { workbenchEn } from "@/lib/i18n/messages/en";

export type WorkbenchMessages = typeof workbenchEn;

export function workbenchMessages(locale: string): WorkbenchMessages {
  return getMessagesForLocale(normalizeUiLocale(locale))[
    "workbench"
  ] as WorkbenchMessages;
}

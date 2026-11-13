import type { MessageTree, UiLocale } from "../types";
import { deepMergeMessages } from "../translate";
import { en } from "./en";
import { zhCN } from "./zh-CN";

/** English is the fallback base; zh-CN is the SSR/default render. Both stay in
 * the entry chunk; other picker locales load on demand via loadLocaleMessages. */
export const OVERRIDES: Partial<Record<UiLocale, MessageTree>> = {
  en,
  "zh-CN": zhCN,
};

const LOADERS: Partial<
  Record<UiLocale, () => Promise<MessageTree>>
> = {
  "zh-TW": async () => (await import("./zh-TW")).zhTW,
  es: async () => (await import("./es")).es,
  ja: async () => (await import("./ja")).ja,
  ko: async () => (await import("./ko")).ko,
};

const loading = new Map<UiLocale, Promise<void>>();

/** Dynamically import and register a locale's overrides. Safe to call
 * repeatedly; concurrent calls share one import. */
export function loadLocaleMessages(locale: UiLocale): Promise<void> {
  const loader = LOADERS[locale];
  if (!loader || OVERRIDES[locale]) return Promise.resolve();
  let pending = loading.get(locale);
  if (!pending) {
    pending = loader().then(
      (tree) => {
        OVERRIDES[locale] = tree;
        loading.delete(locale);
      },
      (err) => {
        loading.delete(locale);
        throw err;
      },
    );
    loading.set(locale, pending);
  }
  return pending;
}

/** Fallback chains: a partial locale sits on a fuller sibling, then English. */
const FALLBACKS: Partial<Record<UiLocale, UiLocale>> = {
  "zh-TW": "zh-CN",
};

export function getMessagesForLocale(locale: UiLocale): MessageTree {
  const fallback = FALLBACKS[locale];
  const base = fallback ? getMessagesForLocale(fallback) : en;
  const patch = OVERRIDES[locale];
  if (!patch || locale === "en") return base;
  return deepMergeMessages(base, patch);
}

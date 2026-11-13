/**
 * Shared locale picking for locale-keyed content (explanations, study text,
 * material labels). UI strings use the message tree (`t()`); these helpers
 * are for content records keyed by language tags like { en, zh, ja }.
 */

/** StudyText / material labels are authored in English and Chinese only. */
export function studyTextLocale(uiLocale: string): "zh" | "en" {
  return uiLocale.startsWith("zh") ? "zh" : "en";
}

/**
 * Pick the best entry from a locale-keyed map for a UI locale.
 * Tries the exact tag, its primary subtag, then English, then first value.
 */
export function localizedText<M extends object>(
  map: M,
  uiLocale: string,
): M[keyof M] | undefined {
  const m = map as Record<string, M[keyof M]>;
  return (
    m[uiLocale] ?? m[uiLocale.split("-")[0]] ?? m["en"] ?? Object.values(m)[0]
  );
}

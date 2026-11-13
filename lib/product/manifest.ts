/**
 * LingoLearn product definition:
 * - Learn ANY language (user picks target language / course)
 * - UI in ANY language (user picks interface locale)
 * Content packs plug in per target language; the adaptive engine is language-agnostic.
 */
export const PRODUCT = {
  id: "lingolearn",
  name: "LingoLearn",
  taglineKey: "app.tagline",
  principles: [
    "any_ui_locale",
    "any_learning_language",
    "universal_adaptive_engine",
    "per_language_content_packs",
  ] as const,
} as const;

export type ProductPrinciple = (typeof PRODUCT.principles)[number];
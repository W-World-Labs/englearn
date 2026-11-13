import type { CEFRLevel, ModuleType } from "@/lib/types";
import { productStudyTipsEn } from "@/lib/i18n/messages/en";
import { productStudyTipsZh } from "@/lib/i18n/messages/zh-CN";

/** Guide copy lives in the message tree (product.*); this table keeps only keys.
 *  Array shape is preserved: guide.tsx's usePaginatedSlice(FAQ, 3) and
 *  key={step.step} are unchanged. */
export const HOW_IT_WORKS = [
  { step: "01", titleKey: "product.howItWorks.1.title", descKey: "product.howItWorks.1.desc" },
  { step: "02", titleKey: "product.howItWorks.2.title", descKey: "product.howItWorks.2.desc" },
  { step: "03", titleKey: "product.howItWorks.3.title", descKey: "product.howItWorks.3.desc" },
] as const;

export const CEFR_GUIDE: Record<
  CEFRLevel,
  { titleKey: string; canDoKey: string; vocabKey: string }
> = {
  A1: { titleKey: "product.cefrGuide.A1.title", canDoKey: "product.cefrGuide.A1.canDo", vocabKey: "product.cefrGuide.A1.vocab" },
  A2: { titleKey: "product.cefrGuide.A2.title", canDoKey: "product.cefrGuide.A2.canDo", vocabKey: "product.cefrGuide.A2.vocab" },
  B1: { titleKey: "product.cefrGuide.B1.title", canDoKey: "product.cefrGuide.B1.canDo", vocabKey: "product.cefrGuide.B1.vocab" },
  B2: { titleKey: "product.cefrGuide.B2.title", canDoKey: "product.cefrGuide.B2.canDo", vocabKey: "product.cefrGuide.B2.vocab" },
  C1: { titleKey: "product.cefrGuide.C1.title", canDoKey: "product.cefrGuide.C1.canDo", vocabKey: "product.cefrGuide.C1.vocab" },
  C2: { titleKey: "product.cefrGuide.C2.title", canDoKey: "product.cefrGuide.C2.canDo", vocabKey: "product.cefrGuide.C2.vocab" },
};

export const FAQ = [
  { qKey: "product.faq.1.q", aKey: "product.faq.1.a" },
  { qKey: "product.faq.2.q", aKey: "product.faq.2.a" },
  { qKey: "product.faq.3.q", aKey: "product.faq.3.a" },
  { qKey: "product.faq.4.q", aKey: "product.faq.4.a" },
] as const;

/** Study tips are authored in English and Chinese; pick via studyTextLocale().
 *  Arrays live in the message tree (product.studyTips); this record only
 *  re-exports them as { en, zh } so analysis.ts needs no change. */
export const MODULE_STUDY_TIPS: Record<"en" | "zh", Record<ModuleType, string[]>> = {
  en: productStudyTipsEn as Record<ModuleType, string[]>,
  zh: productStudyTipsZh as Record<ModuleType, string[]>,
};

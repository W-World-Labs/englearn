import type { Item } from "@/lib/types";
import {
  DEDICATED_LANGUAGE_IDS,
  normalizeLearningLanguageId,
} from "@/lib/i18n/languages";

import enVocabulary from "@/data/packs/en/vocabulary.json";
import enGrammar from "@/data/packs/en/grammar.json";
import enReading from "@/data/packs/en/reading.json";
import enListening from "@/data/packs/en/listening.json";
import enOpen from "@/data/packs/en/open.json";

import zhVocabulary from "@/data/packs/zh/vocabulary.json";
import zhGrammar from "@/data/packs/zh/grammar.json";
import zhReading from "@/data/packs/zh/reading.json";
import zhListening from "@/data/packs/zh/listening.json";
import zhOpen from "@/data/packs/zh/open.json";

import koVocabulary from "@/data/packs/ko/vocabulary.json";
import koGrammar from "@/data/packs/ko/grammar.json";
import koReading from "@/data/packs/ko/reading.json";
import koListening from "@/data/packs/ko/listening.json";
import koOpen from "@/data/packs/ko/open.json";

import jaVocabulary from "@/data/packs/ja/vocabulary.json";
import jaGrammar from "@/data/packs/ja/grammar.json";
import jaReading from "@/data/packs/ja/reading.json";
import jaListening from "@/data/packs/ja/listening.json";
import jaOpen from "@/data/packs/ja/open.json";

import esVocabulary from "@/data/packs/es/vocabulary.json";
import esGrammar from "@/data/packs/es/grammar.json";
import esReading from "@/data/packs/es/reading.json";
import esListening from "@/data/packs/es/listening.json";
import esOpen from "@/data/packs/es/open.json";

export type ContentPackId = (typeof DEDICATED_LANGUAGE_IDS)[number];

export const DEDICATED_PACK_IDS: ContentPackId[] = [...DEDICATED_LANGUAGE_IDS];

function concatPack(modules: Item[][], contentLang: string): Item[] {
  return modules.flat().map((item) => ({
    ...item,
    contentLang: item.contentLang ?? contentLang,
  }));
}

const PACK_ITEMS: Record<ContentPackId, Item[]> = {
  en: concatPack(
    [
      enVocabulary as Item[],
      enGrammar as Item[],
      enReading as Item[],
      enListening as Item[],
      enOpen as Item[],
    ],
    "en-US",
  ),
  zh: concatPack(
    [
      zhVocabulary as Item[],
      zhGrammar as Item[],
      zhReading as Item[],
      zhListening as Item[],
      zhOpen as Item[],
    ],
    "zh-CN",
  ),
  ko: concatPack(
    [
      koVocabulary as Item[],
      koGrammar as Item[],
      koReading as Item[],
      koListening as Item[],
      koOpen as Item[],
    ],
    "ko-KR",
  ),
  ja: concatPack(
    [
      jaVocabulary as Item[],
      jaGrammar as Item[],
      jaReading as Item[],
      jaListening as Item[],
      jaOpen as Item[],
    ],
    "ja-JP",
  ),
  es: concatPack(
    [
      esVocabulary as Item[],
      esGrammar as Item[],
      esReading as Item[],
      esListening as Item[],
      esOpen as Item[],
    ],
    "es-ES",
  ),
};

const BY_PACK = new Map<ContentPackId, Map<string, Item>>();

for (const packId of DEDICATED_PACK_IDS) {
  BY_PACK.set(
    packId,
    new Map(PACK_ITEMS[packId].map((item) => [item.id, item])),
  );
}

/** English fallback is retained only for reading pre-v0.10 sessions.
 * New session creation must first check isCoursePlayable. */
export function resolveContentPack(learningLanguage: string): ContentPackId {
  const id = normalizeLearningLanguageId(learningLanguage);
  if (DEDICATED_PACK_IDS.includes(id as ContentPackId)) {
    return id as ContentPackId;
  }
  return "en";
}

export function getPackItems(packId: ContentPackId): Item[] {
  return PACK_ITEMS[packId];
}

/**
 * Items eligible for NEW adaptive selection. Retired items are filtered out of
 * the bank but remain in PACK_ITEMS so getPackItemById/findItemById keep
 * resolving them for historical session replay.
 */
export function getActivePackItems(packId: ContentPackId): Item[] {
  return PACK_ITEMS[packId].filter((item) => !item.retired);
}

export function getPackItemById(
  packId: ContentPackId,
  itemId: string,
): Item | null {
  return BY_PACK.get(packId)?.get(itemId) ?? null;
}

export function findItemById(itemId: string): Item | null {
  for (const packId of DEDICATED_PACK_IDS) {
    const hit = getPackItemById(packId, itemId);
    if (hit) return hit;
  }
  return null;
}

export function hasDedicatedPack(learningLanguage: string): boolean {
  const id = normalizeLearningLanguageId(learningLanguage);
  return DEDICATED_PACK_IDS.includes(id as ContentPackId);
}

export function dedicatedPackStats(): Array<{
  id: ContentPackId;
  total: number;
}> {
  return DEDICATED_PACK_IDS.map((id) => ({
    id,
    total: PACK_ITEMS[id].length,
  }));
}

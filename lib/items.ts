import type { Item, ModuleType } from "@/lib/types";
import {
  findItemById,
  getActivePackItems,
  getPackItemById,
  resolveContentPack,
  type ContentPackId,
} from "@/lib/items/packs";

export function getAllItems(learningLanguage = "en"): Item[] {
  const pack = resolveContentPack(learningLanguage);
  return getActivePackItems(pack);
}

export function getItemsByModule(
  m: ModuleType,
  learningLanguage = "en"
): Item[] {
  return getAllItems(learningLanguage).filter((item) => item.module === m);
}

export function getItemById(
  id: string,
  learningLanguage?: string
): Item | null {
  if (learningLanguage) {
    const pack = resolveContentPack(learningLanguage);
    const hit = getPackItemById(pack, id);
    if (hit) return hit;
  }
  return findItemById(id);
}

export function getContentPackForLanguage(
  learningLanguage: string
): ContentPackId {
  return resolveContentPack(learningLanguage);
}
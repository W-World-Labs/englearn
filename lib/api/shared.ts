import type { ClientItem, Item } from "@/lib/types";

/** Strip all server-only fields before sending an Item to the client. */
export function toClientItem(item: Item): ClientItem {
  const { answerIndex, isPseudoword, rubric, irt, retired, replaces, ...rest } = item;
  void answerIndex;
  void isPseudoword;
  void rubric;
  void irt;
  void retired;
  void replaces;
  return rest;
}

import { expect, it } from "vitest";
import { toClientItem } from "./shared";
import type { Item } from "@/lib/types";

it.each([true, false])("keeps vocabulary truth flag %s exclusively in the server item", (isPseudoword) => {
  const item: Item = {
    id: "vocabulary-test",
    module: "vocabulary",
    format: "yesno",
    cefr: "B1",
    prompt: "Do you know this word?",
    word: "example",
    isPseudoword,
    irt: { a: 1, b: 0 },
  };
  expect(toClientItem(item)).toEqual({
    id: "vocabulary-test",
    module: "vocabulary",
    format: "yesno",
    cefr: "B1",
    prompt: "Do you know this word?",
    word: "example",
  });
  expect(item.isPseudoword).toBe(isPseudoword);
});

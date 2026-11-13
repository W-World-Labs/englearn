import { beforeAll, describe, expect, it } from "vitest";
import type { MessageTree, UiLocale } from "./types";
import { en } from "./messages/en";
import {
  getMessagesForLocale,
  loadLocaleMessages,
  OVERRIDES,
} from "./messages";
import { PICKER_LOCALES, isPickerLocale } from "./ui-locales";
import { learningMessages } from "@/lib/learning/messages";
import { examMessages } from "@/lib/exams/messages";
import { vocabularyMessages } from "@/lib/vocabulary/messages";

beforeAll(async () => {
  for (const { id } of PICKER_LOCALES) {
    await loadLocaleMessages(id);
  }
});

function leafPaths(tree: MessageTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === "string" || Array.isArray(v)
      ? [prefix + k]
      : leafPaths(v, `${prefix}${k}.`),
  );
}

const EN_PATHS = new Set(leafPaths(en));

describe("message locales", () => {
  it("every override only defines paths that exist in English", () => {
    const orphans: Record<string, string[]> = {};
    for (const locale of Object.keys(OVERRIDES)) {
      const list = leafPaths(getMessagesForLocale(locale as UiLocale)).filter(
        (p) => !EN_PATHS.has(p),
      );
      if (list.length) orphans[locale] = list;
    }
    expect(orphans).toEqual({});
  });

  it("every picker locale resolves a full tree", async () => {
    for (const { id } of PICKER_LOCALES) {
      await loadLocaleMessages(id);
      const tree = getMessagesForLocale(id);
      expect(tree.nav, id).toBeDefined();
      expect(tree.learn, id).toBeDefined();
      expect(tree.exam, id).toBeDefined();
    }
  });

  it("zh-TW falls back through zh-CN before English", async () => {
    await loadLocaleMessages("zh-TW");
    const tw = getMessagesForLocale("zh-TW");
    expect((tw.learn as MessageTree).history).toBe("练习记录");
  });

  it("unsupported locales normalize away from the picker", () => {
    expect(isPickerLocale("sv")).toBe(false);
    expect(isPickerLocale("ja")).toBe(true);
  });

  it("exposes migrated product/materials/score sections with locale fallback", async () => {
    await loadLocaleMessages("zh-TW");
    await loadLocaleMessages("es");
    const get = (tree: MessageTree, path: string) =>
      path
        .split(".")
        .reduce<unknown>(
          (cur, key) =>
            cur && typeof cur === "object"
              ? (cur as Record<string, unknown>)[key]
              : undefined,
          tree,
        );
    for (const locale of ["en", "zh-CN"] as const) {
      const tree = getMessagesForLocale(locale);
      expect(get(tree, "product.howItWorks.1.title"), locale).toBeDefined();
      expect(get(tree, "product.cefrGuide.B1.canDo"), locale).toBeDefined();
      expect(get(tree, "product.faq.4.a"), locale).toBeDefined();
      expect(get(tree, "score.serviceError"), locale).toBeDefined();
      expect(
        (get(tree, "materials") as Record<string, string>).packTitleSuffix,
        locale,
      ).toBeDefined();
    }
    // zh-TW inherits Chinese through zh-CN; es falls back to English.
    expect(
      get(getMessagesForLocale("zh-TW"), "product.howItWorks.1.title"),
    ).toBe(get(getMessagesForLocale("zh-CN"), "product.howItWorks.1.title"));
    expect(get(getMessagesForLocale("es"), "product.howItWorks.1.title")).toBe(
      get(getMessagesForLocale("en"), "product.howItWorks.1.title"),
    );
    expect(get(getMessagesForLocale("es"), "score.serviceError")).toBe(
      get(getMessagesForLocale("en"), "score.serviceError"),
    );
  });

  it("localizes assessment item chrome and keeps the level placeholder", async () => {
    const get = (tree: MessageTree, path: string) =>
      path.split(".").reduce<unknown>((cur, key) => {
        if (!cur || typeof cur !== "object") return undefined;
        return (cur as Record<string, unknown>)[key];
      }, tree);
    const itemKeys = [
      "item.chooseOption",
      "item.readingTitle",
      "item.listeningTitle",
      "item.passage",
      "item.selectToContinue",
      "item.listenThenSelect",
      "item.ready",
      "item.submit",
      "item.level",
    ];
    const english = getMessagesForLocale("en");
    for (const id of ["zh-CN", "ja", "ko", "es"] as const) {
      await loadLocaleMessages(id);
      const tree = getMessagesForLocale(id);
      for (const path of itemKeys) {
        const value = get(tree, path);
        expect(typeof value, `${id} ${path}`).toBe("string");
        expect(value, `${id} ${path}`).not.toBe(get(english, path));
      }
      expect(get(tree, "item.level"), id).toContain("{{level}}");
      expect(get(tree, "modules.grammar"), id).not.toBe("Grammar");
      expect(get(tree, "tts.play"), id).not.toBe("Play audio");
      expect(get(tree, "tts.noVoice"), id).toContain("{{lang}}");
    }
    await loadLocaleMessages("zh-TW");
    expect(get(getMessagesForLocale("zh-TW"), "item.readingTitle")).toBe(
      "阅读理解",
    );
    // A removed picker locale has no patch, so the item chrome stays English.
    expect(get(getMessagesForLocale("fr"), "item.chooseOption")).toBe(
      "Choose the best option",
    );
  });

  it("localizes the daily-goal remainder and keeps its placeholder", async () => {
    const get = (tree: MessageTree, path: string) =>
      path.split(".").reduce<unknown>((cur, key) => {
        if (!cur || typeof cur !== "object") return undefined;
        return (cur as Record<string, unknown>)[key];
      }, tree);
    const english = getMessagesForLocale("en");
    for (const id of ["zh-CN", "zh-TW", "ja", "ko", "es"] as const) {
      await loadLocaleMessages(id);
      const value = get(getMessagesForLocale(id), "home.goalLeft");
      expect(typeof value, id).toBe("string");
      expect(value, id).toContain("{{left}}");
      expect(value, id).not.toBe(get(english, "home.goalLeft"));
    }
    expect(get(getMessagesForLocale("zh-TW"), "home.goalLeft")).toBe(
      "離今日目標還差 {{left}} XP",
    );
    expect(get(getMessagesForLocale("fr"), "home.goalLeft")).toBe(
      "{{left}} XP left toward today's goal",
    );
  });
});

describe("domain message selectors", () => {
  it("returns translated sections and English fallback consistently", () => {
    expect(learningMessages("ko").history).not.toBe(
      learningMessages("en").history,
    );
    expect(learningMessages("fr").history).toBe(learningMessages("en").history);
    expect(examMessages("ja").start).toBe(examMessages("ja-JP").start);
    expect(vocabularyMessages("ko").name).not.toBe(
      vocabularyMessages("en").name,
    );
    expect(vocabularyMessages("fr").name).toBe(vocabularyMessages("en").name);
  });
});

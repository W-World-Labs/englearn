import { beforeAll, describe, expect, it } from "vitest";
import { vocabEn } from "./messages/en";
import { ko } from "./messages/ko";
import { es } from "./messages/es";
import { getMessagesForLocale, loadLocaleMessages } from "./messages";
import { vocabularyMessages } from "@/lib/vocabulary/messages";

const VOCAB_KEYS = Object.keys(vocabEn) as Array<keyof typeof vocabEn>;

const PATCHES = {
  ko: ko.vocab as Record<string, string>,
  es: es.vocab as Record<string, string>,
} as const;

beforeAll(async () => {
  for (const locale of ["ko", "es", "zh-CN", "zh-TW"] as const) {
    await loadLocaleMessages(locale);
  }
});

describe.each(["ko", "es"] as const)("%s vocabulary patch", (locale) => {
  const vocab = PATCHES[locale];

  it("defines every English vocab key", () => {
    const missing = VOCAB_KEYS.filter((key) => typeof vocab[key] !== "string");
    expect(missing).toEqual([]);
  });

  it("defines no keys outside the English vocab section", () => {
    const extra = Object.keys(vocab).filter(
      (key) => !(key in vocabEn),
    );
    expect(extra).toEqual([]);
  });

  it("provides a non-empty string for every value", () => {
    for (const key of VOCAB_KEYS) {
      expect(typeof vocab[key], `${locale}.vocab.${key}`).toBe("string");
      expect(
        vocab[key].trim().length,
        `${locale}.vocab.${key}`,
      ).toBeGreaterThan(0);
    }
  });

  it("preserves every {{placeholder}} from the English source", () => {
    for (const key of VOCAB_KEYS) {
      const placeholders = vocabEn[key].match(/\{\{\w+\}\}/g) ?? [];
      for (const placeholder of placeholders) {
        expect(
          vocab[key].includes(placeholder),
          `${locale}.vocab.${key} must keep ${placeholder}`,
        ).toBe(true);
      }
    }
  });

  it("survives the locale message-tree merge unchanged", () => {
    const resolved = getMessagesForLocale(locale).vocab as Record<
      string,
      string
    >;
    for (const key of VOCAB_KEYS) {
      expect(resolved[key], `${locale}.vocab.${key}`).toBe(vocab[key]);
    }
  });
});

describe("curated vocabulary sample is translated, not copied", () => {
  const SAMPLE = [
    "recognition",
    "title",
    "name",
    "entry",
    "intro",
    "known",
    "unknown",
    "start",
    "result",
    "scope",
    "model",
    "foundation",
    "attribution",
  ] as const;

  it.each(["ko", "es"] as const)("%s differs from English", (locale) => {
    const vocab = PATCHES[locale];
    const copied = SAMPLE.filter((key) => vocab[key] === vocabEn[key]);
    expect(copied).toEqual([]);
  });
});

describe("the vocabulary name label is localized", () => {
  it("ko.name is translated, not the English fallback", () => {
    expect(PATCHES.ko.name).not.toBe(vocabEn.name);
    expect(vocabularyMessages("ko").name).toBe(PATCHES.ko.name);
  });

  it("es.name is localized independently", () => {
    expect(PATCHES.es.name).not.toBe(vocabEn.name);
    expect(vocabularyMessages("es").name).toBe(PATCHES.es.name);
  });
});
describe("vocab fallback chain", () => {
  it("a locale without a vocab patch inherits Chinese through zh-CN", () => {
    const tw = vocabularyMessages("zh-TW");
    const cn = vocabularyMessages("zh-CN");
    expect(tw.name).toBe(cn.name);
    expect(tw.title).toBe(cn.title);
    expect(tw.title).not.toBe(vocabEn.title);
  });

  it("a locale outside the picker falls back to the English base", () => {
    const fr = vocabularyMessages("fr");
    for (const key of VOCAB_KEYS) {
      expect(fr[key], `fr.vocab.${key}`).toBe(vocabEn[key]);
    }
  });
});

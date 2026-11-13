import { afterEach, describe, expect, it, vi } from "vitest";
import { detectBrowserUiLocale } from "./detect";

afterEach(() => vi.unstubAllGlobals());

const stubNavigator = (languages: string[], language?: string) =>
  vi.stubGlobal("navigator", {
    languages,
    language: language ?? languages[0],
  });

describe("detectBrowserUiLocale", () => {
  it("falls back to English for an unsupported browser language", () => {
    stubNavigator(["xx-YY"]);
    expect(detectBrowserUiLocale()).toBe("en");
  });

  it("falls back to English for known but untranslated locales like fr", () => {
    stubNavigator(["fr-FR"]);
    expect(detectBrowserUiLocale()).toBe("en");
  });

  it("keeps scanning past an unknown tag instead of masking later matches", () => {
    stubNavigator(["xx-YY", "ja-JP"]);
    expect(detectBrowserUiLocale()).toBe("ja");
    stubNavigator(["fr", "ko"]);
    expect(detectBrowserUiLocale()).toBe("ko");
  });

  it("maps zh-Hant to Traditional and plain zh to Simplified Chinese", () => {
    stubNavigator(["zh-Hant"]);
    expect(detectBrowserUiLocale()).toBe("zh-TW");
    stubNavigator(["zh"]);
    expect(detectBrowserUiLocale()).toBe("zh-CN");
  });

  it("returns the default when navigator is missing or lists nothing", () => {
    vi.stubGlobal("navigator", undefined);
    expect(detectBrowserUiLocale()).toBe("zh-CN");
    vi.stubGlobal("navigator", { languages: [] });
    expect(detectBrowserUiLocale()).toBe("zh-CN");
  });
});

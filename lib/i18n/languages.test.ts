import { describe, expect, it } from "vitest";
import {
  isCoursePlayable,
  normalizeLearningLanguageId,
  resolveLearningLanguage,
} from "./languages";

describe("learning languages", () => {
  it("normalizes ISO codes", () => {
    expect(normalizeLearningLanguageId("ES")).toBe("es");
    expect(normalizeLearningLanguageId("zh-CN")).toBe("zh");
  });

  it("accepts arbitrary codes at runtime", () => {
    const sw = resolveLearningLanguage("sw");
    expect(sw.id).toBe("sw");
    expect(sw.contentPack).toBe("universal");
    expect(isCoursePlayable("sw")).toBe(false);
    expect(isCoursePlayable("fr")).toBe(false);
    expect(isCoursePlayable("ja")).toBe(true);
    expect(isCoursePlayable("zh-CN")).toBe(true);
  });
});

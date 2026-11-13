import { describe, expect, it } from "vitest";
import { analyzeResult, compareResults, formatDuration } from "./analysis";
import type { TestResult } from "@/lib/types";

function mockResult(
  modules: Array<{ module: TestResult["modules"][0]["module"]; theta: number }>
): TestResult {
  return {
    sessionId: "test",
    completedAt: new Date().toISOString(),
    overallCEFR: "B1",
    modules: modules.map((m) => ({
      module: m.module,
      theta: m.theta,
      se: 0.3,
      cefr: "B1",
      itemsAdministered: 5,
    })),
  };
}

describe("analyzeResult", () => {
  it("marks lowest modules as focus areas", () => {
    const result = mockResult([
      { module: "vocabulary", theta: 2 },
      { module: "grammar", theta: -2 },
      { module: "reading", theta: 0 },
    ]);
    const analysis = analyzeResult(result);
    expect(analysis.focusAreas.some((f) => f.module === "grammar")).toBe(true);
    expect(analysis.strengths.some((s) => s.module === "vocabulary")).toBe(
      true
    );
    expect(analysis.studyPlan.length).toBeGreaterThan(0);
  });

  it("returns structured data with no UI-locale strings", () => {
    const analysis = analyzeResult(mockResult([{ module: "grammar", theta: -2 }]));
    expect(analysis.overallCEFR).toBe("B1");
    expect(analysis.studyPlan[0].module).toBe("grammar");
    expect(analysis.studyPlan[0].priority).toBe("high");
  });

  it("localizes study tips by UI locale", () => {
    const result = mockResult([{ module: "grammar", theta: -2 }]);
    const enTips = analyzeResult(result, "en").studyPlan[0].tips;
    const zhTips = analyzeResult(result, "zh-CN").studyPlan[0].tips;
    expect(enTips.length).toBeGreaterThan(0);
    expect(zhTips.length).toBeGreaterThan(0);
    expect(enTips[0]).not.toBe(zhTips[0]);
    expect(/[一-鿿]/.test(enTips[0])).toBe(false);
    expect(/[一-鿿]/.test(zhTips[0])).toBe(true);
  });
});

describe("compareResults", () => {
  it("detects level improvement", () => {
    const older: TestResult = { ...mockResult([]), overallCEFR: "A2" };
    const newer: TestResult = { ...mockResult([]), overallCEFR: "B1" };
    expect(compareResults(newer, older).delta).toBe(1);
  });
});

describe("formatDuration", () => {
  it("formats minutes and seconds", () => {
    expect(formatDuration(125, "en")).toBe("2 min 5 s");
    expect(formatDuration(125, "zh-CN")).toBe("2 分 5 秒");
    expect(formatDuration(45, "en")).toBe("45 s");
  });
});

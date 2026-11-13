import { describe, expect, it } from "vitest";
import {
  xpForCompletedAssessment,
  xpForCorrectAnswer,
  xpForDailyRead,
  xpForExamPaper,
  xpForRecallRound,
  xpForScoredRound,
  xpProgressInLevel,
} from "./xp";
import type { TestResult } from "@/lib/types";

describe("xp", () => {
  it("awards more for correct than wrong", () => {
    expect(xpForCorrectAnswer()).toBeGreaterThan(2);
  });

  it("computes level progress", () => {
    const p = xpProgressInLevel(150);
    expect(p.level).toBe(2);
    expect(p.current).toBe(50);
  });

  it("bonuses completed assessments by CEFR", () => {
    const base: TestResult = {
      sessionId: "s1",
      overallCEFR: "A1",
      modules: [
        {
          module: "vocabulary",
          cefr: "A1",
          theta: 0,
          se: 0.5,
          itemsAdministered: 5,
        },
      ],
      completedAt: new Date().toISOString(),
    };
    const low = xpForCompletedAssessment(base);
    const high = xpForCompletedAssessment({ ...base, overallCEFR: "C2" });
    expect(high).toBeGreaterThan(low);
  });

  it("scales scored-round XP by correct answers with a completion floor and cap", () => {
    expect(xpForScoredRound(0)).toBe(4);
    expect(xpForScoredRound(4)).toBe(16);
    expect(xpForScoredRound(4)).toBeGreaterThan(xpForScoredRound(2));
    expect(xpForScoredRound(100)).toBe(30);
    expect(xpForScoredRound(-3)).toBe(4);
    expect(xpForScoredRound(Number.NaN)).toBe(4);
    expect(xpForScoredRound(2.9)).toBe(10);
  });

  it("pays the completion floor for a finished daily reading task", () => {
    expect(xpForDailyRead()).toBe(xpForScoredRound(0));
    expect(xpForDailyRead()).toBeLessThan(xpForCorrectAnswer());
  });

  it("bounds recall-round XP by cards worked, never by self-ratings", () => {
    expect(xpForRecallRound(0)).toBe(0);
    expect(xpForRecallRound(6)).toBe(6);
    expect(xpForRecallRound(12)).toBe(12);
    expect(xpForRecallRound(20)).toBe(15);
    expect(xpForRecallRound(50)).toBe(15);
    expect(xpForRecallRound(-4)).toBe(0);
    expect(xpForRecallRound(Number.NaN)).toBe(0);
  });

  it("scales exam-paper XP by questions with a completion floor and cap", () => {
    expect(xpForExamPaper(0)).toBe(8);
    expect(xpForExamPaper(20)).toBe(28);
    expect(xpForExamPaper(32)).toBe(40);
    expect(xpForExamPaper(100)).toBe(40);
    expect(xpForExamPaper(-5)).toBe(8);
    expect(xpForExamPaper(Number.NaN)).toBe(8);
    expect(xpForExamPaper(20)).toBeGreaterThan(xpForScoredRound(4));
  });
});
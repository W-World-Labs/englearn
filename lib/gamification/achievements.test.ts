import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, checkNewAchievements } from "./achievements";
import {
  DEFAULT_PROGRESS,
  getCourseCrowns,
  type UserProgress,
} from "./types";
import type { CEFRLevel, ModuleType, TestResult } from "@/lib/types";

function progress(overrides: Partial<UserProgress> = {}): UserProgress {
  return {
    ...DEFAULT_PROGRESS,
    achievements: [],
    courses: {},
    ...overrides,
  };
}

function result(overrides: Partial<TestResult> = {}): TestResult {
  return {
    sessionId: "s1",
    completedAt: "2026-09-17T00:00:00.000Z",
    overallCEFR: "A1",
    modules: [
      {
        module: "vocabulary",
        theta: 0,
        se: 0.5,
        cefr: "A1",
        itemsAdministered: 1,
      },
    ],
    ...overrides,
  };
}

function moduleResult(module: ModuleType, cefr: CEFRLevel = "A1") {
  return { module, theta: 0, se: 0.5, cefr, itemsAdministered: 1 };
}

describe("achievements", () => {
  it("returns nothing for empty progress with no result", () => {
    expect(checkNewAchievements(progress())).toEqual([]);
  });

  it("unlocks first_test at one completed assessment only", () => {
    expect(checkNewAchievements(progress({ totalAssessments: 0 }))).not.toContain(
      "first_test"
    );
    expect(checkNewAchievements(progress({ totalAssessments: 1 }))).toContain(
      "first_test"
    );
    expect(checkNewAchievements(progress({ totalAssessments: 9 }))).toContain(
      "first_test"
    );
  });

  it.each([
    [0, []],
    [2, []],
    [3, ["streak_3"]],
    [6, ["streak_3"]],
    [7, ["streak_3", "streak_7"]],
    [30, ["streak_3", "streak_7"]],
  ] as Array<[number, string[]]>)(
    "maps streak %i to %j",
    (streak, expected) => {
      const newly = checkNewAchievements(progress({ streak }));
      expect(newly).toEqual(expected);
    }
  );

  it.each([
    [499, []],
    [500, ["xp_500"]],
    [1999, ["xp_500"]],
    [2000, ["xp_500", "xp_2000"]],
    [50_000, ["xp_500", "xp_2000"]],
  ] as Array<[number, string[]]>)("maps total xp %i to %j", (xp, expected) => {
    expect(checkNewAchievements(progress({ xp }))).toEqual(expected);
  });

  it("unlocks crown_vocab at three vocabulary crowns in the active course", () => {
    const withCrowns = (n: number) =>
      progress({
        activeCourse: "en",
        courses: { en: { moduleCrowns: { vocabulary: n } } },
      });
    expect(checkNewAchievements(withCrowns(2))).not.toContain("crown_vocab");
    expect(checkNewAchievements(withCrowns(3))).toContain("crown_vocab");
    expect(checkNewAchievements(withCrowns(5))).toContain("crown_vocab");
  });

  it("only counts crowns for the active course", () => {
    const otherCourseCrowns = progress({
      activeCourse: "en",
      courses: { es: { moduleCrowns: { vocabulary: 5 } } },
    });
    // crowns earned in Spanish do not unlock the English-course achievement
    expect(getCourseCrowns(otherCourseCrowns)).toEqual({});
    expect(checkNewAchievements(otherCourseCrowns)).not.toContain("crown_vocab");
  });

  it.each([
    ["A1", false],
    ["A2", false],
    ["B1", false],
    ["B2", true],
    ["C1", true],
    ["C2", true],
  ] as Array<[CEFRLevel, boolean]>)(
    "level_b2 for overallCEFR %s -> %s",
    (overallCEFR, unlocked) => {
      const newly = checkNewAchievements(
        progress(),
        result({ overallCEFR })
      );
      expect(newly.includes("level_b2")).toBe(unlocked);
    }
  );

  it("does not unlock result-gated achievements without a result", () => {
    const newly = checkNewAchievements(
      progress({ xp: 0, streak: 0, totalAssessments: 0 })
    );
    expect(newly).not.toContain("level_b2");
    expect(newly).not.toContain("all_modules");
  });

  it("unlocks all_modules when six modules are reported", () => {
    const six = [
      moduleResult("vocabulary"),
      moduleResult("grammar"),
      moduleResult("reading"),
      moduleResult("listening"),
      moduleResult("speaking"),
      moduleResult("writing"),
    ];
    expect(checkNewAchievements(progress(), result({ modules: six }))).toContain(
      "all_modules"
    );
    expect(
      checkNewAchievements(progress(), result({ modules: six.slice(0, 5) }))
    ).not.toContain("all_modules");
  });

  it("counts modulesIncluded when modules array is absent", () => {
    const included: ModuleType[] = [
      "vocabulary",
      "grammar",
      "reading",
      "listening",
      "speaking",
      "writing",
    ];
    const newly = checkNewAchievements(
      progress(),
      result({ modules: [], modulesIncluded: included })
    );
    expect(newly).toContain("all_modules");
  });

  it("handles unknown CEFR data without unlocking level_b2", () => {
    const weird = result({ overallCEFR: "Z9" as CEFRLevel });
    expect(() => checkNewAchievements(progress(), weird)).not.toThrow();
    expect(checkNewAchievements(progress(), weird)).not.toContain("level_b2");
  });

  it("is idempotent: already-unlocked achievements are not returned again", () => {
    const already = progress({
      totalAssessments: 1,
      streak: 7,
      xp: 2000,
      achievements: ["first_test", "streak_3", "streak_7", "xp_500", "xp_2000"],
    });
    const newly = checkNewAchievements(already);
    expect(newly).toEqual([]);
  });

  it("returns each newly-unlocked achievement exactly once", () => {
    const newly = checkNewAchievements(
      progress({ totalAssessments: 1, streak: 7 })
    );
    expect(newly).toEqual(["first_test", "streak_3", "streak_7"]);
    expect(new Set(newly).size).toBe(newly.length);
  });

  it("does not mutate the progress it inspects", () => {
    const p = progress({ totalAssessments: 1, streak: 3 });
    const before = [...p.achievements];
    checkNewAchievements(p);
    expect(p.achievements).toEqual(before);
    expect(p.achievements).toEqual([]);
  });

  it("unlocks the full catalogue for a maxed-out progress and result", () => {
    const maxed = progress({
      totalAssessments: 3,
      streak: 10,
      xp: 3000,
      activeCourse: "en",
      courses: { en: { moduleCrowns: { vocabulary: 4 } } },
    });
    const six = [
      moduleResult("vocabulary"),
      moduleResult("grammar"),
      moduleResult("reading"),
      moduleResult("listening"),
      moduleResult("speaking"),
      moduleResult("writing"),
    ];
    const newly = checkNewAchievements(
      maxed,
      result({ overallCEFR: "B2", modules: six })
    );
    expect(newly).toEqual([
      "first_test",
      "streak_3",
      "streak_7",
      "xp_500",
      "xp_2000",
      "crown_vocab",
      "level_b2",
      "all_modules",
    ]);
    // every granted id is a known catalogue entry
    const known = new Set(ACHIEVEMENTS.map((a) => a.id));
    for (const id of newly) expect(known.has(id)).toBe(true);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(
      ACHIEVEMENTS.length
    );
  });
});
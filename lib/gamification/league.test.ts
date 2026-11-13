import { afterEach, describe, expect, it, vi } from "vitest";
import {
  currentWeekKey,
  leagueFromWeeklyXp,
  leagueTierIndex,
  xpToNextLeague,
  type LeagueTier,
} from "./league";

describe("league", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("leagueFromWeeklyXp tier thresholds", () => {
    // [xp, expected tier] — includes the exact boundary, one below and one above
    const cases: Array<[number, LeagueTier]> = [
      [0, "bronze"],
      [-25, "bronze"],
      [49, "bronze"],
      [50, "silver"],
      [51, "silver"],
      [119, "silver"],
      [120, "gold"],
      [121, "gold"],
      [219, "gold"],
      [220, "sapphire"],
      [221, "sapphire"],
      [349, "sapphire"],
      [350, "ruby"],
      [351, "ruby"],
      [499, "ruby"],
      [500, "diamond"],
      [501, "diamond"],
      [100_000, "diamond"],
    ];

    it.each(cases)("maps weeklyXp %i to %s", (xp, expected) => {
      expect(leagueFromWeeklyXp(xp)).toBe(expected);
    });

    it("assigns the exact threshold to the reached tier (boundary is inclusive)", () => {
      expect(leagueFromWeeklyXp(50)).toBe("silver");
      expect(leagueFromWeeklyXp(49)).toBe("bronze");
      expect(leagueFromWeeklyXp(500)).toBe("diamond");
      expect(leagueFromWeeklyXp(499)).toBe("ruby");
    });
  });

  it("leagueTierIndex orders tiers monotonically from bronze to diamond", () => {
    const tiers: LeagueTier[] = [
      "bronze",
      "silver",
      "gold",
      "sapphire",
      "ruby",
      "diamond",
    ];
    const indexes = tiers.map(leagueTierIndex);
    expect(indexes).toEqual([0, 1, 2, 3, 4, 5]);

    // promotion: as weeklyXp rises the index never decreases
    let previous = -1;
    for (let xp = 0; xp <= 600; xp += 5) {
      const index = leagueTierIndex(leagueFromWeeklyXp(xp));
      expect(index).toBeGreaterThanOrEqual(previous);
      previous = index;
    }
    expect(previous).toBe(5);
  });

  it("demotes back through tiers when weeklyXp falls", () => {
    const descending = [600, 499, 400, 349, 300, 219, 150, 119, 60, 49, 0].map(
      (xp) => leagueFromWeeklyXp(xp)
    );
    expect(descending).toEqual([
      "diamond",
      "ruby",
      "ruby",
      "sapphire",
      "sapphire",
      "gold",
      "gold",
      "silver",
      "silver",
      "bronze",
      "bronze",
    ]);
    // non-increasing indexes
    const indexes = descending.map(leagueTierIndex);
    for (let i = 1; i < indexes.length; i += 1) {
      expect(indexes[i]).toBeLessThanOrEqual(indexes[i - 1]);
    }
  });

  it("xpToNextLeague reports the next achievable tier and exact gap", () => {
    const cases: Array<[number, LeagueTier, number]> = [
      [0, "silver", 50],
      [49, "silver", 1],
      [50, "gold", 70],
      [119, "gold", 1],
      [120, "sapphire", 100],
      [219, "sapphire", 1],
      [220, "ruby", 130],
      [349, "ruby", 1],
      [350, "diamond", 150],
      [499, "diamond", 1],
    ];
    for (const [xp, next, needed] of cases) {
      expect(xpToNextLeague(xp)).toEqual({ next, needed });
    }
  });

  it("xpToNextLeague stops at diamond for any xp at or above the cap", () => {
    expect(xpToNextLeague(500)).toEqual({ next: null, needed: 0 });
    expect(xpToNextLeague(5000)).toEqual({ next: null, needed: 0 });
    expect(leagueFromWeeklyXp(5000)).toBe("diamond");
  });

  it("xpToNextLeague never overshoots: applying `needed` reaches that next tier", () => {
    for (let xp = 0; xp < 500; xp += 7) {
      const { next, needed } = xpToNextLeague(xp);
      expect(next).not.toBeNull();
      expect(needed).toBeGreaterThan(0);
      expect(leagueFromWeeklyXp(xp)).not.toBe(next);
      expect(leagueFromWeeklyXp(xp + needed)).toBe(next);
      // one XP short must still be below the next tier
      expect(leagueFromWeeklyXp(xp + needed - 1)).not.toBe(next);
    }
  });

  describe("currentWeekKey", () => {
    it("returns a Monday (YYYY-MM-DD) that is stable within the week", () => {
      vi.useFakeTimers();
      const at = (iso: string) => {
        vi.setSystemTime(new Date(iso));
        return currentWeekKey();
      };

      const monday = at("2026-09-14T08:00:00Z");
      const wednesday = at("2026-09-16T23:30:00Z");
      const sunday = at("2026-09-20T12:00:00Z");
      expect(monday).toBe("2026-09-14");
      expect(wednesday).toBe(monday);
      expect(sunday).toBe(monday);

      // the key really is a Monday
      expect(new Date(`${monday}T00:00:00Z`).getUTCDay()).toBe(1);
    });

    it("rolls over to the next Monday at week boundaries", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-20T23:59:00Z")); // Sunday
      expect(currentWeekKey()).toBe("2026-09-14");
      vi.setSystemTime(new Date("2026-09-21T00:00:00Z")); // next Monday
      expect(currentWeekKey()).toBe("2026-09-21");
    });
  });
});
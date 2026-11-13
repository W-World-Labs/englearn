export type LeagueTier =
  | "bronze"
  | "silver"
  | "gold"
  | "sapphire"
  | "ruby"
  | "diamond";

const TIERS: LeagueTier[] = [
  "bronze",
  "silver",
  "gold",
  "sapphire",
  "ruby",
  "diamond",
];

/** Monday 00:00 local time, YYYY-MM-DD */
export function currentWeekKey(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function leagueFromWeeklyXp(xp: number): LeagueTier {
  if (xp >= 500) return "diamond";
  if (xp >= 350) return "ruby";
  if (xp >= 220) return "sapphire";
  if (xp >= 120) return "gold";
  if (xp >= 50) return "silver";
  return "bronze";
}

export function leagueTierIndex(tier: LeagueTier): number {
  return TIERS.indexOf(tier);
}

export function xpToNextLeague(
  weeklyXp: number
): { next: LeagueTier | null; needed: number } {
  const thresholds: Array<[number, LeagueTier]> = [
    [50, "silver"],
    [120, "gold"],
    [220, "sapphire"],
    [350, "ruby"],
    [500, "diamond"],
  ];
  for (const [min, tier] of thresholds) {
    if (weeklyXp < min) {
      return { next: tier, needed: min - weeklyXp };
    }
  }
  return { next: null, needed: 0 };
}
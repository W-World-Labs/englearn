import type { AchievementDef } from "./types";
import type { UserProgress } from "./types";
import { getCourseCrowns } from "./types";
import type { TestResult } from "@/lib/types";

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_test", icon: "🎯" },
  { id: "streak_3", icon: "🔥" },
  { id: "streak_7", icon: "⚡" },
  { id: "xp_500", icon: "⭐" },
  { id: "xp_2000", icon: "🌟" },
  { id: "crown_vocab", icon: "👑" },
  { id: "level_b2", icon: "📘" },
  { id: "all_modules", icon: "🏆" },
];

export function checkNewAchievements(
  progress: UserProgress,
  result?: TestResult
): string[] {
  const unlocked = new Set(progress.achievements);
  const newly: string[] = [];

  function grant(id: string) {
    if (!unlocked.has(id)) {
      newly.push(id);
      unlocked.add(id);
    }
  }

  if (progress.totalAssessments >= 1) grant("first_test");
  if (progress.streak >= 3) grant("streak_3");
  if (progress.streak >= 7) grant("streak_7");
  if (progress.xp >= 500) grant("xp_500");
  if (progress.xp >= 2000) grant("xp_2000");

  const crowns = getCourseCrowns(progress);
  if ((crowns.vocabulary ?? 0) >= 3) grant("crown_vocab");

  if (result) {
    const rank = ["A1", "A2", "B1", "B2", "C1", "C2"];
    if (rank.indexOf(result.overallCEFR) >= rank.indexOf("B2")) grant("level_b2");
    if (result.modulesIncluded?.length === 6 || result.modules.length >= 6) {
      grant("all_modules");
    }
  }

  return newly;
}
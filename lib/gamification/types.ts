import type { CEFRLevel, ModuleType } from "@/lib/types";
import type { LearningLanguageId } from "@/lib/i18n/types";
import { leagueFromWeeklyXp, type LeagueTier } from "./league";

export interface AchievementDef {
  id: string;
  icon: string;
}

export interface CourseProgress {
  moduleCrowns: Partial<Record<ModuleType, number>>;
}

export interface UserProgress {
  xp: number;
  streak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  dailyGoalXp: number;
  dailyXpToday: number;
  achievements: string[];
  totalAssessments: number;
  activeCourse: LearningLanguageId;
  courses: Partial<Record<LearningLanguageId, CourseProgress>>;
  weekKey: string;
  weeklyXp: number;
  /** Attempt ids that already paid completion XP (bounded, FIFO). */
  awardedXp?: string[];
  /** @deprecated migrated into courses[activeCourse] */
  moduleCrowns?: Partial<Record<ModuleType, number>>;
}

export const DEFAULT_PROGRESS: UserProgress = {
  xp: 0,
  streak: 0,
  longestStreak: 0,
  lastActiveDate: null,
  dailyGoalXp: 50,
  dailyXpToday: 0,
  achievements: [],
  totalAssessments: 0,
  activeCourse: "en",
  courses: {},
  weekKey: "",
  weeklyXp: 0,
};

export const CEFR_TO_CROWN: Record<CEFRLevel, number> = {
  A1: 0,
  A2: 1,
  B1: 2,
  B2: 3,
  C1: 4,
  C2: 5,
};

export function getCourseCrowns(
  progress: UserProgress,
  courseId: LearningLanguageId = progress.activeCourse
): Partial<Record<ModuleType, number>> {
  const c = progress.courses[courseId];
  if (c?.moduleCrowns) return c.moduleCrowns;
  if (courseId === "en" && progress.moduleCrowns) return progress.moduleCrowns;
  return {};
}

export function getLeagueTier(progress: UserProgress): LeagueTier {
  return leagueFromWeeklyXp(progress.weeklyXp);
}
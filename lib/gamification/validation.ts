import type { UserProgress } from "./types";

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const counter = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const ids = (value: unknown) => Array.isArray(value) && value.length <= 1000 &&
  value.every(id => typeof id === "string" && id.length > 0 && id.length <= 200);
const language = (value: unknown) => typeof value === "string" && /^[a-z]{2}(?:-[a-zA-Z]{2})?$/.test(value);
const modules = new Set(["vocabulary", "grammar", "reading", "listening", "speaking", "writing"]);
const crowns = (value: unknown) => record(value) && Object.entries(value).every(
  ([key, level]) => modules.has(key) && counter(level) && (level as number) <= 5,
);
const courses = (value: unknown) => record(value) && Object.entries(value).every(
  ([key, course]) => language(key) && record(course) && crowns(course.moduleCrowns),
);
const checks: Record<keyof UserProgress, (value: unknown) => boolean> = {
  xp: counter, streak: counter, longestStreak: counter, dailyGoalXp: counter,
  dailyXpToday: counter, weeklyXp: counter, totalAssessments: counter,
  achievements: ids, awardedXp: ids, activeCourse: language, courses,
  moduleCrowns: crowns,
  lastActiveDate: value => value === null || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)),
  // Accept both the date-based key and legacy ISO-week snapshots.
  weekKey: value => typeof value === "string" && /^(?:\d{4}-\d{2}-\d{2}|\d{4}-W\d{2})?$/.test(value),
};

/** Validate known fields; discard unknown fields instead of persisting them. */
export function parseProgressPatch(value: unknown): Partial<UserProgress> | null {
  if (!record(value)) return null;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(checks) as (keyof UserProgress)[]) {
    if (!Object.hasOwn(value, key)) continue;
    if (!checks[key](value[key])) return null;
    result[key] = value[key];
  }
  if (Array.isArray(result.awardedXp)) {
    result.awardedXp = [...new Set(result.awardedXp)].slice(-200);
  }
  return result as Partial<UserProgress>;
}

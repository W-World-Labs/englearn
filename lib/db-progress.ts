import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { UserProgress } from "@/lib/gamification/types";
import { DEFAULT_PROGRESS } from "@/lib/gamification/types";

type ProgressStore = Record<string, UserProgress>;

function progressFile(): string {
  return path.join(process.env.ENGLEARN_DATA_DIR || path.join(process.cwd(), "data"), "user-progress.json");
}

function readStore(): ProgressStore {
  let raw: string;
  try {
    raw = fs.readFileSync(progressFile(), "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
  // A corrupt shared store is not an empty store: fail closed so the next
  // user's save cannot silently erase everyone else's progress.
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid stored user progress");
  }
  return parsed as ProgressStore;
}

function writeStore(store: ProgressStore): void {
  const file = progressFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(store, null, 2), { encoding: "utf-8", mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

export function getUserProgress(userId: string): UserProgress | null {
  const store = readStore();
  return Object.hasOwn(store, userId) ? store[userId] : null;
}

export function saveUserProgress(userId: string, progress: UserProgress): void {
  const store = readStore();
  writeStore({ ...store, [userId]: progress });
}

/** Merge individual module results; a course entry is not a complete snapshot. */
export function mergeCourseProgress(
  existing: UserProgress["courses"] = {},
  incoming: UserProgress["courses"] = {},
): UserProgress["courses"] {
  const merged = { ...existing };
  for (const language of Object.keys(incoming) as (keyof UserProgress["courses"])[]) {
    merged[language] = {
      moduleCrowns: {
        ...existing[language]?.moduleCrowns,
        ...incoming[language]?.moduleCrowns,
      },
    };
  }
  return merged;
}

export function mergeUserProgress(
  userId: string,
  incoming: Partial<UserProgress>,
): UserProgress {
  const existing = getUserProgress(userId) ?? { ...DEFAULT_PROGRESS };
  const merged: UserProgress = {
    ...DEFAULT_PROGRESS,
    ...existing,
    ...incoming,
    achievements: [
      ...new Set([
        ...(existing.achievements ?? []),
        ...(incoming.achievements ?? []),
      ]),
    ],
    awardedXp: [
      ...new Set([
        ...(existing.awardedXp ?? []),
        ...(incoming.awardedXp ?? []),
      ]),
    ].slice(-200),
    courses: mergeCourseProgress(existing.courses, incoming.courses),
    moduleCrowns: { ...existing.moduleCrowns, ...incoming.moduleCrowns },
  };
  saveUserProgress(userId, merged);
  return merged;
}

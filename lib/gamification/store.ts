import type { TestResult } from "@/lib/types";
import type { LearningLanguageId } from "@/lib/i18n/types";
import { loadLearningLanguage } from "@/lib/i18n/storage";
import {
  CEFR_TO_CROWN,
  DEFAULT_PROGRESS,
  type CourseProgress,
  type UserProgress,
} from "./types";
import { checkNewAchievements } from "./achievements";
import {
  xpForCompletedAssessment,
  xpForCorrectAnswer,
  xpForWrongAnswer,
} from "./xp";
import { currentWeekKey } from "./league";

const STORAGE_KEY = "lingolearn:progress";
let progressAccount: string | null = null;
let accountGeneration = 0;
let localRevision = 0;
let cloudReady = false;
let switchingAccount = false;
let accountRequests = new AbortController();
let cloudSync: { account: string; generation: number; promise: Promise<boolean> } | null = null;
type CloudWrite = { account: string; generation: number; body: string };
let pendingWrite: CloudWrite | null = null;
let cloudWriter: { generation: number; promise: Promise<void> } | null = null;

export function getProgressAccount(): string | null {
  return progressAccount;
}

function storageKey(account = progressAccount): string {
  return account === null
    ? STORAGE_KEY
    : `${STORAGE_KEY}:account:${encodeURIComponent(account)}`;
}

function resetAccountRequests(): void {
  accountRequests.abort();
  accountRequests = new AbortController();
  accountGeneration += 1;
  cloudReady = false;
  cloudSync = null;
  pendingWrite = null;
  cloudWriter = null;
}

/** Only a verified auth response may select an account's browser record. */
export function setProgressAccount(account: string | null): void {
  resetAccountRequests();
  progressAccount = account;
  localRevision = 0;
  switchingAccount = false;
}

/** Keep the previous UI's writes in its old namespace until the new cache is ready. */
export async function switchProgressAccount(
  account: string | null,
  isCurrent: () => boolean = () => true,
): Promise<boolean> {
  if (account === progressAccount && !switchingAccount) {
    // Refreshing the same identity must drain, not abort, its active writer:
    // an aborted request may already have reached the server.
    const generation = accountGeneration;
    if (account !== null) await syncProgressWithCloud(account).catch(() => false);
    return generation === accountGeneration && isCurrent();
  }
  resetAccountRequests();
  switchingAccount = true;
  const generation = accountGeneration;
  const synced = account !== null && await syncProgressWithCloud(account).catch(() => false);
  if (generation !== accountGeneration) return false;
  if (!isCurrent()) {
    switchingAccount = false;
    return false;
  }
  progressAccount = account;
  localRevision = 0;
  switchingAccount = false;
  cloudReady = synced;
  return true;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function cloneCourses(
  courses: Partial<Record<LearningLanguageId, CourseProgress>> | null | undefined
): Partial<Record<LearningLanguageId, CourseProgress>> {
  const cloned: Partial<Record<LearningLanguageId, CourseProgress>> = {};
  for (const courseId of Object.keys(courses ?? {}) as LearningLanguageId[]) {
    cloned[courseId] = {
      moduleCrowns: { ...(courses?.[courseId]?.moduleCrowns ?? {}) },
    };
  }
  return cloned;
}

function defaultProgress(): UserProgress {
  return { ...DEFAULT_PROGRESS, courses: cloneCourses(DEFAULT_PROGRESS.courses) };
}

function migrateProgress(raw: Partial<UserProgress>): UserProgress {
  const p: UserProgress = { ...DEFAULT_PROGRESS, ...raw };
  // The shallow spread above aliases `DEFAULT_PROGRESS.courses` whenever the
  // record omits it, and `setCourseCrowns` writes into `p.courses`; clone it so
  // no single flow can mutate the exported defaults.
  p.courses = cloneCourses(p.courses);

  const course = loadLearningLanguage();
  // Fall back to the stored course preference only when the record itself has
  // no active course: `p.activeCourse` is always "en" via the merged defaults,
  // so reading it back would short-circuit the preference forever.
  p.activeCourse = raw.activeCourse ?? course;

  if (p.moduleCrowns && Object.keys(p.moduleCrowns).length > 0) {
    p.courses.en = {
      moduleCrowns: { ...p.moduleCrowns, ...(p.courses.en?.moduleCrowns ?? {}) },
    };
  }

  const wk = currentWeekKey();
  if (p.weekKey !== wk) {
    p.weekKey = wk;
    p.weeklyXp = 0;
  }
  if (!p.weekKey) {
    p.weekKey = wk;
    p.weeklyXp = p.weeklyXp ?? 0;
  }

  return p;
}

function addWeeklyXp(p: UserProgress, amount: number): void {
  const wk = currentWeekKey();
  if (p.weekKey !== wk) {
    p.weekKey = wk;
    p.weeklyXp = 0;
  }
  p.weeklyXp += amount;
}

export function loadProgress(): UserProgress {
  return loadAccountProgress(progressAccount);
}

function loadAccountProgress(account: string | null): UserProgress {
  if (typeof window === "undefined") return defaultProgress();
  try {
    const raw = localStorage.getItem(storageKey(account));
    if (!raw) return migrateProgress({});
    return migrateProgress(JSON.parse(raw) as Partial<UserProgress>);
  } catch {
    return migrateProgress({});
  }
}

export function saveProgress(progress: UserProgress): void {
  if (typeof window === "undefined") return;
  localRevision += 1;
  persistProgress(progress);
  pushProgressToCloud(progress);
}

function persistProgress(progress: UserProgress, account = progressAccount): void {
  try {
    localStorage.setItem(storageKey(account), JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

function pushProgressToCloud(progress: UserProgress): void {
  if (progressAccount === null || switchingAccount) return;
  // Serialize now: callers may continue mutating the object after saving it.
  pendingWrite = {
    account: progressAccount,
    generation: accountGeneration,
    body: JSON.stringify({ progress }),
  };
  if (!cloudReady) {
    // A transient startup failure must not disable cloud persistence forever.
    // Retry through the merge endpoint before allowing replacement writes.
    void syncProgressWithCloud().catch(() => {});
    return;
  }
  startCloudWriter();
}

function startCloudWriter(): void {
  if (cloudWriter || cloudSync || !cloudReady || switchingAccount || !pendingWrite) return;
  const generation = accountGeneration;
  const promise = writePendingProgress(generation);
  cloudWriter = { generation, promise };
  void promise.finally(() => {
    if (cloudWriter?.promise !== promise) return;
    cloudWriter = null;
    // A save may land after the last response but before this cleanup runs.
    if (cloudReady) startCloudWriter();
  }).catch(() => {});
}

async function writePendingProgress(generation: number): Promise<void> {
  while (generation === accountGeneration && cloudReady && !switchingAccount && pendingWrite) {
    const write = pendingWrite;
    pendingWrite = null;
    try {
      const res = await fetch("/api/progress", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-LingoLearn-Account": write.account,
        },
        body: write.body,
        signal: AbortSignal.any([accountRequests.signal, AbortSignal.timeout(10000)]),
      });
      if (!res.ok) throw new Error("Progress save failed");
    } catch {
      if (generation === accountGeneration) {
        // Keep a newer queued snapshot if one arrived during the failed write.
        pendingWrite ??= write;
        cloudReady = false;
      }
      return;
    }
  }
}

/** Merge only this account's cache; the legacy unowned record stays guest-only. */
export function syncProgressWithCloud(account = progressAccount): Promise<boolean> {
  if (typeof window === "undefined" || account === null) return Promise.resolve(false);
  const generation = accountGeneration;
  if (cloudSync?.account === account && cloudSync.generation === generation) return cloudSync.promise;
  if (account === progressAccount) cloudReady = false;
  const promise = mergeAccountProgress(account, generation);
  cloudSync = { account, generation, promise };
  void promise.finally(() => {
    if (cloudSync?.promise !== promise) return;
    cloudSync = null;
    if (cloudReady) startCloudWriter();
  }).catch(() => {});
  return promise;
}

async function mergeAccountProgress(account: string, generation: number): Promise<boolean> {
  const signal = AbortSignal.any([accountRequests.signal, AbortSignal.timeout(10000)]);
  // A replacement already in flight must settle before a merge is sent;
  // otherwise it could land afterwards and overwrite the merged snapshot.
  if (cloudWriter?.generation === generation) await cloudWriter.promise;

  while (generation === accountGeneration) {
    const revision = account === progressAccount ? localRevision : 0;
    let local: Partial<UserProgress> = {};
    try {
      // An absent account cache must not overwrite cloud preferences with defaults.
      if (localStorage.getItem(storageKey(account)) !== null) local = loadAccountProgress(account);
    } catch {
      /* Storage may be unavailable; the server record still remains usable. */
    }
    if (pendingWrite?.account === account && pendingWrite.generation === generation)
      local = JSON.parse(pendingWrite.body).progress as UserProgress;
    const res = await fetch("/api/progress", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-LingoLearn-Account": account,
      },
      body: JSON.stringify({ progress: local }),
      signal,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { progress?: UserProgress };
    if (generation !== accountGeneration || !data.progress) return false;
    // Progress earned while a sync was in flight must join the next merge,
    // rather than being replaced by the older server response.
    if (account === progressAccount && revision !== localRevision) continue;
    persistProgress(data.progress, account);
    if (pendingWrite?.account === account && pendingWrite.generation === generation)
      pendingWrite = null;
    if (account === progressAccount && !switchingAccount) cloudReady = true;
    return true;
  }
  return false;
}

export function syncActiveCourse(courseId: LearningLanguageId): UserProgress {
  const p = loadProgress();
  p.activeCourse = courseId;
  saveProgress(p);
  return p;
}

/**
 * Passive displays call this instead of touchDailyActivity: it clears a
 * stale daily-XP counter without counting the day toward the streak.
 * Only an XP-earning action marks a day active.
 */
export function resetDailyProgress(): UserProgress {
  const p = loadProgress();
  if (p.lastActiveDate === todayKey()) return p;
  p.dailyXpToday = 0;
  saveProgress(p);
  return p;
}

export function touchDailyActivity(): UserProgress {
  const p = loadProgress();
  const today = todayKey();

  if (p.lastActiveDate === today) {
    return p;
  }

  if (p.lastActiveDate === yesterdayKey()) {
    p.streak += 1;
  } else if (p.lastActiveDate != null) {
    p.streak = 1;
  } else {
    p.streak = 1;
  }

  p.longestStreak = Math.max(p.longestStreak, p.streak);
  p.lastActiveDate = today;
  p.dailyXpToday = 0;
  saveProgress(p);
  return p;
}

export function addXp(amount: number): UserProgress {
  let p = loadProgress();
  if (p.lastActiveDate !== todayKey()) {
    // Use the returned value: device storage can be unavailable, so reloading
    // after saving may still return yesterday's/default state.
    p = touchDailyActivity();
  }
  p.xp += amount;
  p.dailyXpToday += amount;
  addWeeklyXp(p, amount);
  // Threshold achievements (XP totals, streaks, crowns) must unlock from any
  // XP-earning flow, not only completed assessments.
  p.achievements = [
    ...new Set([...p.achievements, ...checkNewAchievements(p)]),
  ];
  saveProgress(p);
  return p;
}

export function recordAnswerXp(correct: boolean): number {
  return correct ? xpForCorrectAnswer() : xpForWrongAnswer();
}

/** Award ids are kept bounded — completions are low-frequency events. */
const MAX_AWARDED_XP = 200;

/**
 * Awards XP at most once per key, recorded inside the synced progress
 * record so signed-in learners cannot collect twice across devices.
 * The key is marked before crediting: a mid-award crash cannot double-pay.
 */
export function addXpOnce(key: string, amount: number): UserProgress | null {
  if (typeof window === "undefined") return null;
  const p = loadProgress();
  const awarded = p.awardedXp ?? [];
  if (awarded.includes(key)) return null;
  p.awardedXp = [...awarded, key].slice(-MAX_AWARDED_XP);
  saveProgress(p);
  return addXp(amount);
}

function setCourseCrowns(
  p: UserProgress,
  courseId: LearningLanguageId,
  result: TestResult
): void {
  const existing: CourseProgress = p.courses[courseId] ?? { moduleCrowns: {} };
  const moduleCrowns = { ...existing.moduleCrowns };
  for (const m of result.modules) {
    moduleCrowns[m.module] = CEFR_TO_CROWN[m.cefr];
  }
  p.courses[courseId] = { moduleCrowns };
  if (courseId === p.activeCourse) {
    p.moduleCrowns = moduleCrowns;
  }
}

export function applyAssessmentResult(result: TestResult): {
  progress: UserProgress;
  xpGained: number;
  newAchievements: string[];
} {
  touchDailyActivity();
  const p = loadProgress();
  const courseId = loadLearningLanguage();

  const xpGained = xpForCompletedAssessment(result);
  p.xp += xpGained;
  p.dailyXpToday += xpGained;
  addWeeklyXp(p, xpGained);
  p.totalAssessments += 1;
  p.activeCourse = courseId;

  setCourseCrowns(p, courseId, result);

  const newAchievements = checkNewAchievements(p, result);
  p.achievements = [...new Set([...p.achievements, ...newAchievements])];

  saveProgress(p);
  return { progress: p, xpGained, newAchievements };
}

export function isDailyGoalMet(progress: UserProgress): boolean {
  return progress.dailyXpToday >= progress.dailyGoalXp;
}

export function setDailyGoal(xp: number): UserProgress {
  const p = loadProgress();
  p.dailyGoalXp = Math.max(10, Math.min(200, xp));
  saveProgress(p);
  return p;
}

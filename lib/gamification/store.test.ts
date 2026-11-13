import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addXp,
  addXpOnce,
  applyAssessmentResult,
  isDailyGoalMet,
  loadProgress,
  recordAnswerXp,
  saveProgress,
  setDailyGoal,
  syncActiveCourse,
  resetDailyProgress,
  setProgressAccount,
  switchProgressAccount,
  syncProgressWithCloud,
  touchDailyActivity,
} from "./store";
import {
  DEFAULT_PROGRESS,
  getCourseCrowns,
  type UserProgress,
} from "./types";
import { currentWeekKey } from "./league";
import { xpForCorrectAnswer, xpForWrongAnswer } from "./xp";
import type { LearningLanguageId } from "@/lib/i18n/types";
import type { CEFRLevel, ModuleResult, ModuleType, TestResult } from "@/lib/types";

const STORAGE_KEY = "lingolearn:progress";
const COURSE_KEY = "lingolearn:course";
/** Thursday noon UTC — deterministic anchor for all date-sensitive assertions. */
const FIXED_NOW = "2026-09-17T12:00:00.000Z";

let store: Map<string, string>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(FIXED_NOW));
  store = new Map();
  fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  });
  vi.stubGlobal("fetch", fetchMock);
  setProgressAccount(null);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function progress(overrides: Partial<UserProgress> = {}): UserProgress {
  return { ...DEFAULT_PROGRESS, ...overrides };
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((yes) => { resolve = yes; });
  return { promise, resolve };
}

function seed(partial: Partial<UserProgress>): void {
  store.set(STORAGE_KEY, JSON.stringify(partial));
}

function readStored(): Partial<UserProgress> {
  return JSON.parse(store.get(STORAGE_KEY) ?? "{}") as Partial<UserProgress>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function moduleResult(module: ModuleType, cefr: CEFRLevel = "A1"): ModuleResult {
  return { module, theta: 0, se: 0.5, cefr, itemsAdministered: 1 };
}

function testResult(
  overrides: Partial<TestResult> = {},
  modules: ModuleResult[] = [moduleResult("vocabulary", "B2")]
): TestResult {
  return {
    sessionId: "s1",
    completedAt: FIXED_NOW,
    overallCEFR: "B2",
    modules,
    ...overrides,
  };
}

describe("store persistence", () => {
  it("loads defaults when nothing is stored", () => {
    const p = loadProgress();
    expect(p.xp).toBe(0);
    expect(p.streak).toBe(0);
    expect(p.longestStreak).toBe(0);
    expect(p.lastActiveDate).toBeNull();
    expect(p.dailyGoalXp).toBe(50);
    expect(p.dailyXpToday).toBe(0);
    expect(p.achievements).toEqual([]);
    expect(p.totalAssessments).toBe(0);
    expect(p.weeklyXp).toBe(0);
    expect(p.courses).toEqual({});
    expect(p.weekKey).toBe(currentWeekKey());
    expect(p.activeCourse).toBe("en");
  });

  it("returns pristine defaults and skips writes when window is unavailable", () => {
    vi.stubGlobal("window", undefined);
    expect(loadProgress()).toEqual(DEFAULT_PROGRESS);
    saveProgress(progress({ xp: 999 }));
    expect(store.has(STORAGE_KEY)).toBe(false);
  });

  it("round-trips saved progress through localStorage", () => {
    const p = progress({
      xp: 321,
      streak: 4,
      longestStreak: 6,
      dailyGoalXp: 80,
      dailyXpToday: 40,
      achievements: ["first_test", "xp_500"],
      totalAssessments: 2,
      weeklyXp: 200,
      weekKey: currentWeekKey(),
      courses: { en: { moduleCrowns: { grammar: 2 } } },
    });
    saveProgress(p);
    expect(loadProgress()).toEqual(p);
    expect(readStored().xp).toBe(321);
  });

  it("keeps guest progress local until an account has been verified and synced", () => {
    saveProgress(progress({ xp: 7 }));
    expect(store.get(STORAGE_KEY)).toBeTruthy();
    expect(readStored().xp).toBe(7);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pushes account progress with its expected subject after initial sync", async () => {
    setProgressAccount("alice");
    fetchMock.mockResolvedValueOnce(Response.json({ progress: progress({ xp: 20 }) }));
    await syncProgressWithCloud();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockClear();
    saveProgress(progress({ xp: 27 }));
    expect(store.has(STORAGE_KEY)).toBe(false);
    expect(loadProgress().xp).toBe(27);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/progress");
    expect(init.method).toBe("PUT");
    expect(init.credentials).toBe("include");
    expect(new Headers(init.headers).get("X-LingoLearn-Account")).toBe("alice");
    expect(
      (JSON.parse(String(init.body)) as { progress: UserProgress }).progress.xp
    ).toBe(27);
  });

  it("serializes replacement writes and coalesces queued snapshots to the newest progress", async () => {
    setProgressAccount("alice");
    fetchMock.mockResolvedValueOnce(Response.json({ progress: progress({ xp: 10 }) }));
    await syncProgressWithCloud();
    fetchMock.mockClear();
    const writes: { snapshot: UserProgress; finish: () => void }[] = [];
    let server = progress({ xp: 10 });
    fetchMock.mockImplementation((_url: string, init: RequestInit) =>
      new Promise<Response>((resolve) => {
        const snapshot = JSON.parse(String(init.body)).progress as UserProgress;
        writes.push({ snapshot, finish: () => {
          server = snapshot;
          resolve(Response.json({ progress: server }));
        } });
      }));

    saveProgress(progress({ xp: 20, dailyGoalXp: 20 }));
    saveProgress(progress({ xp: 30, dailyGoalXp: 50 }));
    const latest = progress({ xp: 40, dailyGoalXp: 100 });
    saveProgress(latest);
    latest.xp = 999;
    expect(writes).toHaveLength(1);
    expect(writes[0].snapshot.xp).toBe(20);
    writes[0].finish();
    await vi.waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1].snapshot).toMatchObject({ xp: 40, dailyGoalXp: 100 });
    writes[1].finish();
    await Promise.resolve();
    expect(server).toMatchObject({ xp: 40, dailyGoalXp: 100 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("drains an active PUT before merging and includes changes queued during the merge", async () => {
    setProgressAccount("alice");
    fetchMock.mockResolvedValueOnce(Response.json({ progress: progress({ xp: 10 }) }));
    await syncProgressWithCloud();
    fetchMock.mockClear();
    const writing = deferredResponse();
    const merging = deferredResponse();
    fetchMock.mockReturnValueOnce(writing.promise).mockReturnValueOnce(merging.promise)
      .mockResolvedValueOnce(Response.json({ progress: progress({ xp: 40, dailyGoalXp: 100 }) }));
    saveProgress(progress({ xp: 20 }));
    const sync = syncProgressWithCloud();
    saveProgress(progress({ xp: 30 }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    writing.resolve(Response.json({ progress: progress({ xp: 20 }) }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][1].method).toBe("POST");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body)).progress.xp).toBe(30);
    saveProgress(progress({ xp: 40, dailyGoalXp: 100 }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    merging.resolve(Response.json({ progress: progress({ xp: 30 }) }));
    expect(await sync).toBe(true);
    expect(fetchMock.mock.calls.map(([, init]) => init.method)).toEqual(["PUT", "POST", "POST"]);
    expect(JSON.parse(String(fetchMock.mock.calls[2][1].body)).progress).toMatchObject({ xp: 40, dailyGoalXp: 100 });
    expect(loadProgress()).toMatchObject({ xp: 40, dailyGoalXp: 100 });
  });

  it("retains the latest failed snapshot for explicit retry even when browser storage is blocked", async () => {
    setProgressAccount("alice");
    fetchMock.mockResolvedValueOnce(Response.json({ progress: progress({ xp: 10 }) }));
    await syncProgressWithCloud();
    fetchMock.mockClear();
    const blockedStorage = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("Browser storage blocked");
    });
    const writing = deferredResponse();
    fetchMock.mockReturnValueOnce(writing.promise);
    saveProgress(progress({ xp: 20 }));
    saveProgress(progress({ xp: 30, dailyGoalXp: 100 }));
    writing.resolve(new Response(null, { status: 503 }));
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(Response.json({ progress: progress({ xp: 30, dailyGoalXp: 100 }) }));
    expect(await syncProgressWithCloud()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].method).toBe("POST");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body)).progress).toMatchObject({ xp: 30, dailyGoalXp: 100 });
    blockedStorage.mockRestore();

    saveProgress(progress({ xp: 40 }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1].method).toBe("PUT");
    expect(JSON.parse(String(fetchMock.mock.calls[2][1].body)).progress.xp).toBe(40);
  });

  it("waits for an active account's PUT when refreshing the same authenticated account", async () => {
    setProgressAccount("alice");
    fetchMock.mockResolvedValueOnce(Response.json({ progress: progress({ xp: 10 }) }));
    await syncProgressWithCloud();
    fetchMock.mockClear();
    const writing = deferredResponse();
    fetchMock.mockReturnValueOnce(writing.promise)
      .mockResolvedValueOnce(Response.json({ progress: progress({ xp: 40 }) }));
    saveProgress(progress({ xp: 20 }));
    saveProgress(progress({ xp: 30 }));
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    const refreshing = switchProgressAccount("alice");
    saveProgress(progress({ xp: 40 }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(signal.aborted).toBe(false);
    writing.resolve(Response.json({ progress: progress({ xp: 20 }) }));
    expect(await refreshing).toBe(true);
    expect(fetchMock.mock.calls.map(([, init]) => init.method)).toEqual(["PUT", "POST"]);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body)).progress.xp).toBe(40);
    expect(loadProgress().xp).toBe(40);
  });

  it("aborts the old account writer without sending its queued snapshot into a new account", async () => {
    setProgressAccount("alice");
    fetchMock.mockResolvedValueOnce(Response.json({ progress: progress({ xp: 10 }) }));
    await syncProgressWithCloud();
    fetchMock.mockClear();
    const writing = deferredResponse();
    fetchMock.mockReturnValueOnce(writing.promise);
    saveProgress(progress({ xp: 20 }));
    saveProgress(progress({ xp: 30 }));
    const oldSignal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    setProgressAccount("bob");
    expect(oldSignal.aborted).toBe(true);
    expect(JSON.parse(store.get(`${STORAGE_KEY}:account:alice`)!).xp).toBe(30);

    fetchMock.mockResolvedValueOnce(Response.json({ progress: progress({ xp: 100 }) }));
    await syncProgressWithCloud();
    saveProgress(progress({ xp: 110 }));
    writing.resolve(Response.json({ progress: progress({ xp: 20 }) }));
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([, init]) => new Headers(init.headers).get("X-LingoLearn-Account")))
      .toEqual(["alice", "bob", "bob"]);
    expect(loadProgress().xp).toBe(110);
    setProgressAccount("alice");
    expect(loadProgress().xp).toBe(30);
  });

  it("separates Alice, Bob and legacy guest records without claiming another user's snapshot", async () => {
    seed({ xp: 900, awardedXp: ["guest-or-legacy-attempt"] });
    setProgressAccount("alice");
    fetchMock.mockResolvedValueOnce(Response.json({ progress: progress({ xp: 100 }) }));
    await syncProgressWithCloud();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ progress: {} });
    expect(loadProgress().xp).toBe(100);

    setProgressAccount(null);
    expect(loadProgress().xp).toBe(900);
    setProgressAccount("bob");
    fetchMock.mockResolvedValueOnce(Response.json({ progress: progress({ xp: 50 }) }));
    await syncProgressWithCloud();
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toEqual({ progress: {} });
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get("X-LingoLearn-Account")).toBe("bob");
    expect(loadProgress().xp).toBe(50);

    setProgressAccount("alice");
    expect(loadProgress().xp).toBe(100);
    expect(loadProgress().awardedXp ?? []).not.toContain("guest-or-legacy-attempt");
  });

  it("discards late sync replies even after switching away from and back to the same account", async () => {
    setProgressAccount("alice");
    let finishAlice!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { finishAlice = resolve; }));
    const pending = syncProgressWithCloud();
    const aliceSignal = fetchMock.mock.calls[0][1].signal as AbortSignal;

    setProgressAccount("bob");
    expect(aliceSignal.aborted).toBe(true);
    fetchMock.mockResolvedValueOnce(Response.json({ progress: progress({ xp: 50 }) }));
    await syncProgressWithCloud();
    setProgressAccount("alice");
    saveProgress(progress({ xp: 10 }));
    await syncProgressWithCloud();
    finishAlice(Response.json({ progress: progress({ xp: 999 }) }));
    await pending;
    expect(loadProgress().xp).toBe(10);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    setProgressAccount("bob");
    expect(loadProgress().xp).toBe(50);
  });

  it("merges again when progress is earned during initial sync instead of overwriting it", async () => {
    setProgressAccount("alice");
    store.set(`${STORAGE_KEY}:account:alice`, JSON.stringify(progress({ xp: 100 })));
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { finish = resolve; }));
    fetchMock.mockResolvedValueOnce(Response.json({ progress: progress({ xp: 120 }) }));
    const pending = syncProgressWithCloud();
    saveProgress(progress({ xp: 120 }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(Response.json({ progress: progress({ xp: 100 }) }));
    await pending;
    expect(loadProgress().xp).toBe(120);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body)).progress.xp).toBe(120);
  });

  it("retries a failed initial merge on the next write and cancels requests on logout", async () => {
    setProgressAccount("alice");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await syncProgressWithCloud();
    fetchMock.mockResolvedValueOnce(Response.json({ progress: progress({ xp: 10 }) }));
    saveProgress(progress({ xp: 10 }));
    await syncProgressWithCloud();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].method).toBe("POST");
    saveProgress(progress({ xp: 20 }));
    const signal = fetchMock.mock.calls[2][1].signal as AbortSignal;
    setProgressAccount(null);
    expect(signal.aborted).toBe(true);
    expect(loadProgress().xp).toBe(0);
    saveProgress(progress({ xp: 1 }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("keeps old UI mutations in the previous account until the new account cache is ready", async () => {
    setProgressAccount("alice");
    store.set(`${STORAGE_KEY}:account:alice`, JSON.stringify(progress({ xp: 100 })));
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { finish = resolve; }));
    const switching = switchProgressAccount("bob");
    expect(loadProgress().xp).toBe(100);
    saveProgress(progress({ xp: 150 }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(Response.json({ progress: progress({ xp: 50 }) }));
    expect(await switching).toBe(true);
    expect(loadProgress().xp).toBe(50);
    expect(JSON.parse(store.get(`${STORAGE_KEY}:account:alice`)!).xp).toBe(150);
  });

  it("does not activate a staged account after a newer auth refresh has begun", async () => {
    setProgressAccount("alice");
    store.set(`${STORAGE_KEY}:account:alice`, JSON.stringify(progress({ xp: 100 })));
    let current = true;
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { finish = resolve; }));
    const switching = switchProgressAccount("bob", () => current);
    current = false;
    finish(Response.json({ progress: progress({ xp: 50 }) }));
    expect(await switching).toBe(false);
    expect(loadProgress().xp).toBe(100);
  });

  it("recovers defaults from malformed stored JSON without throwing", () => {
    store.set(STORAGE_KEY, "{ not: valid json");
    const p = loadProgress();
    expect(p.xp).toBe(0);
    expect(p.achievements).toEqual([]);
    expect(p.weekKey).toBe(currentWeekKey());
  });

  it("recovers defaults from stored null and scalar JSON", () => {
    store.set(STORAGE_KEY, "null");
    expect(loadProgress().xp).toBe(0);
    store.set(STORAGE_KEY, "42");
    expect(loadProgress().xp).toBe(0);
    expect(loadProgress().courses).toEqual({});
  });

  it("merges partial records over the defaults", () => {
    seed({ xp: 250 });
    const p = loadProgress();
    expect(p.xp).toBe(250);
    expect(p.streak).toBe(0);
    expect(p.dailyGoalXp).toBe(50);
    expect(p.achievements).toEqual([]);
    expect(p.totalAssessments).toBe(0);
  });

  it("resets weeklyXp when the stored week is stale", () => {
    seed({ weeklyXp: 400, weekKey: "2000-01-01" });
    const stale = loadProgress();
    expect(stale.weeklyXp).toBe(0);
    expect(stale.weekKey).toBe(currentWeekKey());

    seed({ weeklyXp: 400, weekKey: currentWeekKey() });
    expect(loadProgress().weeklyXp).toBe(400);
  });

  it("migrates legacy moduleCrowns into the active course", () => {
    seed({
      activeCourse: "en",
      moduleCrowns: { vocabulary: 3, reading: 1 },
    });
    const p = loadProgress();
    expect(getCourseCrowns(p)).toEqual({ vocabulary: 3, reading: 1 });
    expect(p.courses.en?.moduleCrowns).toEqual({ vocabulary: 3, reading: 1 });
  });

  it("prefers already-migrated course crowns over the legacy field", () => {
    seed({
      activeCourse: "en",
      moduleCrowns: { vocabulary: 1 },
      courses: { en: { moduleCrowns: { vocabulary: 5 } } },
    });
    expect(getCourseCrowns(loadProgress())).toEqual({ vocabulary: 5 });
  });

  it("keeps crowns isolated per course", () => {
    seed({
      activeCourse: "es",
      courses: {
        en: { moduleCrowns: { vocabulary: 2 } },
        es: { moduleCrowns: { grammar: 4 } },
      },
    });
    const p = loadProgress();
    expect(p.activeCourse).toBe("es");
    expect(getCourseCrowns(p, "es")).toEqual({ grammar: 4 });
    expect(getCourseCrowns(p, "en")).toEqual({ vocabulary: 2 });
  });

  it("falls back to the stored course preference when progress has no active course", () => {
    // legacy/partial JSON may carry an explicit null for the course
    store.set(STORAGE_KEY, JSON.stringify({ activeCourse: null }));
    store.set(COURSE_KEY, "ja");
    expect(loadProgress().activeCourse).toBe("ja");
  });

  it("falls back to en for an unknown course preference", () => {
    store.set(STORAGE_KEY, JSON.stringify({ activeCourse: null }));
    store.set(COURSE_KEY, "not-a-language");
    expect(loadProgress().activeCourse).toBe("en");
  });

  it("honors the saved course preference when the record omits activeCourse", () => {
    // regression: the merged defaults' activeCourse ("en") used to short-circuit
    // the fallback, so an absent field never consulted the saved preference.
    seed({ xp: 10 });
    store.set(COURSE_KEY, "ja");
    expect(loadProgress().activeCourse).toBe("ja");
  });

  it("does not leak legacy crown migration into later default loads", () => {
    seed({ activeCourse: "en", moduleCrowns: { vocabulary: 3 } });
    expect(loadProgress().courses.en?.moduleCrowns).toEqual({ vocabulary: 3 });

    store.delete(STORAGE_KEY);
    const fresh = loadProgress();
    expect(fresh.courses).toEqual({});
    expect(DEFAULT_PROGRESS.courses).toEqual({});
  });

  it("keeps an explicitly stored active course over the preference", () => {
    seed({ activeCourse: "ko" });
    store.set(COURSE_KEY, "ja");
    expect(loadProgress().activeCourse).toBe("ko");
  });

  it("switches the active course through syncActiveCourse", () => {
    seed({ courses: { en: { moduleCrowns: { reading: 2 } } } });
    const p = syncActiveCourse("ko" as LearningLanguageId);
    expect(p.activeCourse).toBe("ko");
    expect(readStored().activeCourse).toBe("ko");
    expect(p.courses.en?.moduleCrowns).toEqual({ reading: 2 });
  });
});

describe("store activity, streak and daily goal", () => {
  it.each([
    [5, 10],
    [9, 10],
    [10, 10],
    [75, 75],
    [200, 200],
    [999, 200],
  ])("setDailyGoal(%i) clamps to %i", (input, expected) => {
    const p = setDailyGoal(input);
    expect(p.dailyGoalXp).toBe(expected);
    expect(readStored().dailyGoalXp).toBe(expected);
  });

  it("isDailyGoalMet is inclusive at the goal", () => {
    expect(isDailyGoalMet(progress({ dailyXpToday: 49, dailyGoalXp: 50 }))).toBe(
      false
    );
    expect(isDailyGoalMet(progress({ dailyXpToday: 50, dailyGoalXp: 50 }))).toBe(
      true
    );
    expect(isDailyGoalMet(progress({ dailyXpToday: 120, dailyGoalXp: 50 }))).toBe(
      true
    );
  });

  it("addXp accumulates total, daily and weekly xp and stamps activity", () => {
    const first = addXp(30);
    expect(first.xp).toBe(30);
    expect(first.dailyXpToday).toBe(30);
    expect(first.weeklyXp).toBe(30);
    expect(first.streak).toBe(1);
    expect(first.lastActiveDate).toBe(today());

    const second = addXp(20);
    expect(second.xp).toBe(50);
    expect(second.dailyXpToday).toBe(50);
    expect(second.weeklyXp).toBe(50);
    expect(second.streak).toBe(1);
    expect(readStored().xp).toBe(50);
  });

  it("addXp resets a stale week before crediting new xp", () => {
    seed({
      xp: 100,
      weeklyXp: 400,
      weekKey: "2000-01-01",
      lastActiveDate: today(),
      streak: 3,
      dailyXpToday: 10,
    });
    const p = addXp(30);
    expect(p.weeklyXp).toBe(30);
    expect(p.xp).toBe(130);
    expect(p.weekKey).toBe(currentWeekKey());
  });

  it("addXp keeps accumulating weekly xp within the same week", () => {
    seed({
      xp: 10,
      weeklyXp: 100,
      weekKey: currentWeekKey(),
      lastActiveDate: today(),
      streak: 2,
    });
    expect(addXp(30).weeklyXp).toBe(130);
  });

  it("addXp unlocks threshold achievements from any xp-earning flow", () => {
    seed({
      xp: 495,
      lastActiveDate: today(),
      streak: 7,
      longestStreak: 7,
    });
    const p = addXp(10);
    expect(p.achievements).toEqual(
      expect.arrayContaining(["xp_500", "streak_3", "streak_7"]),
    );
    // Re-awarding must not duplicate unlocked achievements.
    const again = addXp(5);
    expect(
      again.achievements.filter((id) => id === "xp_500"),
    ).toHaveLength(1);
  });

  it("addXpOnce pays a completion exactly once per key and records it", () => {
    const first = addXpOnce("exam-finish:a1", 28);
    expect(first?.xp).toBe(28);
    expect(first?.awardedXp).toContain("exam-finish:a1");
    // Same attempt id must never pay twice, even across reloads.
    expect(addXpOnce("exam-finish:a1", 28)).toBeNull();
    expect(loadProgress().xp).toBe(28);
    // A different attempt pays independently.
    const second = addXpOnce("vocab-finish:b2", 20);
    expect(second?.xp).toBe(48);
    expect(second?.awardedXp).toEqual(
      expect.arrayContaining(["exam-finish:a1", "vocab-finish:b2"]),
    );
    expect(readStored().awardedXp).toHaveLength(2);
  });

  it("touchDailyActivity is a no-op on the same day", () => {
    seed({ lastActiveDate: today(), streak: 5, longestStreak: 5 });
    const p = touchDailyActivity();
    expect(p.streak).toBe(5);
    expect(p.longestStreak).toBe(5);
    expect(p.lastActiveDate).toBe(today());
  });

  it("touchDailyActivity extends the streak from yesterday", () => {
    seed({ lastActiveDate: yesterday(), streak: 4, longestStreak: 4 });
    const p = touchDailyActivity();
    expect(p.streak).toBe(5);
    expect(p.longestStreak).toBe(5);
    expect(p.lastActiveDate).toBe(today());
    expect(p.dailyXpToday).toBe(0);
  });

  it("touchDailyActivity resets a broken streak but preserves longestStreak", () => {
    seed({
      lastActiveDate: "2026-09-01",
      streak: 5,
      longestStreak: 9,
      dailyXpToday: 120,
    });
    const p = touchDailyActivity();
    expect(p.streak).toBe(1);
    expect(p.longestStreak).toBe(9);
    expect(p.dailyXpToday).toBe(0);
  });

  it("touchDailyActivity seeds the first ever streak", () => {
    const p = touchDailyActivity();
    expect(p.streak).toBe(1);
    expect(p.longestStreak).toBe(1);
  });

  it("resetDailyProgress clears a stale daily counter without counting the day", () => {
    seed({
      lastActiveDate: yesterday(),
      streak: 4,
      longestStreak: 4,
      dailyXpToday: 60,
    });
    const p = resetDailyProgress();
    expect(p.dailyXpToday).toBe(0);
    expect(p.streak).toBe(4);
    expect(p.lastActiveDate).toBe(yesterday());
    // A later XP gain counts the day exactly once.
    const after = addXp(5);
    expect(after.streak).toBe(5);
    expect(after.lastActiveDate).toBe(today());
    expect(after.dailyXpToday).toBe(5);
  });

  it("resetDailyProgress is a no-op once the day is already active", () => {
    seed({ lastActiveDate: today(), streak: 3, dailyXpToday: 45 });
    const p = resetDailyProgress();
    expect(p.dailyXpToday).toBe(45);
    expect(p.streak).toBe(3);
  });

  it("recordAnswerXp maps correctness to the configured awards", () => {
    expect(recordAnswerXp(true)).toBe(10);
    expect(recordAnswerXp(false)).toBe(2);
    expect(recordAnswerXp(true)).toBe(xpForCorrectAnswer());
    expect(recordAnswerXp(false)).toBe(xpForWrongAnswer());
    expect(recordAnswerXp(true)).toBeGreaterThan(recordAnswerXp(false));
  });
});

describe("store assessment results", () => {
  it("awards xp, increments assessments and persists the outcome", () => {
    const { progress: p, xpGained, newAchievements } = applyAssessmentResult(
      testResult()
    );
    // 40 base + 15 per module + 20 B2 bonus
    expect(xpGained).toBe(75);
    expect(p.xp).toBe(75);
    expect(p.dailyXpToday).toBe(75);
    expect(p.weeklyXp).toBe(75);
    expect(p.totalAssessments).toBe(1);
    // default fixture: one B2 vocabulary module => 3 crowns + B2 overall
    expect(newAchievements).toEqual(["first_test", "crown_vocab", "level_b2"]);
    expect(p.achievements).toEqual(newAchievements);
    expect(readStored().xp).toBe(75);
    expect(readStored().totalAssessments).toBe(1);
    expect(readStored().achievements).toEqual(newAchievements);
  });

  it("records module crowns for the active course", () => {
    const modules = [moduleResult("vocabulary", "B2"), moduleResult("grammar", "A2")];
    const { progress: p } = applyAssessmentResult(
      testResult({ overallCEFR: "B2" }, modules)
    );
    expect(p.courses.en?.moduleCrowns).toEqual({ vocabulary: 3, grammar: 1 });
    expect(getCourseCrowns(p)).toEqual({ vocabulary: 3, grammar: 1 });
    // active-course snapshot mirrors the course map
    expect(p.moduleCrowns).toEqual({ vocabulary: 3, grammar: 1 });
  });

  it("unlocks level and all-modules achievements for a broad B2 result", () => {
    const modules = [
      moduleResult("vocabulary", "B2"),
      moduleResult("grammar", "B2"),
      moduleResult("reading", "B2"),
      moduleResult("listening", "B2"),
      moduleResult("speaking", "B2"),
      moduleResult("writing", "B2"),
    ];
    const { progress: p, newAchievements } = applyAssessmentResult(
      testResult({ overallCEFR: "B2" }, modules)
    );
    expect(newAchievements).toEqual([
      "first_test",
      "crown_vocab",
      "level_b2",
      "all_modules",
    ]);
    expect(p.achievements).toEqual([
      "first_test",
      "crown_vocab",
      "level_b2",
      "all_modules",
    ]);
  });

  it("is idempotent across repeat assessments", () => {
    const first = applyAssessmentResult(testResult());
    expect(first.newAchievements).toEqual([
      "first_test",
      "crown_vocab",
      "level_b2",
    ]);

    const second = applyAssessmentResult(testResult());
    expect(second.newAchievements).toEqual([]);
    expect(second.progress.totalAssessments).toBe(2);
    expect(second.progress.achievements).toEqual([
      "first_test",
      "crown_vocab",
      "level_b2",
    ]);
  });

  it("keeps assessment crowns scoped to the selected course", () => {
    seed({ courses: { en: { moduleCrowns: { reading: 1 } } } });
    store.set(COURSE_KEY, "es");

    const modules = [moduleResult("vocabulary", "C1")];
    const { progress: p } = applyAssessmentResult(
      testResult({ overallCEFR: "C1" }, modules)
    );
    expect(p.activeCourse).toBe("es");
    expect(p.courses.es?.moduleCrowns).toEqual({ vocabulary: 4 });
    expect(getCourseCrowns(p, "en")).toEqual({ reading: 1 });
  });

  it("does not leak assessment crowns into later default loads", () => {
    applyAssessmentResult(testResult());

    // wipe the record: a fresh load must not inherit the crowns written above
    store.delete(STORAGE_KEY);
    const fresh = loadProgress();
    expect(fresh.courses).toEqual({});
    expect(fresh.moduleCrowns).toBeUndefined();
    expect(DEFAULT_PROGRESS.courses).toEqual({});
  });

  it("clamps daily-xp growth into the weekly and total counters consistently", () => {
    seed({
      xp: 100,
      weeklyXp: 100,
      weekKey: currentWeekKey(),
      dailyXpToday: 25,
      lastActiveDate: today(),
    });
    const { progress: p, xpGained } = applyAssessmentResult(testResult());
    expect(p.xp).toBe(100 + xpGained);
    expect(p.dailyXpToday).toBe(25 + xpGained);
    expect(p.weeklyXp).toBe(100 + xpGained);
  });
});

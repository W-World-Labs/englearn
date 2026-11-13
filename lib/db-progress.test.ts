import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getSsoConfig } from "@/lib/auth/config";
import { DEFAULT_PROGRESS, type UserProgress } from "@/lib/gamification/types";

let directory = "",
  alice = "";
const origin = "http://localhost:31971";

function request(body?: unknown, token = alice) {
  return new Request(`${origin}/api/progress/sync`, {
    method: "POST",
    headers: {
      cookie: `lingolearn_session=${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const progress = (patch: Partial<UserProgress>): UserProgress => ({
  ...DEFAULT_PROGRESS,
  lastActiveDate: "2026-09-22",
  weekKey: "2026-W39",
  ...patch,
});

beforeAll(async () => {
  vi.stubEnv("W_ID_CLIENT_ID", "ielts-local-test");
  vi.stubEnv("W_ID_CLIENT_SECRET", "test-only-client-secret");
  vi.stubEnv(
    "JWT_SECRET",
    "test-only-jwt-secret-at-least-thirty-two-characters",
  );
  vi.stubEnv("W_ID_REDIRECT_URI", `${origin}/api/auth/callback`);
  const config = getSsoConfig()!;
  alice = await config.signSessionClaims({
    sub: "alice",
    login: "alice",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
});
beforeEach(() => {
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "englearn-progress-"));
  vi.stubEnv("ENGLEARN_DATA_DIR", directory);
});
afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

it("unions awardedXp ids across devices in the PUT merge so completions never pay twice", async () => {
  const { mergeUserProgress, getUserProgress } = await import(
    "@/lib/db-progress"
  );
  mergeUserProgress("u1", progress({ xp: 10, awardedXp: ["exam-finish:a"] }));
  const merged = mergeUserProgress("u1", {
    awardedXp: ["vocab-finish:b", "exam-finish:a"],
  });
  expect(merged.awardedXp).toEqual(["exam-finish:a", "vocab-finish:b"]);
  expect(getUserProgress("u1")?.awardedXp).toEqual(merged.awardedXp);
  expect(merged.xp).toBe(10);
});

it("bounds awardedXp to the latest 200 ids in both merge paths", async () => {
  const { mergeUserProgress } = await import("@/lib/db-progress");
  const incoming = Array.from({ length: 250 }, (_, i) => `attempt:${i}`);
  const merged = mergeUserProgress("u1", { awardedXp: incoming });
  expect(merged.awardedXp).toHaveLength(200);
  expect(merged.awardedXp).toContain("attempt:249");
  expect(merged.awardedXp).not.toContain("attempt:0");
});

it("sync keeps server-paid attempt ids when an older client snapshot uploads", async () => {
  const { handleProgressSync } = await import("@/lib/api/progress");
  const { saveUserProgress, getUserProgress } = await import(
    "@/lib/db-progress"
  );
  saveUserProgress(
    "alice",
    progress({ xp: 500, awardedXp: ["exam-finish:server"] }),
  );
  const res = await handleProgressSync(
    request({
      progress: progress({ xp: 300, awardedXp: ["vocab-finish:client"] }),
    }),
  );
  expect(res.status).toBe(200);
  const merged = (await res.json()).progress as UserProgress;
  expect(merged.xp).toBe(500);
  expect(merged.awardedXp?.sort()).toEqual([
    "exam-finish:server",
    "vocab-finish:client",
  ]);
  expect(getUserProgress("alice")?.awardedXp?.sort()).toEqual(
    merged.awardedXp,
  );
});

it("sync rejects unauthenticated calls", async () => {
  const { handleProgressSync } = await import("@/lib/api/progress");
  const res = await handleProgressSync(
    request({ progress: progress({}) }, "forged"),
  );
  expect(res.status).toBe(403);
});

it("atomically preserves the previous store if replacement fails and cleans temporary files", async () => {
  const { saveUserProgress, getUserProgress } = await import("@/lib/db-progress");
  saveUserProgress("alice", progress({ xp: 50 }));
  const file = path.join(directory, "user-progress.json");
  const before = fs.readFileSync(file, "utf8");
  const rename = vi.spyOn(fs, "renameSync").mockImplementation(() => { throw new Error("simulated rename failure"); });
  try {
    expect(() => saveUserProgress("alice", progress({ xp: 100 }))).toThrow("simulated rename failure");
  } finally {
    rename.mockRestore();
  }
  expect(fs.readFileSync(file, "utf8")).toBe(before);
  expect(getUserProgress("alice")?.xp).toBe(50);
  expect(fs.readdirSync(directory)).toEqual(["user-progress.json"]);
  expect(fs.statSync(file).mode & 0o777).toBe(0o600);
});

it.each(["{broken", "", "null", "[]", "7"])("preserves corrupt store %j instead of replacing other users' progress", async (raw) => {
  const { saveUserProgress, getUserProgress } = await import("@/lib/db-progress");
  const file = path.join(directory, "user-progress.json");
  fs.writeFileSync(file, raw);
  expect(() => getUserProgress("alice")).toThrow();
  expect(() => saveUserProgress("alice", progress({ xp: 100 }))).toThrow();
  expect(fs.readFileSync(file, "utf8")).toBe(raw);
});

it("handles prototype-like subject IDs as ordinary account keys", async () => {
  const { saveUserProgress, getUserProgress } = await import("@/lib/db-progress");
  for (const subject of ["__proto__", "constructor", "toString"]) {
    expect(getUserProgress(subject)).toBeNull();
    saveUserProgress(subject, progress({ xp: 20 }));
    expect(getUserProgress(subject)?.xp).toBe(20);
  }
  expect(getUserProgress("unrelated")).toBeNull();
});

it("rejects malformed progress patches before they can poison the stored record", async () => {
  const { handleProgressPut, handleProgressSync } = await import("@/lib/api/progress");
  const { saveUserProgress, getUserProgress } = await import("@/lib/db-progress");
  const initial = progress({ xp: 50 });
  saveUserProgress("alice", initial);
  const invalid = [null, [], true, "text", { xp: "100" }, { xp: -1 }, { streak: 1.5 }, { achievements: {} }, { achievements: [2] }, { awardedXp: "oops" }, { courses: null }, { courses: { en: { moduleCrowns: { grammar: 99 } } } }];
  for (const handler of [handleProgressPut, handleProgressSync]) {
    expect((await handler(request(null))).status).toBe(400);
    for (const patch of invalid) {
      expect((await handler(request({ progress: patch }))).status).toBe(400);
      expect(getUserProgress("alice")).toEqual(initial);
    }
  }
});

it("normalizes partial first-sync records and bounds awards without persisting unknown fields", async () => {
  const { handleProgressSync } = await import("@/lib/api/progress");
  const { getUserProgress } = await import("@/lib/db-progress");
  const response = await handleProgressSync(request({ progress: { xp: 5, awardedXp: Array.from({ length: 250 }, (_, i) => `attempt:${i}`), userId: "bob" } }));
  expect(response.status).toBe(200);
  const saved = getUserProgress("alice")!;
  expect(saved.xp).toBe(5);
  expect(saved.streak).toBe(0);
  expect(saved.achievements).toEqual([]);
  expect(saved.awardedXp).toHaveLength(200);
  expect(saved).not.toHaveProperty("userId");
  const retry = await handleProgressSync(request({ progress: { xp: 3 } }));
  expect(retry.status).toBe(200);
  expect((await retry.json()).progress.xp).toBe(5);
});

it("retains account preferences when an older or partial snapshot omits them", async () => {
  const { handleProgressSync } = await import("@/lib/api/progress");
  const { saveUserProgress, getUserProgress } = await import("@/lib/db-progress");
  saveUserProgress("alice", progress({ xp: 20, activeCourse: "es", dailyGoalXp: 100 }));
  expect((await handleProgressSync(request({ progress: { xp: 30 } }))).status).toBe(200);
  expect(getUserProgress("alice")).toMatchObject({ xp: 30, activeCourse: "es", dailyGoalXp: 100 });
});

it("retains unmentioned module crowns when PUT updates one module in a course", async () => {
  const { handleProgressPut } = await import("@/lib/api/progress");
  const { saveUserProgress, getUserProgress } = await import("@/lib/db-progress");
  saveUserProgress("alice", progress({ courses: {
    en: { moduleCrowns: { vocabulary: 2, grammar: 1 } },
    ja: { moduleCrowns: { reading: 3 } },
  }, moduleCrowns: { vocabulary: 2, grammar: 1 } }));
  const response = await handleProgressPut(request({ progress: {
    courses: { en: { moduleCrowns: { grammar: 3 } } },
    moduleCrowns: { grammar: 3 },
  } }));
  expect(response.status).toBe(200);
  expect(getUserProgress("alice")?.courses).toEqual({
    en: { moduleCrowns: { vocabulary: 2, grammar: 3 } },
    ja: { moduleCrowns: { reading: 3 } },
  });
  expect(getUserProgress("alice")?.moduleCrowns).toEqual({ vocabulary: 2, grammar: 3 });
});

it("keeps new offline module results when snapshot sync already has the same course", async () => {
  const { handleProgressSync } = await import("@/lib/api/progress");
  const { saveUserProgress, getUserProgress } = await import("@/lib/db-progress");
  saveUserProgress("alice", progress({ courses: { en: { moduleCrowns: { grammar: 1 } } } }));
  const response = await handleProgressSync(request({ progress: {
    courses: {
      en: { moduleCrowns: { grammar: 3, vocabulary: 2 } },
      ja: { moduleCrowns: { reading: 3 } },
    },
  } }));
  expect(response.status).toBe(200);
  // The existing server module still wins a conflict, while distinct results survive.
  expect(getUserProgress("alice")?.courses).toEqual({
    en: { moduleCrowns: { grammar: 1, vocabulary: 2 } },
    ja: { moduleCrowns: { reading: 3 } },
  });
});

it.each(["put", "sync"])("rejects %s from a tab belonging to another account before writing", async method => {
  const { handleProgressPut, handleProgressSync } = await import("@/lib/api/progress");
  const { saveUserProgress, getUserProgress } = await import("@/lib/db-progress");
  const initial = progress({ xp: 20 });
  saveUserProgress("alice", initial);
  const handler = method === "put" ? handleProgressPut : handleProgressSync;
  const stale = request({ progress: progress({ xp: 900 }) });
  stale.headers.set("X-LingoLearn-Account", "bob");
  expect((await handler(stale)).status).toBe(403);
  expect(getUserProgress("alice")).toEqual(initial);
  expect(getUserProgress("bob")).toBeNull();

  const current = request({ progress: progress({ xp: 30 }) });
  current.headers.set("X-LingoLearn-Account", "alice");
  expect((await handler(current)).status).toBe(200);
  expect(getUserProgress("alice")?.xp).toBe(30);
});

it("does not return a different cookie account's progress to a stale tab", async () => {
  const { handleProgressGet } = await import("@/lib/api/progress");
  const { saveUserProgress } = await import("@/lib/db-progress");
  saveUserProgress("alice", progress({ xp: 42 }));
  for (const expected of ["bob", ""]) {
    const req = new Request(`${origin}/api/progress`, {
      headers: { cookie: `lingolearn_session=${alice}`, "X-LingoLearn-Account": expected },
    });
    const denied = await handleProgressGet(req);
    expect(denied.status).toBe(403);
    expect(await denied.json()).not.toHaveProperty("progress");
  }
  const current = new Request(`${origin}/api/progress`, {
    headers: { cookie: `lingolearn_session=${alice}`, "X-LingoLearn-Account": "alice" },
  });
  expect((await (await handleProgressGet(current)).json()).progress.xp).toBe(42);
});

it.each([false, true])("keeps period counters attached to the newer date/week (older client: %s)", async olderClient => {
  const { handleProgressSync } = await import("@/lib/api/progress");
  const { saveUserProgress, getUserProgress } = await import("@/lib/db-progress");
  const old = progress({ xp: 500, streak: 10, longestStreak: 10, lastActiveDate: "2026-09-20", dailyXpToday: 100, weekKey: "2026-09-14", weeklyXp: 500 });
  const recent = progress({ xp: 505, streak: 1, longestStreak: 1, lastActiveDate: "2026-09-22", dailyXpToday: 5, weekKey: "2026-09-21", weeklyXp: 5 });
  saveUserProgress("alice", olderClient ? recent : old);
  const response = await handleProgressSync(request({ progress: olderClient ? old : recent }));
  expect(response.status).toBe(200);
  expect(getUserProgress("alice")).toMatchObject({ xp: 505, streak: 1, longestStreak: 10, lastActiveDate: "2026-09-22", dailyXpToday: 5, weekKey: "2026-09-21", weeklyXp: 5 });
});

it("merges same-period maxima including legacy ISO week labels and retains them on partial sync", async () => {
  const { handleProgressSync } = await import("@/lib/api/progress");
  const { saveUserProgress, getUserProgress } = await import("@/lib/db-progress");
  saveUserProgress("alice", progress({ streak: 3, dailyXpToday: 20, weekKey: "2026-09-21", weeklyXp: 40 }));
  expect((await handleProgressSync(request({ progress: progress({ streak: 2, dailyXpToday: 30, weekKey: "2026-W39", weeklyXp: 35 }) }))).status).toBe(200);
  expect(getUserProgress("alice")).toMatchObject({ streak: 3, dailyXpToday: 30, weekKey: "2026-09-21", weeklyXp: 40 });
  expect((await handleProgressSync(request({ progress: { xp: 50 } }))).status).toBe(200);
  expect(getUserProgress("alice")).toMatchObject({ xp: 50, streak: 3, dailyXpToday: 30, weekKey: "2026-09-21", weeklyXp: 40 });
});

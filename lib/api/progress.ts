import { DEFAULT_PROGRESS, type UserProgress } from "@/lib/gamification/types";
import { parseProgressPatch } from "@/lib/gamification/validation";
import { getUserProgress, mergeCourseProgress, mergeUserProgress, saveUserProgress } from "@/lib/db-progress";
import { getAuthUser, jsonForbidden, requestAccountMatches } from "@/lib/auth/request";

/** Compare legacy ISO-week snapshots with the date keys used by current clients. */
function comparableWeek(key: string): string {
  const legacy = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!legacy) return key;
  const monday = new Date(`${legacy[1]}-01-04T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() || 7) + 1 + (Number(legacy[2]) - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

/** GET /api/progress — cloud progress for logged-in user */
export async function handleProgressGet(req: Request) {
  const user = await getAuthUser(req);
  if (!user || !requestAccountMatches(req, user.sub)) return jsonForbidden();

  const progress = getUserProgress(user.sub);
  return Response.json({ progress: progress ?? null }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

/** PUT /api/progress — upsert cloud progress */
export async function handleProgressPut(req: Request) {
  const user = await getAuthUser(req);
  if (!user || !requestAccountMatches(req, user.sub)) return jsonForbidden();

  let body: { progress?: unknown } | null;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch = parseProgressPatch(body?.progress);
  if (!patch) {
    return Response.json({ error: "Invalid progress" }, { status: 400 });
  }

  const merged = mergeUserProgress(user.sub, patch);
  return Response.json({ progress: merged });
}

/** POST /api/progress — merge client snapshot (max XP/streak wins) */
export async function handleProgressSync(req: Request) {
  const user = await getAuthUser(req);
  if (!user || !requestAccountMatches(req, user.sub)) return jsonForbidden();

  let body: { progress?: unknown } | null;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch = parseProgressPatch(body?.progress);
  if (!patch) {
    return Response.json({ error: "Invalid progress" }, { status: 400 });
  }

  const client: UserProgress = { ...DEFAULT_PROGRESS, ...patch };
  const server = getUserProgress(user.sub);
  if (!server) {
    saveUserProgress(user.sub, client);
    return Response.json({ progress: client });
  }

  // Daily XP and the current streak belong to lastActiveDate; weekly XP
  // belongs to weekKey. Never relabel an older period's high-water mark.
  const sameDay = server.lastActiveDate === client.lastActiveDate;
  const daily = (client.lastActiveDate ?? "") > (server.lastActiveDate ?? "") ? client : server;
  const serverWeek = comparableWeek(server.weekKey);
  const clientWeek = comparableWeek(client.weekKey);
  const weekly = clientWeek > serverWeek ? client : server;

  const merged: UserProgress = {
    ...server,
    xp: Math.max(server.xp, client.xp),
    streak: sameDay ? Math.max(server.streak, client.streak) : daily.streak,
    longestStreak: Math.max(server.longestStreak, client.longestStreak),
    dailyXpToday: sameDay ? Math.max(server.dailyXpToday, client.dailyXpToday) : daily.dailyXpToday,
    weeklyXp: serverWeek === clientWeek ? Math.max(server.weeklyXp, client.weeklyXp) : weekly.weeklyXp,
    totalAssessments: Math.max(server.totalAssessments, client.totalAssessments),
    achievements: [...new Set([...server.achievements, ...client.achievements])],
    awardedXp: [
      ...new Set([...(server.awardedXp ?? []), ...(client.awardedXp ?? [])]),
    ].slice(-200),
    courses: mergeCourseProgress(client.courses, server.courses),
    moduleCrowns: { ...client.moduleCrowns, ...server.moduleCrowns },
    activeCourse: patch.activeCourse ?? server.activeCourse,
    dailyGoalXp: patch.dailyGoalXp ?? server.dailyGoalXp,
    lastActiveDate: daily.lastActiveDate,
    weekKey: weekly.weekKey,
  };

  saveUserProgress(user.sub, merged);
  return Response.json({ progress: merged });
}

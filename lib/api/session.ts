import { randomUUID } from "node:crypto";
import type { ClientItem, ModuleType, TestSession } from "@/lib/types";
import { createSession, deleteSession, getSession } from "@/lib/db";
import { getItemsByModule } from "@/lib/items";
import { estimateAbility, selectNextItem } from "@/lib/irt";
import { toClientItem } from "@/lib/api/shared";
import {
  getPendingClientItem,
  moduleResponseCounts,
} from "@/lib/session-helpers";
import {
  isCoursePlayable,
  DEDICATED_LANGUAGE_IDS,
  normalizeLearningLanguageId,
} from "@/lib/i18n/languages";
import { requireSessionAccess } from "@/lib/auth/access";
import { getAuthUser, jsonForbidden, requestAccountMatches } from "@/lib/auth/request";

const ALL_MODULES: ModuleType[] = [
  "vocabulary",
  "grammar",
  "reading",
  "listening",
  "speaking",
  "writing",
];

/**
 * POST /api/session
 * body { modules: ModuleType[] }
 * -> { sessionId, item: ClientItem | null, currentModule }
 *
 * Creates a fresh adaptive session and hands back the first item of the
 * first selected module (selected at theta = 0 via Fisher information).
 */
export async function handleSessionPost(req: Request) {
  let body: {
    modules?: ModuleType[];
    learningLanguage?: string;
    claimHash?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Never label the English fallback bank as a different learning language.
  // Existing sessions retain their original bank through the legacy resolver.
  const rawLanguage = body?.learningLanguage;
  if (
    rawLanguage != null &&
    (typeof rawLanguage !== "string" ||
      !/^[a-z]{2}(-[a-z]{2})?$/i.test(rawLanguage.trim()))
  ) {
    return Response.json(
      { error: "Invalid learning language", code: "invalid_learning_language" },
      { status: 400 },
    );
  }
  const learningLanguage = normalizeLearningLanguageId(rawLanguage);
  if (!isCoursePlayable(learningLanguage)) {
    return Response.json(
      {
        error: "No assessment bank is available for this learning language",
        code: "unsupported_learning_language",
        supportedLanguages: DEDICATED_LANGUAGE_IDS,
      },
      { status: 422 },
    );
  }

  // Validate / normalize the requested modules, preserving canonical order.
  const requested = Array.isArray(body?.modules) ? body.modules : [];
  const set = new Set(requested.filter((m) => ALL_MODULES.includes(m)));
  const modules: ModuleType[] =
    set.size > 0 ? ALL_MODULES.filter((m) => set.has(m)) : [...ALL_MODULES];

  const currentModule = modules[0];

  const claimHash =
    typeof body?.claimHash === "string" && /^[0-9a-f]{64}$/.test(body.claimHash)
      ? body.claimHash
      : undefined;

  const user = await getAuthUser(req);
  if (!requestAccountMatches(req, user?.sub ?? null)) return jsonForbidden();
  const session: TestSession = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    modules,
    currentModule,
    administeredItemIds: [],
    responses: [],
    ability: {},
    finished: false,
    learningLanguage,
    userId: user?.sub,
    claimHash,
  };

  // First item of the first module: estimate at the prior (theta 0) and pick
  // the most informative unused item from that module's bank.
  const bank = getItemsByModule(currentModule, session.learningLanguage);
  const startTheta = estimateAbility([]).theta;
  const first = selectNextItem(startTheta, bank, session.administeredItemIds);

  let clientItem: ClientItem | null = null;
  if (first) {
    session.administeredItemIds.push(first.id);
    clientItem = toClientItem(first);
  }

  createSession(session);

  return Response.json({
    sessionId: session.id,
    item: clientItem,
    currentModule: session.currentModule,
  });
}

/**
 * GET /api/session?sessionId=ID
 * Resume payload for an in-progress session.
 */
export async function handleSessionGet(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return Response.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const access = await requireSessionAccess(req, sessionId);
  if (!access.ok) return access.response;
  const session = access.session;

  if (session.finished) {
    return Response.json({
      sessionId: session.id,
      finished: true,
      learningLanguage: session.learningLanguage ?? "en",
      modules: session.modules,
      currentModule: session.currentModule,
      moduleCounts: moduleResponseCounts(session),
      item: null,
    });
  }

  return Response.json({
    sessionId: session.id,
    finished: false,
    learningLanguage: session.learningLanguage ?? "en",
    modules: session.modules,
    currentModule: session.currentModule,
    moduleCounts: moduleResponseCounts(session),
    item: getPendingClientItem(session),
    createdAt: session.createdAt,
  });
}

/**
 * DELETE /api/session?sessionId=ID
 * Abandon an in-progress session (client clears local storage too).
 */
export async function handleSessionDelete(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return Response.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const access = await requireSessionAccess(req, sessionId);
  if (!access.ok) return access.response;

  const removed = deleteSession(sessionId);
  if (!removed) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}

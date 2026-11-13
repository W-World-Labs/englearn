import type {
  ClientItem,
  ClientResponse,
  Item,
  ItemResponse,
  ModuleResult,
  ModuleType,
  TestResult,
  TestSession,
} from "@/lib/types";
import { getSession, updateSession, saveResult } from "@/lib/db";
import { getItemById, getItemsByModule } from "@/lib/items";
import {
  estimateAbility,
  selectNextItem,
  shouldStop,
  thetaToCEFR,
  overallCEFR,
} from "@/lib/irt";
import { toClientItem } from "@/lib/api/shared";
import { requireSessionAccess } from "@/lib/auth/access";
import { getPendingItemId } from "@/lib/session-helpers";

/** Modules whose responses are graded by an AI score (0..1) rather than a key. */
const OPEN_MODULES: ModuleType[] = ["speaking", "writing"];

/**
 * Grade a single response against its source item.
 *  - mcq / reading-mcq / listening-mcq: selectedIndex === answerIndex
 *  - vocabulary (yesno): "yes" to a real word is correct; "yes" to a
 *    pseudoword is wrong; "no" to a pseudoword is correct; "no" to a real
 *    word is wrong.
 *  - open: graded earlier by /api/score; `score` is read from the stored
 *    response. We treat correct = score >= 0.5 for ability estimation.
 */
function grade(
  item: Item,
  response: ClientResponse,
  priorScore?: number
): { correct: boolean; score?: number } {
  if (item.format === "open") {
    const score =
      typeof priorScore === "number"
        ? priorScore
        : typeof response.text === "string" && response.text.trim()
          ? 0.5
          : 0;
    return { correct: score >= 0.5, score };
  }

  if (item.format === "yesno") {
    const saidYes = response.selectedYes === true;
    const isReal = !item.isPseudoword;
    // Knowing a real word OR correctly rejecting a fake word counts correct.
    const correct = saidYes ? isReal : !isReal;
    return { correct };
  }

  // mcq / reading-mcq / listening-mcq
  const correct =
    typeof item.answerIndex === "number" &&
    response.selectedIndex === item.answerIndex;
  return { correct };
}

/** Responses for one module, mapped to the {irt, correct} shape EAP wants. */
function abilityInputs(session: TestSession, module: ModuleType) {
  const inputs: { irt: Item["irt"]; correct: boolean }[] = [];
  for (const r of session.responses) {
    if (r.module !== module) continue;
    const item = getItemById(r.itemId, session.learningLanguage);
    if (!item) continue;
    inputs.push({ irt: item.irt, correct: r.correct === true });
  }
  return inputs;
}

/** Build the final per-module + overall result and persist it. */
function buildResult(session: TestSession): TestResult {
  const modules: ModuleResult[] = session.modules.map((module) => {
    const est = session.ability[module] ?? { theta: 0, se: 1 };
    const moduleResponses = session.responses.filter(
      (r) => r.module === module
    );

    const result: ModuleResult = {
      module,
      theta: est.theta,
      se: est.se,
      cefr: thetaToCEFR(est.theta),
      itemsAdministered: moduleResponses.length,
    };

    if (OPEN_MODULES.includes(module)) {
      const scored = moduleResponses.filter(
        (r) => typeof r.score === "number"
      );
      if (scored.length > 0) {
        const avg =
          scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length;
        result.aiScore = avg;
        const snippets = scored
          .map((r) => r.aiFeedback?.trim())
          .filter((t): t is string => Boolean(t))
          .slice(-2);
        result.aiFeedback =
          snippets.length > 0
            ? snippets.join(" ")
            : `综合 ${scored.length} 项开放作答，平均得分 ${(
                avg * 100
              ).toFixed(0)}/100。`;
      }
    }

    return result;
  });

  const completedAt = new Date().toISOString();
  const started = new Date(session.createdAt).getTime();
  const durationSeconds = Math.max(
    0,
    Math.round((Date.now() - started) / 1000)
  );

  return {
    sessionId: session.id,
    userId: session.userId,
    completedAt,
    overallCEFR: overallCEFR(modules),
    learningLanguage: session.learningLanguage,
    modules,
    modulesIncluded: session.modules,
    durationSeconds,
    totalItems: session.responses.length,
  };
}

/**
 * POST /api/respond
 * body { sessionId, response: ClientResponse }
 * -> { item: ClientItem | null, currentModule, moduleDone, done }
 *
 * Grades the response, appends it, re-estimates the current module ability,
 * then either selects the next item in this module, advances to the next
 * module, or finishes the session (building + saving the TestResult).
 */
export async function handleRespondPost(req: Request) {
  let body: { sessionId?: string; response?: ClientResponse } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { sessionId, response } = body ?? {};
  if (typeof sessionId !== "string" || !sessionId ||
      !response || typeof response !== "object" || Array.isArray(response) ||
      typeof response.itemId !== "string" || !response.itemId) {
    return Response.json(
      { error: "Missing sessionId or response" },
      { status: 400 }
    );
  }

  const access = await requireSessionAccess(req, sessionId);
  if (!access.ok) return access.response;
  // Authorization awaits token verification. Re-read afterwards, then keep
  // validation and mutation synchronous so overlapping requests cannot both
  // advance a snapshot of the same pending question in this single process.
  const session = getSession(sessionId);
  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.finished) {
    return Response.json({
      item: null,
      currentModule: session.currentModule,
      moduleDone: true,
      done: true,
    });
  }

  if (getPendingItemId(session) !== response.itemId) {
    return Response.json({ error: "Item is no longer pending" }, { status: 409 });
  }

  const item = getItemById(response.itemId, session.learningLanguage);
  if (!item) {
    return Response.json(
      { error: "Item not found" },
      { status: 404 }
    );
  }

  if (item.module !== session.currentModule) {
    return Response.json({ error: "Item is not in the current module" }, { status: 409 });
  }
  const validAnswer = item.format === "open"
    ? typeof response.text === "string" && response.text.length <= 20_000
    : item.format === "yesno"
      ? typeof response.selectedYes === "boolean"
      : typeof response.selectedIndex === "number" && Number.isInteger(response.selectedIndex) &&
        response.selectedIndex >= 0 && response.selectedIndex < (item.options?.length ?? 0);
  if (!validAnswer) {
    return Response.json({ error: "Invalid answer for this item" }, { status: 400 });
  }

  // Read new scored drafts and legacy placeholders, binding any score to the
  // exact normalized answer that was evaluated.
  const existingIdx = session.responses.findIndex(
    (r) => r.itemId === response.itemId
  );
  const draft = session.pendingScore?.itemId === item.id
    ? session.pendingScore
    : existingIdx >= 0 ? session.responses[existingIdx] : undefined;
  const prior = item.format === "open" && draft?.text?.trim() === response.text?.trim()
    ? draft : undefined;
  const { correct, score } = grade(item, response, prior?.score);

  const itemResponse: ItemResponse = {
    itemId: response.itemId,
    selectedIndex: item.options ? response.selectedIndex : undefined,
    selectedYes: item.format === "yesno" ? response.selectedYes : undefined,
    text: item.format === "open" ? response.text : undefined,
    module: item.module,
    correct,
    score,
    aiFeedback: prior?.aiFeedback,
  };
  delete session.pendingScore;

  if (existingIdx >= 0) {
    session.responses[existingIdx] = itemResponse;
  } else {
    session.responses.push(itemResponse);
  }

  // Re-estimate ability for the module this item belongs to.
  const currentModule = session.currentModule;
  const est = estimateAbility(abilityInputs(session, currentModule));
  session.ability[currentModule] = est;

  const answeredInModule = session.responses.filter(
    (r) => r.module === currentModule
  ).length;

  const bank = getItemsByModule(currentModule, session.learningLanguage);
  const remaining = bank.some(
    (b) => !session.administeredItemIds.includes(b.id)
  );

  // Decide whether this module is finished.
  const moduleDone =
    !remaining || shouldStop(est, answeredInModule);

  let nextClientItem: ClientItem | null = null;
  let done = false;

  if (!moduleDone) {
    // Continue the current module: pick the next most-informative item.
    const next = selectNextItem(
      est.theta,
      bank,
      session.administeredItemIds
    );
    if (next) {
      session.administeredItemIds.push(next.id);
      nextClientItem = toClientItem(next);
    }
  }

  // moduleDone (or no next item could be selected) -> advance modules.
  if (moduleDone || !nextClientItem) {
    const idx = session.modules.indexOf(currentModule);
    let advanced = false;

    for (let i = idx + 1; i < session.modules.length; i++) {
      const nextModule = session.modules[i];
      session.currentModule = nextModule;
      const nextBank = getItemsByModule(nextModule, session.learningLanguage);
      const startTheta = estimateAbility([]).theta;
      const next = selectNextItem(
        startTheta,
        nextBank,
        session.administeredItemIds
      );
      if (next) {
        session.administeredItemIds.push(next.id);
        nextClientItem = toClientItem(next);
        advanced = true;
        break;
      }
      // Empty bank: record a prior-only ability estimate and keep advancing.
      session.ability[nextModule] = estimateAbility([]);
    }

    if (!advanced) {
      // All modules exhausted -> finish and persist the result.
      session.finished = true;
      const result = buildResult(session);
      saveResult(result);
      done = true;
      nextClientItem = null;
    }
  }

  updateSession(session);

  return Response.json({
    item: nextClientItem,
    currentModule: session.currentModule,
    moduleDone,
    done,
    lastGrade: {
      itemId: response.itemId,
      correct: itemResponse.correct === true,
      module: item.module,
      format: item.format,
    },
  });
}

import Anthropic from "@anthropic-ai/sdk";
import { getSession, updateSession } from "@/lib/db";
import { getItemById } from "@/lib/items";
import { getMessagesForLocale } from "@/lib/i18n/messages";
import { normalizeUiLocale } from "@/lib/i18n/ui-locales";
import {
  buildScoringSystemPrompt,
  scoringLocale,
  scoringToolDescription,
} from "@/lib/api/scoring-locale";
import { getPendingItemId } from "@/lib/session-helpers";
import { requireSessionAccess } from "@/lib/auth/access";

interface ScoreRequestBody {
  sessionId?: string;
  itemId?: string;
  text?: string;
  /** UI locale of the caller (e.g. from useI18n). Optional; defaults to zh-CN
   *  to preserve the current always-Chinese behaviour for old clients. */
  locale?: string;
}

interface ScoreResult {
  score: number;
  feedback: string;
}

type Provider = "anthropic" | "openai";

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

function scoreTool(
  learningLanguage?: string
): Anthropic.Beta.PromptCaching.PromptCachingBetaTool {
  const desc = scoringToolDescription(learningLanguage);
  return {
    name: "submit_score",
    description: desc,
    input_schema: {
      type: "object",
      properties: {
        score: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Score from 0 to 1.",
        },
        feedback: {
          type: "string",
          description: desc,
        },
      },
      required: ["score", "feedback"],
    },
  };
}

function clampScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

interface ScoreMessages {
  scoredDefault: string;
  serviceError: string;
  notConfigured: string;
  emptyAnswer: string;
}

/** Server-side UI strings for this route (NOT model prompt language). */
function scoreMessages(locale: unknown): ScoreMessages {
  const tree = getMessagesForLocale(
    normalizeUiLocale(typeof locale === "string" ? locale : undefined),
  );
  return tree.score as unknown as ScoreMessages;
}

/** Robustly pull a {score, feedback} object out of free-form model text. */
function parseScoreFromText(text: string, fallback: string): ScoreResult | null {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as {
      score?: unknown;
      feedback?: unknown;
    };
    const score = clampScore(parsed.score);
    if (score === null) return null;
    return {
      score,
      feedback:
        typeof parsed.feedback === "string" && parsed.feedback.trim()
          ? parsed.feedback.trim()
          : fallback,
    };
  } catch {
    return null;
  }
}

/** Decide which provider to use based on env config. Returns null if none configured. */
function resolveProvider(): Provider | null {
  const explicit = (process.env.LLM_PROVIDER ?? "").trim().toLowerCase();
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  // A bare base URL (e.g. a local Ollama/vLLM gateway) counts as configured
  // even without a key, since such gateways often need no auth.
  const hasOpenAI = Boolean(
    process.env.OPENAI_API_KEY || process.env.OPENAI_BASE_URL
  );

  if (explicit === "openai") return hasOpenAI ? "openai" : null;
  if (explicit === "anthropic") return hasAnthropic ? "anthropic" : null;

  // Auto-detect: prefer Anthropic, then any OpenAI-compatible config.
  if (hasAnthropic) return "anthropic";
  if (hasOpenAI) return "openai";
  return null;
}

async function scoreWithAnthropic(
  rubricBlock: string,
  userContent: string,
  learningLanguage: string | undefined,
  fb: ScoreMessages
): Promise<ScoreResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30000, maxRetries: 2 });
  const systemInstructions = buildScoringSystemPrompt(learningLanguage);

  const message = await client.beta.promptCaching.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 512,
    temperature: 0,
    system: [
      { type: "text", text: systemInstructions },
      {
        type: "text",
        text: rubricBlock,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [scoreTool(learningLanguage)],
    tool_choice: { type: "tool", name: "submit_score" },
    messages: [{ role: "user", content: userContent }],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock =>
      block.type === "tool_use" && block.name === "submit_score"
  );

  if (toolUse) {
    const input = toolUse.input as { score?: unknown; feedback?: unknown };
    const feedback =
      typeof input?.feedback === "string" && input.feedback.trim()
        ? input.feedback.trim()
        : fb.scoredDefault;
    const score = clampScore(input?.score);
    if (score === null) throw new Error("Scoring provider returned an invalid score");
    return { score, feedback };
  }

  // Fallback: try to parse a JSON object out of any returned text block.
  const textBlock = message.content.find(
    (block): block is Anthropic.Messages.TextBlock => block.type === "text"
  );
  const parsed = textBlock?.text
    ? parseScoreFromText(textBlock.text, fb.scoredDefault)
    : null;
  if (parsed) return parsed;

  throw new Error("Scoring provider returned no score");
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
}

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemContent: string,
  userContent: string,
  withJsonMode: boolean
): Promise<Response> {
  const payload: Record<string, unknown> = {
    model,
    temperature: 0,
    max_tokens: 512,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ],
  };
  // response_format json_object is supported by OpenAI/DeepSeek/vLLM and most
  // gateways; for those that reject it we retry without it (see caller).
  if (withJsonMode) payload.response_format = { type: "json_object" };

  return fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
}

async function scoreWithOpenAI(
  rubricBlock: string,
  userContent: string,
  learningLanguage: string | undefined,
  fb: ScoreMessages
): Promise<ScoreResult> {
  const baseUrl = (
    process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL
  ).replace(/\/+$/, "");
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

  // No native tool-calling assumption (max gateway compatibility): instruct the
  // model to emit strict JSON and parse it ourselves.
  const { feedbackLanguage } = scoringLocale(learningLanguage);
  const systemContent = `${buildScoringSystemPrompt(learningLanguage)}

${rubricBlock}

Output only strict JSON, no markdown:
{"score": number 0-1, "feedback": "brief feedback in ${feedbackLanguage}"}`;

  let res = await callOpenAICompatible(
    baseUrl,
    apiKey,
    model,
    systemContent,
    userContent,
    true
  );

  // Some gateways/models reject response_format — retry once without it.
  if (!res.ok && (res.status === 400 || res.status === 422)) {
    res = await callOpenAICompatible(
      baseUrl,
      apiKey,
      model,
      systemContent,
      userContent,
      false
    );
  }

  if (!res.ok) {
    throw new Error("Scoring provider request failed");
  }

  const data = (await res.json()) as ChatCompletionResponse;
  const content = data?.choices?.[0]?.message?.content ?? "";
  const parsed = parseScoreFromText(content ?? "", fb.scoredDefault);
  if (!parsed) throw new Error("Scoring provider returned an invalid score");
  return parsed;
}

export async function handleScorePost(request: Request) {
  let body: ScoreRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      typeof body.sessionId !== "string" || !body.sessionId ||
      typeof body.itemId !== "string" || !body.itemId ||
      typeof body.text !== "string" || body.text.length > 20_000) {
    return Response.json({ error: "Invalid scoring request" }, { status: 400 });
  }
  const { sessionId, itemId } = body;
  const access = await requireSessionAccess(request, sessionId);
  if (!access.ok) return access.response;
  const session = getSession(sessionId);
  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }
  if (getPendingItemId(session) !== itemId) {
    return Response.json({ error: "Item is no longer pending" }, { status: 409 });
  }
  const item = getItemById(itemId, session.learningLanguage);
  if (!item || item.format !== "open" || item.module !== session.currentModule) {
    return Response.json({ error: "Only pending open responses can be scored" }, { status: 400 });
  }

  const fb = scoreMessages(body.locale);
  const answer = body.text.trim();
  if (!answer) {
    return Response.json({ score: 0, feedback: fb.emptyAnswer });
  }
  const draft = session.pendingScore?.itemId === itemId
    ? session.pendingScore : session.responses.find(r => r.itemId === itemId);
  if (draft?.text?.trim() === answer && typeof draft.score === "number") {
    return Response.json({ score: draft.score, feedback: draft.aiFeedback ?? fb.scoredDefault });
  }
  const provider = resolveProvider();
  if (!provider) {
    return Response.json({ score: 0, feedback: fb.notConfigured });
  }
  const learningLanguage = session.learningLanguage;
  const rubric = item.rubric ?? "Score task response, coherence, range and accuracy from 0 to 1.";
  const prompt = item.prompt;

  const rubricBlock = `【题目】\n${prompt}\n\n【评分标准 rubric】\n${rubric}`;
  const userContent = `请依据上面的题目与评分标准，对以下学生作答进行评分。\n\n【学生作答】\n${answer}`;

  try {
    const result =
      provider === "anthropic"
        ? await scoreWithAnthropic(rubricBlock, userContent, learningLanguage, fb)
        : await scoreWithOpenAI(rubricBlock, userContent, learningLanguage, fb);

    // Provider calls can outlive submission or abandonment. Re-read and
    // validate before writing; a late score must never change committed work.
    const current = getSession(sessionId);
    if (!current) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }
    if (getPendingItemId(current) !== itemId) {
      return Response.json({ error: "Item is no longer pending" }, { status: 409 });
    }
    current.pendingScore = {
      itemId, text: answer, module: item.module,
      score: result.score, aiFeedback: result.feedback,
    };
    updateSession(current);

    return Response.json(result, { status: 200 });
  } catch {
    return Response.json(
      { score: 0, feedback: fb.serviceError },
      { status: 200 }
    );
  }
}
// Not migrated (kept Chinese): default rubric / missing-prompt / 【题目】 /
// rubricBlock / userContent templates below are model-prompt language,
// governed by scoringLocale(learningLanguage), not UI strings.

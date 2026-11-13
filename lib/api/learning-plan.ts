import { getAuthUser, requestAccountMatches } from "@/lib/auth/request";
import { getResults } from "@/lib/db";
import { learningStore } from "./learning";
import { vocabularyStore } from "./vocabulary";
import {
  LEARNING_LANGUAGES,
  type LearningLanguage,
} from "@/lib/learning/catalog";
import {
  arrangeLearning,
  learningEvidence,
  type AccountLearningPlan,
} from "@/lib/learning/plan";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user)
    return Response.json(
      { error: "Sign-in required" },
      { status: 401, headers },
    );
  if (!requestAccountMatches(request, user.sub))
    return Response.json(
      { error: "The signed-in account has changed" },
      { status: 403, headers },
    );
  const language = new URL(request.url).searchParams.get("language");
  if (!LEARNING_LANGUAGES.includes(language as LearningLanguage))
    return Response.json(
      { error: "Unsupported learning language" },
      { status: 400, headers },
    );
  try {
    const now = Date.now();
    const evidence = learningEvidence(
      language as LearningLanguage,
      getResults({ userId: user.sub, strict: true }),
      vocabularyStore.list(user.sub).map((a) => a.session),
      now,
    );
    const journal = learningStore.get(user.sub, "grammar-v1")?.session ?? null;
    const response: AccountLearningPlan = {
      version: 1,
      generatedAt: now,
      evidence,
      plan: arrangeLearning(evidence, journal, now),
    };
    return Response.json(response, { headers });
  } catch {
    return Response.json(
      { error: "Learning evidence unavailable" },
      { status: 503, headers },
    );
  }
}

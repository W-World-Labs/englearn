import type { CEFRLevel, ModuleResult, ModuleType, TestResult } from "@/lib/types";
import { studyTextLocale } from "@/lib/i18n/localized";
import { MODULE_STUDY_TIPS } from "./content";
import { thetaToScore } from "./scores";

const CEFR_RANK: Record<CEFRLevel, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

export interface ModuleInsight {
  module: ModuleType;
  cefr: CEFRLevel;
  score: number;
  role: "strength" | "focus" | "neutral";
}

export interface StudyPlanItem {
  module: ModuleType;
  priority: "high" | "medium";
  score: number;
  cefr: CEFRLevel;
  tips: string[];
}

export interface ResultAnalysis {
  overallCEFR: CEFRLevel;
  insights: ModuleInsight[];
  strengths: ModuleInsight[];
  focusAreas: ModuleInsight[];
  studyPlan: StudyPlanItem[];
  nextLevel: CEFRLevel | null;
}

export function analyzeResult(
  result: TestResult,
  uiLocale: string = "en"
): ResultAnalysis {
  const tipsLang = studyTextLocale(uiLocale);
  const insights: ModuleInsight[] = result.modules.map((m) => ({
    module: m.module,
    cefr: m.cefr,
    score: thetaToScore(m.theta),
    role: "neutral" as const,
  }));

  const sorted = [...insights].sort((a, b) => a.score - b.score);
  const focusCount = Math.min(2, Math.max(1, Math.floor(sorted.length / 3)));
  const strengthCount = Math.min(2, Math.max(1, Math.floor(sorted.length / 3)));

  const focusIds = new Set(
    sorted.slice(0, focusCount).map((x) => x.module)
  );
  const strengthIds = new Set(
    sorted.slice(-strengthCount).map((x) => x.module)
  );

  for (const ins of insights) {
    if (focusIds.has(ins.module)) ins.role = "focus";
    else if (strengthIds.has(ins.module)) ins.role = "strength";
  }

  const strengths = insights.filter((i) => i.role === "strength");
  const focusAreas = insights.filter((i) => i.role === "focus");

  const studyPlan: StudyPlanItem[] = focusAreas.map((f, idx) => ({
    module: f.module,
    priority: idx === 0 ? "high" : "medium",
    score: f.score,
    cefr: f.cefr,
    tips: MODULE_STUDY_TIPS[tipsLang][f.module] ?? [],
  }));

  const nextLevel = nextCefrLevel(result.overallCEFR);

  return {
    overallCEFR: result.overallCEFR,
    insights,
    strengths,
    focusAreas,
    studyPlan,
    nextLevel,
  };
}

function nextCefrLevel(current: CEFRLevel): CEFRLevel | null {
  const levels: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const idx = levels.indexOf(current);
  return idx < levels.length - 1 ? levels[idx + 1] : null;
}

/** Compose the localized one-line diagnosis shared by the report card and
 * the copyable share text. `t` is the i18n translator from useI18n(). */
export function summarizeAnalysis(
  analysis: ResultAnalysis,
  t: (path: string, params?: Record<string, string | number>) => string,
  uiLocale: string
): string {
  const sep = studyTextLocale(uiLocale) === "zh" ? "、" : ", ";
  const name = (m: ModuleType) => t(`modules.${m}`);
  const strong = analysis.strengths.length
    ? analysis.strengths.map((s) => name(s.module)).join(sep)
    : t("report.balanced");
  const weak = analysis.studyPlan.length
    ? analysis.studyPlan.map((s) => name(s.module)).join(sep)
    : t("report.noWeak");
  const next = analysis.nextLevel
    ? t("report.nextStep", { level: analysis.nextLevel, weak })
    : t("report.atC2");
  return t("report.summaryLine", {
    cefr: analysis.overallCEFR,
    strong,
    weak,
    next,
  });
}

/** Compare two results for history trend (CEFR rank delta). */
export function compareResults(
  newer: TestResult,
  older: TestResult
): { delta: number } {
  return { delta: CEFR_RANK[newer.overallCEFR] - CEFR_RANK[older.overallCEFR] };
}

export function formatDuration(
  seconds: number | undefined,
  uiLocale: string = "en"
): string {
  if (seconds == null || seconds <= 0) return "—";
  const zh = studyTextLocale(uiLocale) === "zh";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return zh ? `${s} 秒` : `${s} s`;
  if (s > 0) return zh ? `${m} 分 ${s} 秒` : `${m} min ${s} s`;
  return zh ? `${m} 分钟` : `${m} min`;
}

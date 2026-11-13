import { Link } from "@tanstack/react-router";
import { Badge, Card } from "@/components/ui";
import type { ResultAnalysis } from "@/lib/product/analysis";
import { summarizeAnalysis } from "@/lib/product/analysis";
import { useI18n } from "@/lib/i18n/context";
import type { ModuleType } from "@/lib/types";
import type { LearningTab } from "@/components/learning/LearningPage";
import type { ActivityKind } from "@/lib/learning/workbench";

export interface ImprovementPlanProps {
  analysis: ResultAnalysis;
  language?: string;
}

// Modules without a practice surface (speaking, writing) keep retest only.
const LEARN_TARGETS: Partial<
  Record<ModuleType, { tab: LearningTab; activity?: ActivityKind }>
> = {
  grammar: { tab: "courses" },
  reading: { tab: "reading" },
  listening: { tab: "reading", activity: "listening" },
};

export function ImprovementPlan({ analysis, language }: ImprovementPlanProps) {
  const { t, locale, setLearningLanguage } = useI18n();
  const { strengths, studyPlan, nextLevel } = analysis;
  const moduleName = (m: string) => t(`modules.${m}`);
  const summary = summarizeAnalysis(analysis, t, locale);

  return (
    <section className="space-y-6">
      <Card className="border-brand-100 bg-gradient-to-br from-brand-50/80 to-white p-6 md:p-8">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          {t("report.diagnosis")}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{summary}</p>
        {nextLevel && (
          <p className="mt-4 text-sm font-medium text-brand-700">
            {t("report.nextTarget", { level: nextLevel })}
          </p>
        )}
      </Card>

      {strengths.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            {t("report.strengths")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {strengths.map((s) => (
              <span
                key={s.module}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              >
                <span className="font-semibold">
                  {t(`modules.${s.module}Glyph`)} {moduleName(s.module)}
                </span>
                <Badge variant="success">{s.cefr}</Badge>
                <span className="text-xs">{s.score}/100</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {studyPlan.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            {t("report.planTitle")}
          </h3>
          <div className="space-y-4">
            {studyPlan.map((item) => (
              <Card key={item.module} className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient text-sm font-bold text-white">
                    {t(`modules.${item.module}Glyph`)}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {moduleName(item.module)}
                  </span>
                  <Badge
                    variant={item.priority === "high" ? "brand" : "neutral"}
                  >
                    {item.priority === "high"
                      ? t("report.priorityHigh")
                      : t("report.priorityMedium")}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {t("report.focusReason", {
                    score: item.score,
                    cefr: item.cefr,
                  })}
                </p>
                <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-600">
                  {item.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-4">
                  {item.module === "vocabulary" ? (
                    <Link
                      to="/vocabulary"
                      onClick={() =>
                        language && setLearningLanguage(language)
                      }
                      data-testid="plan-learn"
                      data-module={item.module}
                      className="text-sm font-semibold text-brand-700 hover:underline"
                    >
                      {t("report.learnModule")} →
                    </Link>
                  ) : LEARN_TARGETS[item.module] ? (
                    <Link
                      to="/learn"
                      search={LEARN_TARGETS[item.module]}
                      onClick={() =>
                        language && setLearningLanguage(language)
                      }
                      data-testid="plan-learn"
                      data-module={item.module}
                      className="text-sm font-semibold text-brand-700 hover:underline"
                    >
                      {t("report.learnModule")} →
                    </Link>
                  ) : null}
                  <Link
                    to="/test"
                    search={{ modules: [item.module] }}
                    onClick={() => language && setLearningLanguage(language)}
                    className="text-sm font-semibold text-brand-700 hover:underline"
                  >
                    {t("report.retestModule")} →
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

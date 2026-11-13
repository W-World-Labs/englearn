
import * as React from "react";
import { Badge, Card, ProgressBar } from "@/components/ui";
import type { ModuleResult, CEFRLevel } from "@/lib/types";
import { thetaToScore } from "@/lib/product/scores";
import { useI18n } from "@/lib/i18n/context";

function cefrVariant(level: CEFRLevel): "neutral" | "default" | "success" | "brand" {
  if (level === "A1" || level === "A2") return "neutral";
  if (level === "B1" || level === "B2") return "default";
  if (level === "C1") return "success";
  return "brand";
}

export interface ModuleBreakdownProps {
  modules: ModuleResult[];
  className?: string;
}

/**
 * ModuleBreakdown
 * A responsive grid of per-module result cards: CEFR badge, normalized score
 * bar, item count, and module-specific callouts (AI feedback).
 */
export function ModuleBreakdown({ modules, className }: ModuleBreakdownProps) {
  const { t } = useI18n();
  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {modules.map((m) => {
          const score = thetaToScore(m.theta);
          const isOpen = m.aiScore != null || m.aiFeedback != null;

          return (
            <Card key={m.module} className="flex h-full flex-col p-6">
              {/* Header row */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-base font-bold text-white shadow-card">
                    {t(`modules.${m.module}Glyph`)}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-slate-900">
                      {t(`modules.${m.module}`)}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {t(`modules.${m.module}Desc`)}
                    </p>
                  </div>
                </div>
                <Badge variant={cefrVariant(m.cefr)} className="shrink-0">
                  {m.cefr} · {t(`report.cefr.${m.cefr}`)}
                </Badge>
              </div>

              {/* Score bar */}
              <div className="mt-5">
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    {t("report.abilityScore")}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {score}
                    <span className="text-xs font-normal text-slate-400">
                      {" "}
                      / 100
                    </span>
                  </span>
                </div>
                <ProgressBar value={score} max={100} />
              </div>

              {/* Stats */}
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <dt className="text-xs text-slate-500">
                    {t("report.items")}
                  </dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {t("report.countItems", { n: m.itemsAdministered })}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <dt className="text-xs text-slate-500">
                    {t("report.theta")}
                  </dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {m.theta.toFixed(2)}
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      ±{m.se.toFixed(2)}
                    </span>
                  </dd>
                </div>
              </dl>

              {/* AI feedback for open modules */}
              {isOpen && (
                <div className="mt-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-gradient text-[10px] font-bold text-white">
                      AI
                    </span>
                    <span className="text-xs font-medium text-slate-600">
                      {t("report.aiScoring")}
                    </span>
                    {m.aiScore != null && (
                      <span className="ml-auto text-sm font-semibold text-brand-600">
                        {t("report.pts", {
                          n: Math.round(m.aiScore * 100),
                        })}
                      </span>
                    )}
                  </div>
                  {m.aiFeedback ? (
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {m.aiFeedback}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm italic text-slate-400">
                      {t("report.noFeedback")}
                    </p>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default ModuleBreakdown;

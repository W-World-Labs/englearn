import { VocabularyEntry } from "@/components/vocabulary/VocabularyEntry";
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Button, Card } from "@/components/ui";
import type { TestResult, CEFRLevel } from "@/lib/types";
import { analyzeResult, formatDuration } from "@/lib/product/analysis";
import { useI18n } from "@/lib/i18n/context";
import { ImprovementPlan } from "./ImprovementPlan";
import { ShareReport } from "./ShareReport";
import { ScoreRadar } from "./ScoreRadar";
import { ModuleBreakdown } from "./ModuleBreakdown";

/** Approximate progress of a CEFR level toward C2, for the banner meter. */
const CEFR_PROGRESS: Record<CEFRLevel, number> = {
  A1: 16,
  A2: 33,
  B1: 50,
  B2: 67,
  C1: 84,
  C2: 100,
};

const CEFR_ORDER: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface ResultReportProps {
  result: TestResult;
}

/**
 * ResultReport
 * The full celebratory-but-professional report: overall CEFR hero banner,
 * a per-module radar chart, and detailed per-module breakdown cards.
 */
export function ResultReport({ result }: ResultReportProps) {
  const { t, locale } = useI18n();
  const { overallCEFR, modules, completedAt, learningLanguage } = result;
  const analysis = React.useMemo(
    () => analyzeResult(result, locale),
    [result, locale]
  );
  const langId = learningLanguage ?? "en";
  const langLabel =
    t(`courses.${langId}.name`) !== `courses.${langId}.name`
      ? t(`courses.${langId}.name`)
      : langId.toUpperCase();

  const openModules = modules.filter(
    (m) => m.aiScore != null || m.aiFeedback != null
  );

  return (
    <div className="space-y-10">
      {/* ===== Overall CEFR banner ===== */}
      <section
        aria-label={t("report.ariaOverall")}
        className="relative overflow-hidden rounded-3xl border border-brand-500/30 bg-brand-gradient p-8 text-white shadow-card md:p-12"
      >
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full bg-white/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-white/90">
              {t("report.completed")} · {formatDate(completedAt, locale)}
              {learningLanguage && (
                <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
                  {langLabel}
                </span>
              )}
            </p>
            <h1 className="mt-3 text-2xl font-bold leading-tight md:text-3xl">
              {t("report.yourLevel", { language: langLabel })}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-white/90 md:text-base">
              {t(`report.cefrDesc.${overallCEFR}`)}
            </p>

            {/* CEFR ladder */}
            <div
              className="mt-6 flex items-center gap-1.5"
              aria-hidden="true"
            >
              {CEFR_ORDER.map((lvl) => {
                const reached =
                  CEFR_ORDER.indexOf(lvl) <= CEFR_ORDER.indexOf(overallCEFR);
                const current = lvl === overallCEFR;
                return (
                  <span
                    key={lvl}
                    className={[
                      "flex-1 rounded-full py-1 text-center text-[11px] font-semibold transition-colors",
                      current
                        ? "bg-white text-brand-800"
                        : reached
                        ? "bg-white/40 text-white"
                        : "bg-white/10 text-white/60",
                    ].join(" ")}
                  >
                    {lvl}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Big CEFR medallion */}
          <div className="flex shrink-0 flex-col items-center">
            <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur-sm md:h-44 md:w-44">
              <span className="text-5xl font-black tracking-tighter md:text-6xl">
                {overallCEFR}
              </span>
              <span className="mt-1 text-sm font-medium text-white/90">
                {t(`report.cefr.${overallCEFR}`)}
              </span>
            </div>
            <div className="mt-4 w-36 md:w-44">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-700 ease-out"
                  style={{ width: `${CEFR_PROGRESS[overallCEFR]}%` }}
                />
              </div>
              <p className="mt-1.5 text-center text-[11px] text-white/80">
                {t("report.toC2", { pct: CEFR_PROGRESS[overallCEFR] })}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Radar + highlights ===== */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              {t("report.radarTitle")}
            </h2>
            <span className="text-xs text-slate-400">
              {t("report.radarNote")}
            </span>
          </div>
          <ScoreRadar modules={modules} />
        </Card>

        {/* Highlights column */}
        <div className="space-y-6 lg:col-span-2">
          {modules.some((m) => m.module === "vocabulary") && (
            <VocabularyEntry />
          )}

          <Card className="p-6">
            <p className="text-xs font-medium text-slate-500">
              {t("report.overview")}
            </p>
            <dl className="mt-3 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <dt className="text-slate-500">{t("report.unitsDone")}</dt>
                <dd className="font-semibold text-slate-900">
                  {t("report.countUnits", { n: modules.length })}
                </dd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <dt className="text-slate-500">{t("report.items")}</dt>
                <dd className="font-semibold text-slate-900">
                  {t("report.countItems", {
                    n:
                      result.totalItems ??
                      modules.reduce((s, m) => s + m.itemsAdministered, 0),
                  })}
                </dd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <dt className="text-slate-500">{t("report.duration")}</dt>
                <dd className="font-semibold text-slate-900">
                  {formatDuration(result.durationSeconds, locale)}
                </dd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <dt className="text-slate-500">{t("report.overallLevel")}</dt>
                <dd className="font-semibold text-brand-600">{overallCEFR}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">
            {t("report.shareTitle")}
          </h2>
          <ShareReport result={result} />
        </div>
      </section>

      <ImprovementPlan analysis={analysis} language={learningLanguage} />

      {/* ===== Per-module breakdown ===== */}
      <section>
        <div className="mb-5">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            {t("report.perModuleTitle")}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t("report.perModuleDesc")}
          </p>
        </div>
        <ModuleBreakdown modules={modules} />
      </section>

      {/* ===== AI feedback summary (open modules) ===== */}
      {openModules.length > 0 && (
        <section>
          <Card className="border-brand-100 bg-brand-50/40 p-6">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient text-xs font-bold text-white">
                AI
              </span>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                {t("report.aiSummary")}
              </h2>
            </div>
            <div className="mt-4 space-y-4">
              {openModules.map((m) => (
                <div
                  key={m.module}
                  className="rounded-xl border border-slate-100 bg-white px-5 py-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">
                      {t(`modules.${m.module}`)}
                    </span>
                    {m.aiScore != null && (
                      <span className="text-sm font-semibold text-brand-600">
                        {Math.round(m.aiScore * 100)} / 100
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {m.aiFeedback ?? t("report.noFeedback")}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* ===== Actions ===== */}
      <section className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
        <Link to="/test">
          <Button size="lg" className="min-w-[180px]">
            {t("report.retake")}
          </Button>
        </Link>
        <Link to="/history" search={{ page: 1 }}>
          <Button variant="outline" size="lg" className="min-w-[180px]">
            {t("common.viewHistory")}
          </Button>
        </Link>
      </section>
    </div>
  );
}

export default ResultReport;

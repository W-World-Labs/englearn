import { Badge, Card } from "@/components/ui";
import type { TestResult } from "@/lib/types";
import { compareResults, formatDuration } from "@/lib/product/analysis";
import { useI18n } from "@/lib/i18n/context";

export interface GrowthSummaryProps {
  results: TestResult[];
}

export function GrowthSummary({ results }: GrowthSummaryProps) {
  const { t, locale } = useI18n();
  if (results.length === 0) return null;

  const latest = results[0];
  const previous = results[1];
  const trend =
    previous != null ? compareResults(latest, previous) : null;
  const totalTests = results.length;
  const withDuration = results.filter((r) => r.durationSeconds != null);
  const avgDuration =
    withDuration.reduce((s, r) => s + (r.durationSeconds ?? 0), 0) /
    Math.max(1, withDuration.length);

  return (
    <Card className="mb-8 grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
      <div>
        <p className="text-xs text-slate-500">{t("growth.totalTests")}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{totalTests}</p>
      </div>
      <div>
        <p className="text-xs text-slate-500">{t("growth.currentLevel")}</p>
        <p className="mt-1 text-2xl font-bold text-brand-700">
          {latest.overallCEFR}
        </p>
      </div>
      <div>
        <p className="text-xs text-slate-500">{t("growth.vsLast")}</p>
        <p className="mt-1 text-sm font-semibold text-slate-800">
          {trend ? (
            <Badge
              variant={
                trend.delta > 0
                  ? "success"
                  : trend.delta < 0
                    ? "neutral"
                    : "default"
              }
            >
              {trend.delta > 0
                ? t("report.vsLastUp", { n: trend.delta })
                : trend.delta < 0
                  ? t("report.vsLastDown", { n: -trend.delta })
                  : t("report.vsLastSame")}
            </Badge>
          ) : (
            "—"
          )}
        </p>
      </div>
      <div>
        <p className="text-xs text-slate-500">{t("growth.avgDuration")}</p>
        <p className="mt-1 text-sm font-semibold text-slate-800">
          {withDuration.length > 0 ? formatDuration(avgDuration, locale) : "—"}
        </p>
      </div>
    </Card>
  );
}
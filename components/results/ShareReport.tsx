import * as React from "react";
import { Button } from "@/components/ui";
import type { TestResult } from "@/lib/types";
import {
  analyzeResult,
  formatDuration,
  summarizeAnalysis,
} from "@/lib/product/analysis";
import { useI18n } from "@/lib/i18n/context";

export interface ShareReportProps {
  result: TestResult;
}

export function ShareReport({ result }: ShareReportProps) {
  const { t, locale, courseName } = useI18n();
  const [status, setStatus] = React.useState<"idle" | "copied" | "error">(
    "idle"
  );

  function buildShareText(): string {
    const analysis = analyzeResult(result, locale);
    const lines = [
      t("share.title", { language: courseName() }),
      t("share.overall", { cefr: result.overallCEFR }),
      t("share.completedAt", {
        date: new Date(result.completedAt).toLocaleString(locale),
      }),
      t("share.durationLine", {
        duration: formatDuration(result.durationSeconds, locale),
      }),
      t("share.itemsLine", { n: result.totalItems ?? "—" }),
      "",
      t("share.modulesTitle"),
      ...result.modules.map((m) =>
        t("share.moduleLine", {
          name: t(`modules.${m.module}`),
          cefr: m.cefr,
          score:
            analysis.insights.find((i) => i.module === m.module)?.score ?? "—",
        })
      ),
      "",
      summarizeAnalysis(analysis, t, locale),
      "",
      t("share.linkLine", {
        url: typeof window !== "undefined" ? window.location.href : "",
      }),
    ];
    return lines.join("\n");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(buildShareText());
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={copyLink}>
        {status === "copied" ? t("share.linkCopied") : t("share.copyLink")}
      </Button>
      <Button variant="outline" size="sm" onClick={copyReport}>
        {t("share.copyText")}
      </Button>
      {status === "error" && (
        <span className="text-xs text-rose-600">{t("share.copyFail")}</span>
      )}
    </div>
  );
}

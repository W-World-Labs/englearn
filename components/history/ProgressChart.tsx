import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { TestResult, CEFRLevel } from "@/lib/types";
import { useI18n } from "@/lib/i18n/context";

const CEFR_SCORE: Record<CEFRLevel, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

export interface ProgressChartProps {
  results: TestResult[];
}

export function ProgressChart({ results }: ProgressChartProps) {
  const { t, locale } = useI18n();
  const data = React.useMemo(() => {
    const chronological = [...results].sort(
      (a, b) =>
        new Date(a.completedAt).getTime() -
        new Date(b.completedAt).getTime()
    );
    return chronological.map((r, i) => ({
      label: `#${i + 1}`,
      date: new Date(r.completedAt).toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
      }),
      level: CEFR_SCORE[r.overallCEFR],
      cefr: r.overallCEFR,
    }));
  }, [results, locale]);

  if (data.length < 2) return null;

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis
            domain={[1, 6]}
            ticks={[1, 2, 3, 4, 5, 6]}
            tickFormatter={(v) =>
              (["A1", "A2", "B1", "B2", "C1", "C2"] as const)[v - 1] ?? ""
            }
            tick={{ fontSize: 11 }}
            stroke="#94a3b8"
            width={32}
          />
          <Tooltip
            formatter={(value: number) => [
              (["A1", "A2", "B1", "B2", "C1", "C2"] as const)[value - 1],
              t("report.overallLevel"),
            ]}
            labelFormatter={(label) => String(label)}
          />
          <Line
            type="monotone"
            dataKey="level"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ fill: "#6366f1", r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
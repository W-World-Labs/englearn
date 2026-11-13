
import * as React from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { ModuleResult } from "@/lib/types";
import { thetaToScore } from "@/lib/product/scores";
import { useI18n } from "@/lib/i18n/context";

export { thetaToScore };

export interface ScoreRadarProps {
  modules: ModuleResult[];
  className?: string;
}

interface RadarDatum {
  module: string;
  score: number;
  cefr: string;
  theta: number;
}

function RadarTooltip({ active, payload }: any) {
  const { t } = useI18n();
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload as RadarDatum;
  return (
    <div className="rounded-xl border border-slate-100 bg-white/95 px-3 py-2 shadow-card backdrop-blur-sm">
      <p className="text-sm font-semibold text-slate-900">{d.module}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        CEFR <span className="font-medium text-brand-600">{d.cefr}</span> ·{" "}
        {t("report.theta")} {d.theta.toFixed(2)}
      </p>
    </div>
  );
}

/**
 * ScoreRadar
 * A radar/spider chart of per-module ability. theta is normalized to a 0..100
 * comparable scale via {@link thetaToScore}.
 */
export function ScoreRadar({ modules, className }: ScoreRadarProps) {
  const { t } = useI18n();
  const data: RadarDatum[] = React.useMemo(
    () =>
      modules.map((m) => ({
        module: t(`modules.${m.module}`),
        score: thetaToScore(m.theta),
        cefr: m.cefr,
        theta: m.theta,
      })),
    [modules, t]
  );

  // recharts radar needs at least 3 axes to form a polygon; with fewer we
  // still render but it visually degenerates — acceptable for 1–2 modules.
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data} outerRadius="72%">
          <defs>
            <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#a5b4fc" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="module"
            tick={{ fill: "#475569", fontSize: 13, fontWeight: 500 }}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tickCount={5}
            tick={{ fill: "#cbd5e1", fontSize: 10 }}
            axisLine={false}
          />
          <Radar
            name={t("report.seriesAbility")}
            dataKey="score"
            stroke="#4f46e5"
            strokeWidth={2}
            fill="url(#radarFill)"
            fillOpacity={1}
            dot={{ r: 3, fill: "#4f46e5", strokeWidth: 0 }}
            isAnimationActive
          />
          <Tooltip content={<RadarTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ScoreRadar;

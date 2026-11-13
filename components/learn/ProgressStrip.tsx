import * as React from "react";
import { isDailyGoalMet, loadProgress, resetDailyProgress } from "@/lib/gamification/store";
import { xpProgressInLevel } from "@/lib/gamification/xp";
import type { UserProgress } from "@/lib/gamification/types";
import { useI18n } from "@/lib/i18n/context";

export function ProgressStrip({
  showGoalStatus = true,
}: {
  showGoalStatus?: boolean;
}) {
  const [progress, setProgress] = React.useState<UserProgress | null>(null);

  React.useEffect(() => {
    setProgress(resetDailyProgress());
  }, []);

  if (!progress) {
    return (
      <div className="h-14 animate-pulse rounded-2xl bg-slate-100/80" aria-hidden />
    );
  }

  return (
    <ProgressStripView progress={progress} showGoalStatus={showGoalStatus} />
  );
}

export function ProgressStripView({
  progress,
  showGoalStatus = true,
}: {
  progress: UserProgress;
  showGoalStatus?: boolean;
}) {
  const { t } = useI18n();
  const lvl = xpProgressInLevel(progress.xp);
  const goalPct = Math.min(
    100,
    Math.round((progress.dailyXpToday / progress.dailyGoalXp) * 100)
  );

  return (
    <div className="surface flex flex-wrap items-center gap-4 px-4 py-3">
      <Metric label={t("stats.streak")} value={`${progress.streak}`} unit={t("stats.days")} />
      <Metric
        label={t("stats.dailyXp")}
        value={`${progress.dailyXpToday}`}
        unit={`/ ${progress.dailyGoalXp}`}
      />
      <div className="min-w-[140px] flex-1">
        <div className="flex items-center justify-between text-xs font-medium text-slate-600">
          <span>
            {t("stats.level")} {lvl.level}
          </span>
          <span className="tabular-nums text-slate-500">
            {lvl.current}/{lvl.needed} XP
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-gradient transition-all duration-500"
            style={{ width: `${lvl.pct}%` }}
          />
        </div>
      </div>
      <div
        className="hidden h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-semibold text-brand-700 sm:flex"
        title={t("home.dailyGoalTitle")}
      >
        {goalPct}%
      </div>
      {showGoalStatus && <DailyGoalStatus progress={progress} />}
    </div>
  );
}

/** Goal and streak lines for the home, assessment and history strips. */
export function DailyGoalStatus({ progress }: { progress: UserProgress }) {
  const { t } = useI18n();
  const met = isDailyGoalMet(progress);
  const left = Math.max(0, progress.dailyGoalXp - progress.dailyXpToday);
  return (
    <>
      <p
        role="status"
        data-testid="daily-goal-status"
        className={`basis-full text-xs font-medium ${met ? "text-emerald-700" : "text-slate-600"}`}
      >
        {met ? t("home.goalDone") : t("home.goalLeft", { left })}
      </p>
      {progress.streak >= 2 && (
        <p
          data-testid="streak-status"
          className="basis-full text-xs font-medium text-amber-800"
        >
          {t("home.streakMsg", { days: progress.streak })}
        </p>
      )}
    </>
  );
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold tabular-nums text-slate-900">
        {value}
        {unit && (
          <span className="ml-0.5 text-xs font-medium text-slate-400">{unit}</span>
        )}
      </p>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
    </div>
  );
}

export function useProgressRefresh(): [UserProgress | null, () => void] {
  const [progress, setProgress] = React.useState<UserProgress | null>(null);
  const refresh = React.useCallback(() => {
    setProgress(loadProgress());
  }, []);
  React.useEffect(() => {
    refresh();
  }, [refresh]);
  return [progress, refresh];
}
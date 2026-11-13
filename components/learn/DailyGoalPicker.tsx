import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { loadProgress, setDailyGoal } from "@/lib/gamification/store";
import { useI18n } from "@/lib/i18n/context";

const GOAL_OPTIONS = [20, 50, 100] as const;

export interface DailyGoalPickerProps {
  onChange?: () => void;
}

export function DailyGoalPicker({ onChange }: DailyGoalPickerProps) {
  const { t } = useI18n();
  const [goal, setGoal] = React.useState(50);

  React.useEffect(() => {
    setGoal(loadProgress().dailyGoalXp);
  }, []);

  function pick(xp: number) {
    setGoal(xp);
    setDailyGoal(xp);
    onChange?.();
  }

  return (
    <Card className="border-slate-100/90">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t("home.dailyGoalTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pt-0">
        {GOAL_OPTIONS.map((xp) => (
          <button
            key={xp}
            type="button"
            onClick={() => pick(xp)}
            className={[
              "min-h-11 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
              goal === xp
                ? "border-brand-500 bg-brand-600 text-white shadow-card"
                : "border-slate-200 bg-white text-slate-600 hover:border-brand-200",
            ].join(" ")}
          >
            {xp} XP
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

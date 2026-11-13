import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { useI18n } from "@/lib/i18n/context";
import { loadProgress } from "@/lib/gamification/store";
import { leagueFromWeeklyXp, xpToNextLeague } from "@/lib/gamification/league";

export function WeeklyPracticeCard() {
  const { t } = useI18n();
  const [weeklyXp, setWeeklyXp] = React.useState(0);

  React.useEffect(() => {
    setWeeklyXp(loadProgress().weeklyXp);
  }, []);

  const tier = leagueFromWeeklyXp(weeklyXp);
  const { next, needed } = xpToNextLeague(weeklyXp);

  return (
    <Card className="border-slate-100/90">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t("weekly.title")}</CardTitle>
        <CardDescription>{t("weekly.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-2xl font-semibold tabular-nums text-slate-900">
          {weeklyXp}
          <span className="ml-1 text-sm font-medium text-slate-400">XP</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {t("weekly.tier", { tier: t(`weekly.tiers.${tier}`) })}
        </p>
        {next && (
          <p className="mt-2 text-xs text-brand-600">
            {t("weekly.nextTier", {
              tier: t(`weekly.tiers.${next}`),
              xp: needed,
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
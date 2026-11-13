import * as React from "react";
import { CompletionModal } from "@/components/learn/CompletionModal";
import { applyAssessmentResult } from "@/lib/gamification/store";
import { useI18n } from "@/lib/i18n/context";
import type { TestResult } from "@/lib/types";

const REWARD_KEY_PREFIX = "lingolearn:rewarded:";

export function ResultsRewards({ result }: { result: TestResult }) {
  const { t } = useI18n();
  const [celebrate, setCelebrate] = React.useState(false);
  const [xpGained, setXpGained] = React.useState(0);
  const [newAchievements, setNewAchievements] = React.useState<string[]>([]);

  React.useEffect(() => {
    const key = REWARD_KEY_PREFIX + result.sessionId;
    if (sessionStorage.getItem(key)) return;
    const { xpGained: xp, newAchievements: ach } =
      applyAssessmentResult(result);
    sessionStorage.setItem(key, "1");
    setXpGained(xp);
    setNewAchievements(ach);
    setCelebrate(true);
  }, [result]);

  if (!celebrate) return null;

  return (
    <CompletionModal
      title={t("feedback.assessmentDone")}
      subtitle={t("common.overall", { cefr: result.overallCEFR })}
      xpGained={xpGained}
      achievements={newAchievements}
      onContinue={() => setCelebrate(false)}
    />
  );
}
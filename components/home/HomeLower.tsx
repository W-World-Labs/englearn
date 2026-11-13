import { DailyGoalPicker } from "@/components/learn/DailyGoalPicker";
import { AchievementGrid } from "@/components/learn/AchievementGrid";
import { ModuleProgressGrid } from "@/components/learn/ModuleProgressGrid";
import { ProgressStrip } from "@/components/learn/ProgressStrip";
import { WeeklyPracticeCard } from "@/components/learn/WeeklyPracticeCard";
import { VocabularyEntry } from "@/components/vocabulary/VocabularyEntry";
import { Card } from "@/components/ui";
import type { UserProgress } from "@/lib/gamification/types";
import { useI18n } from "@/lib/i18n/context";

/** Vocabulary stays available when the selected language has no course. */
export function HomeVocabularyFallback({ available }: { available: boolean }) {
  if (available) return null;
  return (
    <div className="mt-6" data-testid="home-vocabulary">
      <VocabularyEntry />
    </div>
  );
}

/** Personal progress and goal controls, including languages without a course bank. */
export function HomeLower({
  available,
  progress,
  onGoalChange,
}: {
  available: boolean;
  progress: UserProgress | null;
  onGoalChange: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
        className={
          available
            ? "mt-8 grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start"
            : "mt-8"
        }
        data-testid="home-lower"
        data-course={available ? "dedicated" : "universal"}
      >
        {available && (
          <details data-testid="home-modules" className="rounded-2xl border border-stone-200 bg-white p-5">
            <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-brand-800">
              {t("home.pathTitle")}
            </summary>
            {progress && <ModuleProgressGrid progress={progress} />}
          </details>
        )}
        <aside className="space-y-4 lg:sticky lg:top-16" data-testid="home-retention">
          <ProgressStrip showGoalStatus={false} />
          <DailyGoalPicker onChange={onGoalChange} />
          <WeeklyPracticeCard />
          <Card className="p-5">
            <details>
            <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-slate-900">
              {t("home.achievements")}
            </summary>
            <div className="mt-4">
              {progress ? (
                <AchievementGrid progress={progress} pageSize={4} />
              ) : (
                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              )}
            </div>
            </details>
          </Card>
        </aside>
    </div>
  );
}

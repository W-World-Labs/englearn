import { DailyGoalStatus } from "@/components/learn/ProgressStrip";
import { loadProgress } from "@/lib/gamification/store";
import type { UserProgress } from "@/lib/gamification/types";

/** Fresh XP plus where that leaves today's goal. Pass `progress` in tests. */
export function XpAward({
  amount,
  progress,
  className = "",
}: {
  amount: number;
  progress?: UserProgress;
  className?: string;
}) {
  const live =
    progress ?? (typeof window === "undefined" ? null : loadProgress());
  return (
    <div role="status" data-testid="xp-award" className={className}>
      <p className="font-semibold">+{amount} XP</p>
      {live && (
        <div className="mt-1">
          <DailyGoalStatus progress={live} />
        </div>
      )}
    </div>
  );
}

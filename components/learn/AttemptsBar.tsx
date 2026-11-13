import { MAX_HEARTS } from "@/lib/gamification/xp";
import { useI18n } from "@/lib/i18n/context";

export interface AttemptsBarProps {
  remaining: number;
  max?: number;
}

/** Remaining wrong-answer budget during a session (not “hearts”). */
export function AttemptsBar({ remaining, max = MAX_HEARTS }: AttemptsBarProps) {
  const { t } = useI18n();
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5"
      aria-label={t("stats.attemptsAria", { remaining, max })}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {t("stats.attempts")}
      </span>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={[
              "h-2 w-2 rounded-full transition-colors",
              i < remaining ? "bg-brand-500" : "bg-slate-200",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}
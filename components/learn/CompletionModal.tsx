import { XpAward } from "@/components/learn/XpAward";
import { Button } from "@/components/ui";
import { ACHIEVEMENTS } from "@/lib/gamification/achievements";
import { useI18n } from "@/lib/i18n/context";

export interface CompletionModalProps {
  title: string;
  subtitle?: string;
  xpGained?: number;
  achievements?: string[];
  onContinue: () => void;
}

export function CompletionModal({
  title,
  subtitle,
  xpGained,
  achievements = [],
  onContinue,
}: CompletionModalProps) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm">
      <div className="relative w-full max-w-md animate-fade-up rounded-2xl border border-slate-100 bg-white p-8 shadow-card">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-brand-gradient text-lg font-bold text-white shadow-card">
          ✓
        </div>
        <h2 className="mt-5 text-center text-xl font-semibold text-slate-900">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 text-center text-sm text-slate-600">{subtitle}</p>
        )}
        {xpGained != null && xpGained > 0 && (
          <XpAward
            amount={xpGained}
            className="mt-4 text-center text-sm text-brand-700"
          />
        )}
        {achievements.length > 0 && (
          <ul className="mt-4 space-y-2">
            {achievements.map((id) => {
              const a = ACHIEVEMENTS.find((x) => x.id === id);
              return (
                <li
                  key={id}
                  className="rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-2 text-sm text-slate-800"
                >
                  {t("common.achievementUnlocked", {
                    title: a ? t(`achievements.${a.id}.title`) : id,
                  })}
                </li>
              );
            })}
          </ul>
        )}
        <Button size="lg" className="mt-8 w-full" onClick={onContinue}>
          {t("common.continue")}
        </Button>
      </div>
    </div>
  );
}
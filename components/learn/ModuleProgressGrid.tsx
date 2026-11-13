import { Link } from "@tanstack/react-router";
import { testRoute } from "@/lib/routes/navigation";
import { Card } from "@/components/ui";
import type { ModuleType } from "@/lib/types";
import { getCourseCrowns, type UserProgress } from "@/lib/gamification/types";
import { useI18n } from "@/lib/i18n/context";

const MODULE_ORDER: ModuleType[] = [
  "vocabulary",
  "grammar",
  "reading",
  "listening",
  "speaking",
  "writing",
];

export function ModuleProgressGrid({ progress }: { progress: UserProgress }) {
  const { t, learningLanguage } = useI18n();
  const crowns = getCourseCrowns(progress, learningLanguage);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {MODULE_ORDER.map((key) => {
        const level = crowns[key] ?? 0;
        return (
          <Link
            key={key}
            {...testRoute({ modules: [key] })}
            className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
          >
            <Card
              interactive
              className="flex items-start gap-3 p-4"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-sm font-bold text-white shadow-card">
                {t(`modules.${key}Glyph`)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{t(`modules.${key}`)}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t(`modules.${key}Desc`)}
                </p>
                <p className="mt-2 text-xs font-medium text-brand-700">
                  {level > 0
                    ? t("progress.moduleLevel", { level })
                    : t("progress.moduleNotStarted")}
                </p>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
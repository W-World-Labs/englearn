import { ACHIEVEMENTS } from "@/lib/gamification/achievements";
import type { UserProgress } from "@/lib/gamification/types";
import { useI18n } from "@/lib/i18n/context";
import { usePaginatedSlice } from "@/hooks/usePaginatedSlice";
import { Pagination } from "@/components/ui/Pagination";

export function AchievementGrid({
  progress,
  pageSize = 8,
}: {
  progress: UserProgress;
  pageSize?: number;
}) {
  const { t } = useI18n();
  const unlocked = new Set(progress.achievements);
  const { items, page, totalPages, total, setPage } = usePaginatedSlice(
    ACHIEVEMENTS,
    pageSize
  );

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-3">
        {items.map((a) => {
          const on = unlocked.has(a.id);
          return (
            <div
              key={a.id}
              className={[
                "rounded-2xl border p-4 text-center transition-all",
                on
                  ? "border-amber-300/80 bg-amber-50/90 shadow-card"
                  : "border-slate-100 bg-slate-50/80 opacity-70 grayscale",
              ].join(" ")}
            >
              <span className="text-2xl">{a.icon}</span>
              <p className="mt-2 text-xs font-bold text-slate-900">
                {t(`achievements.${a.id}.title`)}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                {t(`achievements.${a.id}.desc`)}
              </p>
            </div>
          );
        })}
      </div>
      <Pagination
        className="mt-4"
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </div>
  );
}
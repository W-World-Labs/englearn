import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Badge, Button, Card } from "@/components/ui";
import { Pagination } from "@/components/ui/Pagination";
import { PageShell } from "@/components/layout/PageShell";
import { HomeLower } from "@/components/home/HomeLower";
import { resetDailyProgress } from "@/lib/gamification/store";
import type { UserProgress } from "@/lib/gamification/types";
import { isCoursePlayable } from "@/lib/i18n/languages";
import { GrowthSummary } from "@/components/history/GrowthSummary";
import { ProgressChart } from "@/components/history/ProgressChart";
import { useHistoryData } from "@/lib/client/useHistoryData";
import { parseHistorySearch } from "@/lib/routes/search";

import { useI18n } from "@/lib/i18n/context";

const PAGE_SIZE = 8;

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const Route = createFileRoute("/history")({
  validateSearch: parseHistorySearch,
  component: HistoryPage,
});

function HistoryPage() {
  const { page } = Route.useSearch();
  const navigate = useNavigate();
  const { t, locale, learningLanguage } = useI18n();
  const [progress, setProgress] = React.useState<UserProgress | null>(null);
  const refreshProgress = React.useCallback(
    () => setProgress(resetDailyProgress()),
    [],
  );
  React.useEffect(refreshProgress, [refreshProgress]);
  const { all, paged, loading, error, remove } = useHistoryData(
    page,
    PAGE_SIZE,
  );
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  function goToPage(next: number) {
    void navigate({
      to: "/history",
      search: { page: next },
    });
  }

  async function deleteRecord(sessionId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(t("common.confirmDelete"))) return;
    setDeletingId(sessionId);
    try {
      const ok = await remove(sessionId);
      if (!ok) throw new Error("delete");
    } catch {
      alert(t("common.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  const globalLatestId = all[0]?.sessionId;
  const items = paged?.items ?? [];

  React.useEffect(() => {
    if (loading || !paged || paged.total === 0) return;
    if (page > paged.totalPages) {
      void navigate({
        to: "/history",
        search: { page: paged.totalPages },
        replace: true,
      });
    }
  }, [loading, paged, page, navigate]);

  return (
    <PageShell active="history" title={t("nav.history")}>
      <h1 className="sr-only">{t("nav.history")}</h1>
      <HomeLower
        available={isCoursePlayable(learningLanguage)}
        progress={progress}
        onGoalChange={refreshProgress}
      />
      <div className="mb-4 mt-6">
        <h2 className="text-base font-semibold text-slate-900">
          {t("history.title")}
        </h2>
      </div>

      {loading && (
        <Card className="p-12 text-center">
          <p className="text-sm text-slate-500">{t("common.loading")}</p>
        </Card>
      )}

      {!loading && error && (
        <Card className="p-12 text-center">
          <p className="text-sm text-rose-600">{t("history.loadFailed")}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            {t("common.retry")}
          </Button>
        </Card>
      )}

      {!loading && !error && all.length > 0 && (
        <>
          <GrowthSummary results={all} />
          <Card className="mb-8 p-6">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">CEFR</h2>
            <ProgressChart results={all} />
          </Card>
        </>
      )}

      {!loading && !error && all.length === 0 && (
        <Card className="p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-xl font-bold text-white shadow-card">
            L
          </div>
          <h2 className="mt-5 text-lg font-semibold text-slate-900">
            {t("common.noRecords")}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {t("common.noRecordsDesc")}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/test">
              <Button size="lg">{t("common.firstTest")}</Button>
            </Link>
            <Link to="/guide">
              <Button variant="outline">{t("home.howItWorks")}</Button>
            </Link>
          </div>
        </Card>
      )}

      {!loading && !error && paged && paged.total > 0 && (
        <>
          <Pagination
            className="mb-4"
            page={paged.page}
            totalPages={paged.totalPages}
            total={paged.total}
            pageSize={paged.pageSize}
            onPageChange={goToPage}
          />

          <ul className="space-y-4">
            {items.map((r) => (
              <li key={r.sessionId} className="relative">
                <Link
                  to="/results"
                  search={{ sid: r.sessionId }}
                  className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
                >
                  <Card interactive className="p-5 sm:p-6">
                    <div className="flex items-center gap-5">
                      <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-card">
                        <span className="text-xl font-bold tracking-tight">
                          {r.overallCEFR}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {t("common.overall", { cefr: r.overallCEFR })}
                          </span>
                          {r.sessionId === globalLatestId && (
                            <Badge variant="brand" className="font-semibold">
                              {t("common.latest")}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatDate(r.completedAt, locale)}
                          {r.learningLanguage && (
                            <span className="ml-2 font-semibold text-brand-600">
                              · {r.learningLanguage.toUpperCase()}
                            </span>
                          )}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {r.modules.map((m) => (
                            <span
                              key={m.module}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-600"
                            >
                              <span className="text-slate-400">
                                {t(`modules.${m.module}`)}
                              </span>
                              <span className="font-semibold text-slate-700">
                                {m.cefr}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>

                      <span
                        aria-hidden="true"
                        className="ml-auto hidden shrink-0 text-slate-300 sm:block"
                      >
                        →
                      </span>
                    </div>
                  </Card>
                </Link>
                <button
                  type="button"
                  onClick={(e) => deleteRecord(r.sessionId, e)}
                  disabled={deletingId === r.sessionId}
                  className="absolute right-4 top-4 text-xs text-slate-400 hover:text-rose-600 disabled:opacity-50"
                >
                  {deletingId === r.sessionId
                    ? t("common.deleting")
                    : t("common.delete")}
                </button>
              </li>
            ))}
          </ul>

          <Pagination
            className="mt-6"
            page={paged.page}
            totalPages={paged.totalPages}
            total={paged.total}
            pageSize={paged.pageSize}
            onPageChange={goToPage}
          />
        </>
      )}
    </PageShell>
  );
}

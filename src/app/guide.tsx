import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Card } from "@/components/ui";
import { Pagination } from "@/components/ui/Pagination";
import { PageShell } from "@/components/layout/PageShell";
import { useI18n } from "@/lib/i18n/context";
import { HOW_IT_WORKS, CEFR_GUIDE, FAQ } from "@/lib/product/content";
import { usePaginatedSlice } from "@/hooks/usePaginatedSlice";
import type { ModuleType } from "@/lib/types";

const MODULE_KEYS: ModuleType[] = [
  "vocabulary",
  "grammar",
  "reading",
  "listening",
  "speaking",
  "writing",
];

const CEFR_ENTRIES = Object.entries(CEFR_GUIDE) as Array<
  [keyof typeof CEFR_GUIDE, (typeof CEFR_GUIDE)[keyof typeof CEFR_GUIDE]]
>;

export const Route = createFileRoute("/guide")({
  component: GuidePage,
});

function GuidePage() {
  const { t } = useI18n();
  const faq = usePaginatedSlice(FAQ, 3);
  const cefr = usePaginatedSlice(CEFR_ENTRIES, 3);
  const modules = usePaginatedSlice(MODULE_KEYS, 4);

  const incentives = [
    { title: t("guide.xpTitle"), desc: t("guide.xpDesc") },
    { title: t("guide.streakTitle"), desc: t("guide.streakDesc") },
    { title: t("guide.attemptsTitle"), desc: t("guide.attemptsDesc") },
    { title: t("guide.levelsTitle"), desc: t("guide.levelsDesc") },
  ];

  return (
    <PageShell active="guide">
      <div className="mt-8 mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {t("guide.title")}
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">{t("guide.intro")}</p>
      </div>

      <section className="mb-12">
        <h2 className="text-lg font-semibold text-brand-700">
          {t("guide.incentivesTitle")}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {incentives.map((item) => (
            <Card key={item.title} className="p-4">
              <h3 className="font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-semibold text-slate-900">
          {t("guide.flowTitle")}
        </h2>
        <div className="mt-4 space-y-4">
          {HOW_IT_WORKS.map((step) => (
            <Card key={step.step} className="flex gap-4 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-sm font-bold text-white shadow-card">
                {step.step}
              </span>
              <div>
                <h3 className="font-semibold text-slate-900">{t(step.titleKey)}</h3>
                <p className="mt-1 text-sm text-slate-600">{t(step.descKey)}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-semibold text-slate-900">
          {t("guide.modulesTitle")}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {modules.items.map((key) => (
            <Card key={key} className="p-4">
              <span className="font-semibold text-slate-900">
                {t(`modules.${key}`)}
              </span>
              <p className="mt-1 text-sm text-slate-600">
                {t(`modules.${key}Desc`)}
              </p>
            </Card>
          ))}
        </div>
        <Pagination
          className="mt-4"
          page={modules.page}
          totalPages={modules.totalPages}
          total={modules.total}
          pageSize={4}
          onPageChange={modules.setPage}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-semibold text-slate-900">
          {t("guide.cefrTitle")}
        </h2>
        <div className="mt-4 space-y-3">
          {cefr.items.map(([level, info]) => (
            <Card key={level} className="p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-lg font-bold text-brand-600">{level}</span>
                <span className="text-sm font-medium text-slate-700">
                  {t(info.titleKey)}
                </span>
                <span className="text-xs text-slate-400">{t(info.vocabKey)}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{t(info.canDoKey)}</p>
            </Card>
          ))}
        </div>
        <Pagination
          className="mt-4"
          page={cefr.page}
          totalPages={cefr.totalPages}
          total={cefr.total}
          pageSize={3}
          onPageChange={cefr.setPage}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-semibold text-slate-900">
          {t("guide.faqTitle")}
        </h2>
        <div className="mt-4 space-y-4">
          {faq.items.map((item) => (
            <Card key={item.qKey} className="p-5">
              <h3 className="font-semibold text-slate-900">{t(item.qKey)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {t(item.aKey)}
              </p>
            </Card>
          ))}
        </div>
        <Pagination
          className="mt-4"
          page={faq.page}
          totalPages={faq.totalPages}
          total={faq.total}
          pageSize={3}
          onPageChange={faq.setPage}
        />
      </section>

      <div className="flex justify-center pb-4">
        <Link to="/test">
          <Button size="lg">{t("common.startTest")}</Button>
        </Link>
      </div>
    </PageShell>
  );
}
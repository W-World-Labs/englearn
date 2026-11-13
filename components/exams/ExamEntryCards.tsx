import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/lib/client/auth";
import { examMessages } from "@/lib/exams/messages";
import {
  ieltsDraftFor,
  practiceDraftFor,
  type DraftBadge,
} from "@/lib/exams/drafts";
import type { ExamFamily } from "@/lib/exams/catalog";
export function ExamEntryCards({
  selectedOnly = false,
}: {
  selectedOnly?: boolean;
}) {
  const { locale, learningLanguage } = useI18n();
  const { user } = useAuth();
  const m = examMessages(locale);
  const owner = user ? `user:${user.sub}` : "guest";
  const [drafts, setDrafts] = React.useState<
    Partial<Record<string, DraftBadge>>
  >({});
  React.useEffect(() => {
    const now = Date.now();
    const next: Partial<Record<string, DraftBadge>> = {};
    for (const family of ["topik", "hsk", "jlpt"] as ExamFamily[]) {
      const draft = practiceDraftFor(owner, family, now);
      if (draft) next[family] = draft;
    }
    const ielts = ieltsDraftFor(owner, now);
    if (ielts) next.ielts = ielts;
    setDrafts(next);
  }, [owner]);
  const cards = [
    {
      id: "ielts",
      language: "en",
      title: "IELTS Academic",
      subtitle: "",
      to: "/ielts" as const,
    },
    {
      id: "topik",
      language: "ko",
      title: "TOPIK",
      subtitle: "TOPIK I · TOPIK II",
      to: "/topik" as const,
    },
    {
      id: "hsk",
      language: "zh",
      title: "HSK",
      subtitle: "HSK 1–6 · 汉语水平考试",
      to: "/hsk" as const,
    },
    {
      id: "jlpt",
      language: "ja",
      title: "JLPT",
      subtitle: "N5–N1 · 日本語能力試験",
      to: "/jlpt" as const,
    },
  ]
    .filter((card) => !selectedOnly || card.language === learningLanguage)
    .sort(
      (a, b) =>
        Number(b.language === learningLanguage) -
        Number(a.language === learningLanguage),
    );
  return (
    <section className="mt-4" aria-label={m.centre}>
      {selectedOnly && <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">{m.centre}</h2>
        <Link to="/exams" className="text-xs font-semibold text-blue-700">
          IELTS · TOPIK · HSK · JLPT →
        </Link>
      </div>}
      {cards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5 text-sm leading-6 text-slate-600">
          {m.noCourseExam}
        </p>
      ) : (
        <div className="catalog-list">
          {cards.map((card) => {
            const draft = drafts[card.id];
            return (
              <Link key={card.id} to={card.to} className="catalog-entry">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-slate-900">{card.title}</h3>
                  {card.subtitle && (
                    <p className="mt-1 text-sm text-slate-500">{card.subtitle}</p>
                  )}
                  {draft && (
                    <p
                      data-testid="exam-draft"
                      className={`mt-1 text-sm ${draft.status === "running" ? "text-amber-900" : "text-slate-600"}`}
                    >
                      {draft.label} ·{" "}
                      {draft.status === "running" ? m.running : m.finished}
                    </p>
                  )}
                </div>
                <span aria-hidden="true" className="text-slate-400">→</span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

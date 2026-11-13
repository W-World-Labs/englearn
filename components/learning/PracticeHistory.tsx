import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Pagination } from "@/components/ui/Pagination";
import { useI18n } from "@/lib/i18n/context";
import { lessonById, type StudyLocale } from "@/lib/learning/catalog";
import { studyCard } from "@/lib/learning/cards";
import {
  filterHistory,
  hasActiveHistoryFilters,
  historyFilterOptions,
  HISTORY_FILTER_ALL,
} from "@/lib/learning/history-filter";
import { scoreLesson, type StudyJournal } from "@/lib/learning/session";
import { workbenchMessages } from "@/lib/learning/workbench-messages";
import { activityQuestion, scoreActivity, activityLanguage } from "@/lib/learning/workbench";
import { gradedText } from "@/lib/learning/workbench-content";
import { learningMessages } from "@/lib/learning/messages";
import { reinforcementMessages } from "@/lib/learning/reinforcement-messages";

const STATUS_OPTIONS = ["finished", "draft"] as const;

export function PracticeHistory({
  session,
  explanationLocale,
}: {
  session: StudyJournal | null;
  explanationLocale: StudyLocale;
}) {
  const { locale, learningLanguage, t } = useI18n(),
    m = learningMessages(locale),
    r = reinforcementMessages(locale),
    wm = workbenchMessages(locale);
  const [historyPage, setPage] = React.useState(1);
  const [query, setQuery] = React.useState("");
  const [family, setFamily] = React.useState<string>(HISTORY_FILTER_ALL);
  const [status, setStatus] = React.useState<string>(HISTORY_FILTER_ALL);
  React.useEffect(() => setPage(1), [learningLanguage]);
  React.useEffect(() => setPage(1), [query, family, status]);
  const rows = [
    ...(session?.workbench?.rounds ?? [])
      .filter((round) => activityLanguage(round) === learningLanguage)
      .map((round) => ({ kind: "activity" as const, round, at: round.at })),
    ...(session?.events ?? [])
      .filter((e) => lessonById(e.lessonId)?.language === learningLanguage)
      .map((e) => ({ kind: "lesson" as const, event: e, at: e.at })),
    ...(session?.reviews ?? [])
      .filter((e) => studyCard(e.cards[0])?.language === learningLanguage)
      .map((e) => ({ kind: "recall" as const, event: e, at: e.at })),
    ...(session?.draft &&
    lessonById(session.draft.lessonId)?.language === learningLanguage
      ? [
          {
            kind: "lessonDraft" as const,
            draft: session.draft,
            at: session.draft.startedAt,
          },
        ]
      : []),
    ...(session?.reviewDraft &&
    studyCard(session.reviewDraft.cards[0])?.language === learningLanguage
      ? [
          {
            kind: "recallDraft" as const,
            draft: session.reviewDraft,
            at: session.reviewDraft.startedAt,
          },
        ]
      : []),
    ...(session?.workbench?.draft &&
    activityLanguage(session.workbench.draft) === learningLanguage
      ? [
          {
            kind: "activityDraft" as const,
            draft: session.workbench.draft,
            at: session.workbench.draft.startedAt,
          },
        ]
      : []),
  ].sort((a, b) => b.at - a.at);
  const items = rows.map((row) => {
    if (row.kind === "activity")
      return {
        id: row.round.id,
        label: (lessonById(row.round.target)?.title ?? gradedText(row.round.target)?.title)?.[explanationLocale] ?? row.round.target,
        family: "activity",
        language: activityLanguage(row.round),
        status: "finished",
        row,
      };
    if (row.kind === "lesson")
      return {
        id: row.event.id,
        label: lessonById(row.event.lessonId)!.title[explanationLocale],
        family: "lesson",
        language: lessonById(row.event.lessonId)!.language,
        status: "finished",
        row,
      };
    if (row.kind === "recall")
      return {
        id: row.event.id,
        label: r.history,
        family: "recall",
        language: studyCard(row.event.cards[0])?.language ?? null,
        status: "finished",
        row,
      };
    if (row.kind === "lessonDraft")
      return {
        id: `lesson-draft-${row.draft.lessonId}`,
        label:
          lessonById(row.draft.lessonId)?.title[explanationLocale] ??
          row.draft.lessonId,
        family: "lesson",
        language: lessonById(row.draft.lessonId)?.language ?? null,
        status: "draft",
        row,
      };
    if (row.kind === "recallDraft")
      return {
        id: `recall-draft-${row.draft.id}`,
        label: r.history,
        family: "recall",
        language: studyCard(row.draft.cards[0])?.language ?? null,
        status: "draft",
        row,
      };
    return {
      id: `activity-draft-${row.draft.id}`,
      label:
        (lessonById(row.draft.target)?.title ??
        gradedText(row.draft.target)?.title)?.[explanationLocale] ??
        row.draft.target,
      family: "activity",
      language: activityLanguage(row.draft),
      status: "draft",
      row,
    };
  });
  const criteria = { query, family, status },
    visible = filterHistory(items, criteria),
    familyOptions = historyFilterOptions(items).families,
    filtering = hasActiveHistoryFilters(criteria);
  const pages = Math.max(1, Math.ceil(visible.length / 10)),
    page = Math.min(historyPage, pages);
  const familyLabel = (value: string) =>
    value === "lesson"
      ? t("learn.familyLesson")
      : value === "recall"
        ? t("learn.familyRecall")
        : value === "activity"
          ? t("learn.familyActivity")
          : value;
  const statusLabel = (value: string) =>
    value === "finished"
      ? t("learn.statusFinished")
      : value === "draft"
        ? t("learn.statusDraft")
        : value;
  const clearFilters = () => {
    setQuery("");
    setFamily(HISTORY_FILTER_ALL);
    setStatus(HISTORY_FILTER_ALL);
  };
  return (
    <>
      <div className="mb-4 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <label className="block text-sm font-medium">
          {t("learn.searchHistory")}
          <input
            type="search"
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4"
          />
        </label>
        <label className="block text-sm font-medium">
          {t("learn.filterFamily")}
          <select
            value={family}
            onChange={(ev) => setFamily(ev.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
          >
            <option value={HISTORY_FILTER_ALL}>{t("learn.allFamilies")}</option>
            {familyOptions.map((value) => (
              <option key={value} value={value}>
                {familyLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          {t("learn.filterStatus")}
          <select
            value={status}
            onChange={(ev) => setStatus(ev.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
          >
            <option value={HISTORY_FILTER_ALL}>{t("learn.allStatuses")}</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </label>
        {filtering && (
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 sm:col-span-3 sm:justify-self-start"
          >
            {t("learn.clearFilters")}
          </button>
        )}
      </div>
      <div className="space-y-3">
        {visible.slice((page - 1) * 10, page * 10).map((item) => {
          const row = item.row;
          if (row.kind === "activity") {
            const round = row.round;
            return (
              <details key={item.id} data-testid="activity-round" className="rounded-2xl border border-slate-200 bg-white p-5">
                <summary className="cursor-pointer text-sm leading-7">
                  <strong>{item.label}</strong> · {wm[round.kind]} · {scoreActivity(round)}/{round.items.length} · {new Date(round.at).toLocaleString(locale)}
                </summary>
                <ol className="mt-4 space-y-3">
                  {round.items.map((id, i) => {
                    const question = activityQuestion(id);
                    if (!question) return null;
                    return (
                      <li key={id} className="rounded-xl bg-slate-50 p-3 text-sm">
                        <p lang={item.language ?? undefined}>{question.prompt}</p>
                        <p className="mt-2" lang={item.language ?? undefined}>
                          {round.answers[i] === question.answer ? "✓" : "↻"} {question.choices[round.answers[i]]}
                        </p>
                        <p>{m.answer}: <span lang={item.language ?? undefined}>{question.choices[question.answer]}</span></p>
                      </li>
                    );
                  })}
                </ol>
                <Link to="/learn" search={{ tab: round.kind === "practice" || round.kind === "retest" ? "profile" : "reading", concept: round.target }} className="mt-4 inline-block text-sm font-semibold text-brand-800 underline">
                  {m.open} →
                </Link>
              </details>
            );
          }
          if (row.kind !== "lesson" && row.kind !== "recall") {
            const done =
                row.kind === "recallDraft"
                  ? row.draft.ratings.length
                  : row.draft.answers.length,
              total =
                row.kind === "lessonDraft"
                  ? (lessonById(row.draft.lessonId)?.questions.length ??
                    row.draft.answers.length)
                  : row.kind === "recallDraft"
                    ? row.draft.cards.length
                    : row.draft.items.length;
            return (
              <article
                key={item.id}
                data-testid="history-draft"
                className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 p-5"
              >
                <p className="text-sm leading-7">
                  <strong>{item.label}</strong> · {statusLabel("draft")} {done}/
                  {total} · {new Date(row.at).toLocaleString(locale)}
                </p>
                <Link
                  to="/learn"
                  search={
                    row.kind === "lessonDraft"
                      ? { lesson: row.draft.lessonId }
                      : row.kind === "recallDraft"
                        ? { tab: "review" as const }
                        : {
                            tab: "today" as const,
                            concept: row.draft.target,
                            activity: row.draft.kind,
                          }
                  }
                  className="mt-2 inline-block text-sm font-semibold text-brand-800 underline"
                >
                  {t("learn.resumeDraft")} →
                </Link>
              </article>
            );
          }
          return row.kind === "lesson" ? (
            (() => {
              const event = row.event,
                lesson = lessonById(event.lessonId)!;
              return (
                <details
                  key={event.id}
                  data-testid="learning-round"
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <summary className="cursor-pointer text-sm leading-7">
                    <strong>{lesson.title[explanationLocale]}</strong> ·{" "}
                    {scoreLesson(lesson, event.answers)}/
                    {lesson.questions.length} ·{" "}
                    {new Date(event.at).toLocaleString(locale)}
                  </summary>
                  <ol className="mt-4 space-y-3">
                    {lesson.questions.map((q, i) => (
                      <li
                        key={i}
                        className="rounded-xl bg-slate-50 p-3 text-sm"
                      >
                        <p lang={lesson.language}>{q.prompt}</p>
                        <p className="mt-2">
                          {event.answers[i] === q.answer ? "✓" : "↻"}{" "}
                          <span lang={lesson.language}>
                            {q.choices[event.answers[i]]}
                          </span>
                        </p>
                        <p>
                          {m.answer}:{" "}
                          <span lang={lesson.language}>
                            {q.choices[q.answer]}
                          </span>
                        </p>
                      </li>
                    ))}
                  </ol>
                  <Link
                    to="/learn"
                    search={{ lesson: lesson.id }}
                    className="mt-4 inline-block text-sm font-semibold text-brand-800 underline"
                  >
                    {m.open} →
                  </Link>
                </details>
              );
            })()
          ) : (
            <details
              key={row.event.id}
              data-testid="recall-round"
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <summary className="cursor-pointer text-sm leading-7">
                <strong>{r.history}</strong> · {row.event.cards.length} ·{" "}
                {new Date(row.at).toLocaleString(locale)}
              </summary>
              <ol className="mt-4 space-y-3">
                {row.event.cards.map((id, i) => {
                  const c = studyCard(id)!;
                  return (
                    <li key={id} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <p lang={c.language}>{c.front}</p>
                      <p className="mt-2">{c.answer[explanationLocale]}</p>
                      <p className="mt-2">
                        {r.selfRating}:{" "}
                        {
                          r[
                            row.event.ratings[i] === 0
                              ? "again"
                              : row.event.ratings[i] === 1
                                ? "hard"
                                : "good"
                          ]
                        }
                      </p>
                    </li>
                  );
                })}
              </ol>
            </details>
          );
        })}
      </div>
      {!rows.length && (
        <div role="status" className="rounded-xl bg-white p-6">
          <p>{m.emptyHistory}</p>
          <Link
            to="/learn"
            search={{ tab: "courses" }}
            className="ielts-button mt-4 inline-block"
          >
            {m.courses} →
          </Link>
        </div>
      )}
      {rows.length > 0 && !visible.length && (
        <p role="status" className="rounded-xl bg-white p-6">
          {t("learn.noHistoryMatches")}
        </p>
      )}
      <Pagination
        page={page}
        totalPages={pages}
        total={visible.length}
        pageSize={10}
        onPageChange={setPage}
        className="mt-5"
      />
    </>
  );
}

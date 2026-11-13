import { ExamLearningLink } from "@/components/learning/ExamLearningLink";
import { Link } from "@tanstack/react-router";
import { QuestionFeedback } from "@/components/learning/QuestionFeedback";
import * as React from "react";
import {
  isExamId,
  sectionsFor,
  sectionIds,
  sectionResult,
  wordCount,
  type SectionId,
} from "@/lib/ielts/exam";
import type { ExamSession } from "@/lib/ielts/session";
import { ExamWritingTable } from "./ExamWritingTable";
import { ExamSources } from "./ExamSources";
import { useI18n } from "@/lib/i18n/context";
import { localizedText } from "@/lib/i18n/localized";
import { FILTER_LABELS, SECTION_LABELS } from "@/lib/ielts/ui";

export function ExamResults({
  session,
  locale,
  onBack,
}: {
  session: ExamSession;
  locale: string;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = React.useState("all");
  const [section, setSection] = React.useState<SectionId>(
    sectionIds(session.mode)[0],
  );
  const ids = sectionIds(session.mode);
  const sections = sectionsFor(
    isExamId(session.examId) ? session.examId : undefined,
  );
  const result = sectionResult(
    section,
    session.answers,
    isExamId(session.examId) ? session.examId : undefined,
  );
  const unanswered = result.rows.filter((r) => !r.answer.trim()).length;
  const visibleRows = result.rows.filter(
    (r) =>
      filter === "all" ||
      (filter === "incorrect" ? !r.correct : !r.answer.trim()),
  );
  const labels = localizedText(SECTION_LABELS, locale) ?? SECTION_LABELS.en;
  const statusLabel = (correct: boolean, answer: string) =>
    correct
      ? t("ielts.markCorrect")
      : answer.trim()
        ? t("ielts.markIncorrect")
        : t("ielts.markBlank");
  function jumpTo(id: string) {
    const target = document.getElementById(id);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  function download() {
    const content = [
      "LingoLearn — IELTS practice report",
      new Date(session.completedAt!).toISOString(),
      "Practice estimates only; not an official IELTS result.",
      ...ids.flatMap((id) => {
        if (id === "writing")
          return sections.writing.parts.map(
            (p) =>
              `${p.title} (${wordCount(session.answers[p.id] ?? "")} words)\n${session.answers[p.id] ?? ""}`,
          );
        const r = sectionResult(id, session.answers);
        return [
          `${id}: ${r.correct}/40 — estimated band ${r.band}`,
          ...r.rows.map(
            ({ question: q, answer, correct }) =>
              `${q.number}. ${q.prompt}\nYour answer: ${answer || "(blank)"}\n${correct ? "Correct" : "Incorrect"} — Accepted: ${q.answers.join(" / ")}\n${q.explanation}`,
          ),
        ];
      }),
    ].join("\n\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `ielts-practice-${session.id}.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main
      className="ielts-review mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10"
      dir="ltr"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          className="ielts-button !border-transparent !bg-transparent !px-0 !text-slate-600"
          onClick={onBack}
        >
          <span aria-hidden="true">← </span>
          {t("ielts.backToTests")}
        </button>
        <button className="ielts-button" onClick={download}>
          {t("ielts.downloadSheet")}
          <span className="ml-2" aria-hidden="true">
            ↓
          </span>
        </button>
      </div>
      <header className="mb-6 mt-7">
        <p className="text-xs font-semibold tracking-widest text-blue-700">
          ACADEMIC · PRACTICE 01
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {t("ielts.reviewTitle")}
          </h1>
          <p className="text-xs text-slate-500">
            {t("ielts.completedAt", {
              date: new Date(session.completedAt!).toLocaleString(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
        </div>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          {t("ielts.reviewIntro")}
        </p>
      </header>
      <Link to="/learn" search={{ tab: "ielts" }} className="ielts-button mb-5 inline-block">
        {t("ieltsPrep.open")} →
      </Link>
      <div
        className={`grid gap-3 ${ids.length > 1 ? "grid-cols-3" : ""}`}
        aria-label={t("ielts.sectionOverview")}
      >
        {ids.map((id) => {
          const r = sectionResult(
            id,
            session.answers,
            isExamId(session.examId) ? session.examId : undefined,
          );
          return (
            <button
              key={id}
              onClick={() => {
                setSection(id);
                setFilter("all");
              }}
              aria-pressed={section === id}
              className={`flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 text-left transition-colors motion-reduce:transition-none sm:p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${section === id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"}`}
            >
              <div>
                <h2
                  className={`text-sm font-semibold ${section === id ? "text-slate-200" : "text-slate-600"}`}
                >
                  {labels[id]}
                </h2>
                <p className="mt-2 break-words text-2xl font-bold tabular-nums sm:text-3xl">
                  {id === "writing" ? (
                    sections.writing.parts
                      .map((p) => wordCount(session.answers[p.id] ?? ""))
                      .join(" / ")
                  ) : (
                    <>
                      {r.correct}
                      <span className="text-base font-normal opacity-70">
                        {" "}
                        / 40
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div
                className={`rounded-xl px-2 py-2 text-xs sm:px-4 sm:py-3 sm:text-sm ${section === id ? "bg-white/10 text-slate-100" : "bg-slate-50 text-slate-600"}`}
              >
                {id === "writing" ? (
                  t("ielts.writingPending")
                ) : (
                  <>
                    <span className="block text-xs">
                      {t("ielts.estimatedBand")}
                    </span>
                    <strong className="mt-1 block text-xl tabular-nums">
                      {r.band!.toFixed(1)}
                    </strong>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <p className="my-5 text-xs leading-6 text-slate-500">
        {t("ielts.bandNote")}
      </p>
      {section === "writing" ? (
        <div className="space-y-5">
          {sections.writing.parts.map((part) => {
            const count = wordCount(session.answers[part.id] ?? "");
            return (
              <article
                key={part.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-bold">{part.title}</h2>
                  <p
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${count >= part.minWords! ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
                  >
                    {count} / {part.minWords}{" "}
                    {t("ielts.wordsMin")}
                  </p>
                </div>
                <details className="mt-5 rounded-xl border border-slate-200 p-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    {t("ielts.viewTask")}
                  </summary>
                  <p className="my-4 whitespace-pre-wrap text-sm leading-7">
                    {part.content}
                  </p>
                  {part.id === "task-1" && (
                    <ExamWritingTable
                      examId={
                        isExamId(session.examId) ? session.examId : undefined
                      }
                    />
                  )}
                  <QuestionFeedback question={"i:" + part.id} />
                </details>
                <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-600">
                  {t("ielts.yourResponse")}
                </h3>
                <div className="break-words whitespace-pre-wrap rounded-xl bg-slate-50 p-5 leading-8">
                  {session.answers[part.id] ||
                    (t("ielts.noResponse"))}
                </div>
                <h3 className="mt-6 text-sm font-semibold">
                  {t("ielts.selfCheck")}
                </h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
                  <li>
                    {t("ielts.check1")}
                  </li>
                  <li>
                    {t("ielts.check2")}
                  </li>
                  <li>
                    {t("ielts.check3")}
                  </li>
                </ul>
              </article>
            );
          })}
        </div>
      ) : (
        <>
          <section
            className="mb-5 rounded-2xl border border-slate-200 bg-white p-5"
            aria-label={t("ielts.answerBreakdown")}
          >
            <div className="flex flex-wrap justify-between gap-3 text-sm">
              <p className="font-semibold">
                {labels[section]} · {t("ielts.answerBreakdown")}
              </p>
              <p className="flex flex-wrap gap-4 text-xs">
                <span className="text-emerald-800">
                  ✓ {t("ielts.markCorrect")} {result.correct}
                </span>
                <span className="text-rose-800">
                  × {t("ielts.markIncorrect")}{" "}
                  {40 - result.correct - unanswered}
                </span>
                <span className="text-slate-600">
                  − {t("ielts.blank")} {unanswered}
                </span>
              </p>
            </div>
            <div
              aria-hidden="true"
              className="mt-4 flex h-2 overflow-hidden rounded-full bg-slate-100"
            >
              <span
                className="bg-emerald-600"
                style={{ width: `${(result.correct / 40) * 100}%` }}
              />
              <span
                className="bg-rose-400"
                style={{
                  width: `${((40 - result.correct - unanswered) / 40) * 100}%`,
                }}
              />
            </div>
          </section>
          <div
            className="mb-5 flex flex-wrap gap-2"
            role="group"
            aria-label={t("ielts.filterAnswers")}
          >
            {["all", "incorrect", "unanswered"].map((f, i) => (
              <button
                key={f}
                className={`ielts-button ${filter === f ? "!border-blue-700 !bg-blue-50 !text-blue-900" : "!border-slate-200 !text-slate-600"}`}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
              >
                {
                  (localizedText(FILTER_LABELS, locale) ?? FILTER_LABELS.en)[i]
                }{" "}
                <span className="ml-2 tabular-nums opacity-70">
                  {[40, 40 - result.correct, unanswered][i]}
                </span>
              </button>
            ))}
          </div>
          <p role="status" className="sr-only">
            {t("ielts.showingN", { count: visibleRows.length })}
          </p>
          {visibleRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <span
                aria-hidden="true"
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl text-emerald-700"
              >
                ✓
              </span>
              <h2 className="mt-4 text-lg font-semibold">
                {filter === "unanswered"
                  ? t("ielts.noneMissing")
                  : t("ielts.allCorrect")}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {t("ielts.reviewAllHint")}
              </p>
              <button
                className="ielts-button mt-5"
                onClick={() => setFilter("all")}
              >
                {t("ielts.showAll")}
              </button>
            </div>
          ) : (
            <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
              <nav
                id="review-question-map"
                tabIndex={-1}
                aria-label={t("ielts.questionMap")}
                className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-4 lg:sticky lg:top-6"
              >
                <h2 className="text-sm font-semibold">
                  {t("ielts.jumpToQ")}
                </h2>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {t("ielts.jumpToQHint")}
                </p>
                <div className="mt-4 grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
                  {visibleRows.map(({ question: q, answer, correct }) => (
                    <button
                      key={q.id}
                      aria-label={`${t("ielts.questionN", { n: q.number })}, ${statusLabel(correct, answer)}`}
                      onClick={() => jumpTo(`review-${q.id}`)}
                      className={`flex min-h-11 items-center justify-center gap-0.5 rounded-lg border text-xs font-semibold tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${correct ? "border-emerald-200 bg-emerald-50 text-emerald-800" : answer.trim() ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}
                    >
                      <span>{q.number}</span>
                      <span aria-hidden="true" className="text-[10px]">
                        {correct ? "✓" : answer.trim() ? "×" : "−"}
                      </span>
                    </button>
                  ))}
                </div>
              </nav>
              <div className="min-w-0 space-y-4">
                {visibleRows.map(({ question: q, answer, correct }) => (
                  <article
                    id={`review-${q.id}`}
                    tabIndex={-1}
                    key={q.id}
                    className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 focus:outline focus:outline-2 focus:outline-blue-600 sm:p-6"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${correct ? "bg-emerald-50 text-emerald-800" : answer.trim() ? "bg-rose-50 text-rose-800" : "bg-slate-100 text-slate-600"}`}
                      >
                        {correct ? "✓" : answer.trim() ? "×" : "−"}{" "}
                        {statusLabel(correct, answer)}
                      </span>
                      <button
                        className="min-h-11 text-xs font-medium text-slate-500 underline underline-offset-4 hover:text-blue-700"
                        onClick={() => jumpTo("review-question-map")}
                      >
                        {t("ielts.mapUp")}
                      </button>
                    </div>
                    <h3 className="font-semibold leading-7">
                      <span className="mr-2 text-slate-500">{q.number}.</span>
                      {q.prompt}
                    </h3>
                    <dl className="my-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-slate-500">
                          {t("ielts.yourAnswer")}
                        </dt>
                        <dd
                          className={`mt-1.5 break-words font-semibold ${!correct && answer.trim() ? "text-rose-800" : "text-slate-800"}`}
                        >
                          {answer || (t("ielts.noAnswer"))}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">
                          {t("ielts.acceptedAnswer")}
                        </dt>
                        <dd className="mt-1.5 break-words font-semibold text-emerald-800">
                          {q.answers.join(" / ")}
                        </dd>
                      </div>
                    </dl>
                    <p className="text-sm leading-7 text-slate-600">
                      {q.explanation}
                    </p>
                    <QuestionFeedback question={"i:" + q.id} />
                    {!correct && (
                      <ExamLearningLink
                        question={"i:" + q.id}
                        examId={session.examId}
                      />
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
          <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <summary className="cursor-pointer font-semibold">
              {t("ielts.viewSources")}
            </summary>
            {sections[section].parts.map((p) => (
              <article className="mt-6" key={p.id}>
                <h3 className="font-bold">{p.title}</h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
                  {p.content}
                </p>
                {session.notes[p.id] && (
                  <p className="mt-3 break-words whitespace-pre-wrap rounded-lg bg-yellow-50 p-4">
                    {session.notes[p.id]}
                  </p>
                )}
              </article>
            ))}
          </details>
        </>
      )}
      <ExamSources />
    </main>
  );
}

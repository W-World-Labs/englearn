import { ExamLearningLink } from "@/components/learning/ExamLearningLink";
import { QuestionFeedback } from "@/components/learning/QuestionFeedback";
import * as React from "react";
import { useI18n } from "@/lib/i18n/context";
import { examMessages } from "@/lib/exams/messages";
import {
  getPaper,
  practiceSections,
  practiceCorrect,
  characterCount,
  practiceOptionLabel,
  practiceAnswerText,
  explanationFor,
  type PracticeSection,
} from "@/lib/exams/catalog";
import { PracticeAudio } from "./PracticeAudio";
import { PracticePassage } from "./PracticePassage";
import { PracticeCorrections } from "./PracticeCorrections";
import type { PracticeSession } from "@/lib/exams/session";
export function downloadPractice(session: PracticeSession, backup = false) {
  const paper = getPaper(session.paperId)!;
  const sections = practiceSections(paper, session.mode);
  const content = backup
    ? JSON.stringify(session, null, 2)
    : [
        `LingoLearn — ${paper.label} — Short practice`,
        `Started: ${new Date(session.startedAt).toISOString()}`,
        paper.family === "jlpt"
          ? "Original short JLPT practice. No official scaled score or pass prediction."
          : "Original, uncalibrated practice. No official score or predicted level. Open writing is ungraded.",
        ...paper.questions
          .filter((q) => sections.some((s) => s.id === q.section))
          .map((q) =>
            [
              `${q.section} / ${q.id}: ${q.prompt}`,
              q.passage ?? "",
              q.script ? `Transcript: ${q.script}` : "",
              `Your answer: ${practiceAnswerText(q, session.answers[q.id], paper.language) || "(blank)"}`,
              q.kind === "writing"
                ? "Writing: requires human review"
                : `Accepted: ${[q.answer, ...(q.accepted ?? [])].map((a) => practiceAnswerText(q, a!, paper.language)).join(" / ")}`,
              q.explanation.zh,
              q.explanation.en,
              q.explanation.ja,
            ]
              .filter(Boolean)
              .join("\n"),
          ),
      ].join("\n\n");
  const url = URL.createObjectURL(
    new Blob([content], {
      type: backup ? "application/json" : "text/plain;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${paper.id}-${session.id}.${backup ? "json" : "txt"}`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function PracticeReview({
  session,
  onBack,
}: {
  session: PracticeSession;
  onBack: () => void;
}) {
  const { locale } = useI18n();
  const m = examMessages(locale);
  const paper = getPaper(session.paperId)!;
  const sections = practiceSections(paper, session.mode);
  const [section, setSection] = React.useState<PracticeSection>(sections[0].id);
  const [filter, setFilter] = React.useState("all");
  const [correcting, setCorrecting] = React.useState(false);
  const missed = paper.questions.filter(
    (q) =>
      sections.some((s) => s.id === q.section) &&
      q.kind !== "writing" &&
      !practiceCorrect(q, session.answers[q.id]),
  );
  const questions = paper.questions.filter((q) => q.section === section);
  const visible = questions.filter(
    (q) =>
      filter === "all" ||
      !session.answers[q.id]?.trim() ||
      (filter === "incorrect" &&
        q.kind !== "writing" &&
        !practiceCorrect(q, session.answers[q.id])),
  );
  if (correcting)
    return (
      <PracticeCorrections
        paper={paper}
        questions={missed}
        onBack={() => setCorrecting(false)}
      />
    );
  return (
    <main className="mx-auto max-w-5xl px-4 py-7 sm:px-6" dir="ltr">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className="ielts-button" onClick={onBack}>
          ← {m.back}
        </button>
        <button
          className="ielts-button"
          onClick={() => downloadPractice(session)}
        >
          {m.download} ↓
        </button>
      </div>
      <header className="mb-6 mt-8">
        <p className="text-xs font-semibold tracking-widest text-blue-700">
          {paper.label} · {m.short}
        </p>
        <h1 className="mt-3 text-3xl font-bold">{m.report}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          {paper.family === "jlpt" ? m.jlptScoreNote : m.scoreNote}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {new Date(session.completedAt!).toLocaleString(locale)}
        </p>
      </header>
      {!!missed.length && (
        <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div>
            <h2 className="font-semibold text-blue-950">
              {m.reviewMistakes} · {missed.length} {m.questions}
            </h2>
            <p className="mt-2 max-w-xl text-xs leading-6 text-blue-900">
              {m.drillHint}
            </p>
          </div>
          <button
            className="ielts-button !border-blue-700 !bg-blue-700 !text-white"
            onClick={() => setCorrecting(true)}
          >
            {m.reviewMistakes} →
          </button>
        </section>
      )}
      <div className="grid gap-3 sm:grid-cols-3" aria-label={m.skills}>
        {sections.map((s) => {
          const items = paper.questions.filter((q) => q.section === s.id),
            graded = items.filter((q) => q.kind !== "writing");
          const count = graded.filter((q) =>
            practiceCorrect(q, session.answers[q.id]),
          ).length;
          return (
            <button
              key={s.id}
              className={`rounded-xl border p-4 text-left ${section === s.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}
              aria-pressed={section === s.id}
              onClick={() => {
                setSection(s.id);
                setFilter("all");
              }}
            >
              <span className="block text-sm font-semibold">{m[s.id]}</span>
              <span className="my-2 block text-2xl font-bold tabular-nums">
                {graded.length ? `${count} / ${graded.length}` : "—"}
              </span>
              <span className="text-xs opacity-80">
                {graded.length ? m.correct : m.ungraded} ·{" "}
                {items.filter((q) => !session.answers[q.id]?.trim()).length}{" "}
                {m.blank}
              </span>
            </button>
          );
        })}
      </div>
      <div
        className="my-5 flex flex-wrap gap-2"
        role="group"
        aria-label={m.allAnswers}
      >
        {["all", "incorrect", "blank"].map((f, i) => (
          <button
            key={f}
            className={`ielts-button ${filter === f ? "!border-blue-600 !bg-blue-50" : ""}`}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {[m.allAnswers, m.incorrect, m.blank][i]}
          </button>
        ))}
      </div>
      {!visible.length && (
        <p
          role="status"
          className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"
        >
          {m.noMatches}
        </p>
      )}
      <div className="space-y-4">
        {visible.map((q) => {
          const answer = session.answers[q.id] ?? "";
          const ok = practiceCorrect(q, answer);
          const status = !answer.trim()
            ? m.blank
            : q.kind === "writing"
              ? m.ungraded
              : ok
                ? m.correct
                : m.wrong;
          return (
            <article
              key={q.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">
                  {m[section]} · {questions.indexOf(q) + 1}
                </h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${ok ? "bg-emerald-50 text-emerald-800" : q.kind === "writing" ? "bg-blue-50 text-blue-800" : "bg-slate-100 text-slate-600"}`}
                >
                  {status}
                </span>
              </div>
              <p
                className="whitespace-pre-wrap leading-8"
                lang={paper.language}
              >
                {q.prompt}
              </p>
              {q.picture && (
                <p
                  className="mt-3 text-5xl"
                  role="img"
                  aria-label={q.pictureLabel}
                >
                  {q.picture}
                </p>
              )}
              {q.script && (
                <PracticeAudio
                  paperId={paper.id}
                  questionId={q.id}
                  className="my-4"
                />
              )}
              {(q.script || q.passage) && (
                <details className="my-4 rounded-lg border border-slate-200 p-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    {q.script ? m.transcript : m.source}
                  </summary>
                  <div className="mt-3">
                    {q.script ? (
                      <p
                        className="whitespace-pre-wrap leading-8"
                        lang={paper.language}
                      >
                        {q.script}
                      </p>
                    ) : (
                      <PracticePassage question={q} language={paper.language} />
                    )}
                  </div>
                </details>
              )}
              {q.options && (
                <ol
                  className="my-4 grid gap-2 text-sm sm:grid-cols-2"
                  lang={paper.language}
                >
                  {q.options.map((option, i) => (
                    <li
                      key={i}
                      className={
                        q.answer === String.fromCharCode(65 + i)
                          ? "font-semibold text-emerald-800"
                          : "text-slate-600"
                      }
                    >
                      {practiceOptionLabel(paper.language, i)}. {option}
                    </li>
                  ))}
                </ol>
              )}
              <p className="mb-2 mt-5 text-xs font-semibold text-slate-500">
                {m.answer}
              </p>
              <div
                className="break-words whitespace-pre-wrap rounded-xl bg-slate-50 p-4 leading-8"
                lang={paper.language}
              >
                {practiceAnswerText(q, answer, paper.language) || "—"}
              </div>
              {q.kind === "writing" ? (
                <p className="mt-2 text-xs text-slate-500">
                  {characterCount(answer, paper.language)}{" "}
                  {paper.language === "zh-CN" ? m.hanzi : m.characters} ·{" "}
                  {m.target}: {q.minChars}–{q.maxChars}
                </p>
              ) : (
                <p className="mt-3 text-sm text-emerald-800">
                  {m.accepted}:{" "}
                  {practiceAnswerText(q, q.answer!, paper.language)}
                </p>
              )}
              <QuestionFeedback question={`e:${paper.id}:${q.id}`} />
              {!ok && q.kind !== "writing" && (
                <ExamLearningLink question={`e:${paper.id}:${q.id}`} />
              )}
              <h3 className="mb-2 mt-5 text-sm font-semibold">
                {m.explanation}
              </h3>
              <p className="text-sm leading-7 text-slate-600">
                {explanationFor(q.explanation, locale)}
              </p>
            </article>
          );
        })}
      </div>
    </main>
  );
}

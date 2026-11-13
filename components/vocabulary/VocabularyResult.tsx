import * as React from "react";
import { Link } from "@tanstack/react-router";
import { reinforcementMessages } from "@/lib/learning/reinforcement-messages";
import { useI18n } from "@/lib/i18n/context";
import { vocabularyMessages } from "@/lib/vocabulary/messages";
import { vocabularyWord, LANGUAGE_NAMES } from "@/lib/vocabulary/bank";
import { scoreVocabulary } from "@/lib/vocabulary/score";
import type { VocabularySession } from "@/lib/vocabulary/session";

export function downloadVocabulary(session: VocabularySession, backup = false) {
  const result = scoreVocabulary(session);
  const content = backup
    ? JSON.stringify(session, null, 2)
    : [
        `LingoLearn vocabulary · ${LANGUAGE_NAMES[session.language]} · ${new Date(session.startedAt).toISOString()}`,
        `Definitions: ${session.meaningLanguage}; bank: ${session.bank}; selection: ${session.adaptive ? `adaptive v${session.adaptive.version}` : "fixed strata"}`,
        ...(result?.stopping
          ? [
              `Stopping: ${result.stopping.reason}; ${result.total} questions; model posterior SD ${Math.round(result.stopping.standardError)} word forms; target ${result.stopping.targetSE}. These are uncalibrated model quantities, not a validated measurement error.`,
            ]
          : []),
        ...(result
          ? result.bands.map(
              (b) =>
                `Frequency ranks ${b.from}–${b.to}: ${b.correct}/${b.total} correct (${Math.round((100 * b.correct) / b.total)}%); recognition evidence: ${b.recognitionSupported ? "supported" : "limited"}`,
            )
          : []),
        ...(session.adaptive
          ? [
              `Difficulty path (1–4): ${session.questions.map((q) => vocabularyWord(q.id)!.band + 1).join(" → ")}`,
            ]
          : []),
        `Reference within 10,000 written word forms, not total vocabulary, word families or an exam score. Uncalibrated bank; model interval excludes item-selection and corpus biases.`,
        result
          ? `Correct: ${result.correct}/${result.total}; ${result.estimate === null ? "Insufficient recognition evidence; no vocabulary count or range reported. This does not mean zero vocabulary." : `reference estimate: ${result.estimate}; reference range: ${result.lower}–${result.upper}`}`
          : "Incomplete test — no estimate.",
        ...session.questions.map((q) => {
          const w = vocabularyWord(q.id)!;
          return `${w.word}\t${w.meaning[session.meaningLanguage]}\t${session.answers[q.id] === q.id ? "correct" : session.answers[q.id] === "unknown" ? "unknown" : "to learn"}\t${w.meaning.en}\t${w.meaning.zh}`;
        }),
        "Frequency data: wordfreq 3.1.1 by Robyn Speer and contributors; original definitions by LingoLearn. CC-BY-SA-4.0; https://llearn.myfastools.com/vocabulary-assets/NOTICE.md",
      ].join("\n\n");
  const url = URL.createObjectURL(
    new Blob([content], {
      type: backup ? "application/json" : "text/plain;charset=utf-8",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `vocabulary-${session.language}-${session.id}.${backup ? "json" : "txt"}`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function VocabularyMethod({ dynamic = true }: { dynamic?: boolean }) {
  const m = vocabularyMessages(useI18n().locale);
  return (
    <details className="mt-6 rounded-2xl border border-slate-200 bg-white/70 p-5 text-xs leading-7 text-slate-600">
      <summary className="cursor-pointer font-semibold text-slate-900">
        {m.methodology}
      </summary>
      <p className="mt-3">{m.scope}</p>
      <p className="mt-2">{m.model}</p>
      <p className="mt-2">{m.recognitionMethod}</p>
      {dynamic && <p className="mt-2">{m.stoppingMethod}</p>}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <a className="underline" href="https://arxiv.org/abs/1810.08240">
          {m.recognitionSource}
        </a>
        {dynamic && (
          <a
            className="underline"
            href="https://pmc.ncbi.nlm.nih.gov/articles/PMC3028267/"
          >
            {m.stoppingSource}
          </a>
        )}
        <a className="underline" href="https://github.com/rspeer/wordfreq">
          {m.source}
        </a>
        <a className="underline" href="/vocabulary-assets/NOTICE.md">
          {m.attribution}
        </a>
      </div>
    </details>
  );
}
export function VocabularyResult({
  session,
  onBack,
  onMoreEvidence,
}: {
  session: VocabularySession;
  onBack: () => void;
  onMoreEvidence: () => void;
}) {
  const { locale, setLearningLanguage } = useI18n(),
    m = vocabularyMessages(locale),
    r = reinforcementMessages(locale);
  const result = scoreVocabulary(session)!;
  const [all, setAll] = React.useState(false);
  const missed = session.questions.filter(
    (q) => session.answers[q.id] !== q.id,
  );
  const seedWords = (missed.length ? missed : session.questions)
    .map((q) => q.id)
    .join(",");
  return (
    <div className="mt-7">
      <div className="flex flex-wrap justify-between gap-3">
        <button className="ielts-button" onClick={onBack}>
          ← {m.back}
        </button>
        <button
          className="ielts-button"
          onClick={() => downloadVocabulary(session)}
        >
          {m.download} ↓
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to="/learn"
          search={{ tab: "materials", words: seedWords }}
          data-testid="vocabulary-materials"
          className="inline-block rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900"
        >
          {r.makeMaterials} →
        </Link>
        <Link
          to="/learn"
          search={{ tab: "review", words: seedWords }}
          onClick={() => setLearningLanguage(session.language)}
          data-testid="vocabulary-review-words"
          className="inline-block rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900"
        >
          {r.reviewWords} →
        </Link>
      </div>
      <header className="my-7">
        <p className="text-xs font-semibold tracking-widest text-amber-800">
          {LANGUAGE_NAMES[session.language]} · {m[session.mode]} ·{" "}
          {new Date(session.completedAt!).toLocaleDateString(locale)}
        </p>
        <h1 className="mt-3 text-3xl font-bold">{m.result}</h1>
      </header>
      {result.stopping && (
        <section
          className={`mb-5 rounded-2xl border p-5 ${result.stopping.reason === "precision" && result.recognitionSupported ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
          data-testid="vocabulary-stopping"
          data-reason={result.stopping.reason}
        >
          <h2 className="text-sm font-semibold">
            {m.stopTitle} · {result.total} {m.questionCount}
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {result.stopping.reason === "precision"
              ? result.recognitionSupported
                ? m.stopPrecision
                : m.stopUnconfirmed
              : result.stopping.reason === "low_gain"
                ? m.stopLowGain
                : m.stopLimit}
          </p>
        </section>
      )}
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-3xl bg-slate-900 p-6 text-white sm:p-8">
          <p className="text-sm text-slate-300">{m.estimate}</p>
          <p
            className="my-4 text-4xl font-bold tabular-nums sm:text-5xl"
            data-testid="vocabulary-estimate"
          >
            {result.estimate === null
              ? m.none
              : `≈ ${result.estimate.toLocaleString(locale)}`}
          </p>
          {result.estimate !== null && (
            <p
              className="text-sm text-amber-200"
              data-testid="vocabulary-range"
            >
              {m.range}: {result.lower.toLocaleString(locale)}–
              {result.upper.toLocaleString(locale)} {m.units}
            </p>
          )}
          <p className="mt-5 text-xs leading-7 text-slate-300">{m.scope}</p>
          {result.estimate === null ? (
            <p
              className="mt-4 rounded-xl bg-white/10 p-3 text-xs leading-6"
              data-testid="vocabulary-insufficient"
            >
              {result.correct === 0 ? m.noneHint : m.insufficientRecognition}
            </p>
          ) : (
            result.ceiling && (
              <p className="mt-4 rounded-xl bg-white/10 p-3 text-xs leading-6">
                {m.ceiling}
              </p>
            )
          )}
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">{m.accuracy}</p>
              <p className="mt-2 text-3xl font-bold">
                {result.correct} / {result.total}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">{m.skipped}</p>
              <p className="mt-2 text-3xl font-bold">{result.unknown}</p>
            </div>
          </div>
          <h2 className="mt-7 font-semibold">{m.recommendation}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {result.focusBand === 0
              ? m.foundation
              : result.focusBand === -1
                ? m.advanced
                : m.focus}
          </p>
          {session.mode === "quick" &&
            result.bands.some((b) => !b.recognitionSupported) && (
              <div className="mt-4">
                <button
                  className="ielts-button text-xs"
                  onClick={onMoreEvidence}
                >
                  {m.moreEvidence} →
                </button>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  {m.moreEvidenceHint}
                </p>
              </div>
            )}
        </section>
      </div>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <h2 className="font-semibold">{m.bands}</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {result.bands.map((b) => (
            <div key={b.from}>
              <div className="mb-2 flex justify-between gap-3 text-xs">
                <span>
                  {m.band} {b.from.toLocaleString(locale)}–
                  {b.to.toLocaleString(locale)}
                </span>
                <strong>
                  {Math.round((100 * b.correct) / b.total)}% · {b.correct} /{" "}
                  {b.total}
                </strong>
              </div>
              <p
                className="mb-2 text-xs text-slate-600"
                data-testid="vocabulary-band-evidence"
                data-supported={b.recognitionSupported}
              >
                {b.recognitionSupported
                  ? m.bandSupported
                  : b.total < 5
                    ? m.bandSmallSample
                    : m.bandUnconfirmed}
              </p>
              <progress
                className="h-2 w-full appearance-none overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:bg-emerald-600 [&::-moz-progress-bar]:bg-emerald-600"
                aria-label={`${m.band} ${b.from}–${b.to}`}
                max={b.total}
                value={b.correct}
              />
            </div>
          ))}
        </div>
      </section>
      {session.adaptive && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <h2 className="font-semibold">{m.path}</h2>
          <p className="mt-2 text-xs leading-6 text-slate-600">{m.pathHint}</p>
          <ol
            aria-label={m.path}
            className="mt-4 flex h-20 items-end gap-1"
            data-testid="vocabulary-path"
          >
            {session.questions.map((q, i) => {
              const band = vocabularyWord(q.id)!.band;
              const correct = session.answers[q.id] === q.id;
              const label = `${m.question} ${i + 1} · ${m.difficulty} ${band + 1} · ${correct ? m.correct : m.incorrect}`;
              return (
                <li
                  key={q.id}
                  title={label}
                  className={`min-w-0 flex-1 rounded-t ${["h-4", "h-8", "h-12", "h-16"][band]} ${correct ? "bg-emerald-600" : "bg-amber-500"}`}
                >
                  <span className="sr-only">{label}</span>
                </li>
              );
            })}
          </ol>
          <div className="mt-3 flex justify-between text-xs text-slate-500">
            <span>1</span>
            <span>{session.questions.length}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-emerald-600"
              />
              {m.correct}
            </span>
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-amber-500"
              />
              {m.incorrect}
            </span>
          </div>
        </section>
      )}
      <section className="mt-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">{m.review}</h2>
          <div className="flex gap-2">
            <button
              className="ielts-button text-xs"
              aria-pressed={!all}
              onClick={() => setAll(false)}
            >
              {m.missed} ({missed.length})
            </button>
            <button
              className="ielts-button text-xs"
              aria-pressed={all}
              onClick={() => setAll(true)}
            >
              {m.all}
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(all ? session.questions : missed).map((q) => {
            const w = vocabularyWord(q.id)!;
            const answer = session.answers[q.id];
            return (
              <article
                key={q.id}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex justify-between gap-3">
                  <h3 lang={session.language} className="text-xl font-semibold">
                    {w.word}
                  </h3>
                  <span className="text-xs text-slate-500">#{w.rank}</span>
                </div>
                <p
                  className="mt-3 text-sm leading-7 text-emerald-800"
                  lang={session.meaningLanguage}
                >
                  {m.definition}: {w.meaning[session.meaningLanguage]}
                </p>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  {answer === q.id
                    ? m.correct
                    : `${m.yourAnswer}: ${answer === "unknown" ? m.unknown : (vocabularyWord(answer)?.meaning[session.meaningLanguage] ?? "—")}`}
                </p>
              </article>
            );
          })}
        </div>
        {!all && !missed.length && (
          <p className="mt-4 text-sm text-emerald-800">{m.empty}</p>
        )}
      </section>
      <VocabularyMethod dynamic={session.adaptive?.version === 2} />
    </div>
  );
}

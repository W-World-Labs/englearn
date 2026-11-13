import * as React from "react";
import { useI18n } from "@/lib/i18n/context";
import { examMessages } from "@/lib/exams/messages";
import {
  practiceCorrect,
  practiceAnswerText,
  explanationFor,
  type PracticePaper,
  type PracticeQuestion,
} from "@/lib/exams/catalog";
import { PracticeAudio } from "./PracticeAudio";
import { PracticeAnswer } from "./PracticeAnswer";
import { PracticePassage } from "./PracticePassage";
import { ExamLearningLink } from "@/components/learning/ExamLearningLink";

export function PracticeCorrections({
  paper,
  questions,
  onBack,
}: {
  paper: PracticePaper;
  questions: PracticeQuestion[];
  onBack: () => void;
}) {
  const { locale } = useI18n(),
    m = examMessages(locale);
  const [round, setRound] = React.useState(questions);
  const [index, setIndex] = React.useState(0);
  const [answer, setAnswer] = React.useState("");
  const [checked, setChecked] = React.useState(false);
  const [results, setResults] = React.useState<Record<string, boolean>>({});
  const [finished, setFinished] = React.useState(false);
  const heading = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    heading.current?.focus();
  }, [index, finished]);
  const q = round[index],
    corrected = Object.values(results).filter(Boolean).length;
  const remaining = questions.filter((q) => !results[q.id]);
  function reset() {
    setAnswer("");
    setChecked(false);
  }
  return (
    <main className="mx-auto max-w-4xl px-4 py-7 sm:px-6" dir="ltr">
      <button className="ielts-button" onClick={onBack}>
        ← {m.returnReview}
      </button>
      <header className="my-7">
        <p className="text-xs font-semibold tracking-widest text-blue-700">
          {paper.label} · {m.reviewMistakes}
        </p>
        <h1
          ref={heading}
          tabIndex={-1}
          className="mt-3 text-3xl font-bold focus:outline-none"
        >
          {finished
            ? m.drillDone
            : `${m.question} ${index + 1} / ${round.length}`}
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">{m.drillHint}</p>
        <p className="mt-4 text-sm font-semibold text-emerald-800">
          {m.corrections}: {corrected} / {questions.length}
        </p>
        <progress
          aria-label={m.corrections}
          className="mt-3 h-2 w-full appearance-none overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:bg-emerald-600 [&::-moz-progress-bar]:bg-emerald-600"
          value={corrected}
          max={questions.length}
        />
      </header>
      {finished ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-4xl font-bold tabular-nums text-emerald-900">
            {corrected} / {questions.length}
          </p>
          <p className="my-3 text-sm text-emerald-900">{m.corrections}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {!!remaining.length && (
              <button
                className="ielts-button"
                onClick={() => {
                  setRound(remaining);
                  setIndex(0);
                  setFinished(false);
                  reset();
                }}
              >
                {m.drillAgain} ({remaining.length}) →
              </button>
            )}
            <button className="ielts-button" onClick={onBack}>
              {m.returnReview}
            </button>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
          <p className="mb-4 text-xs font-semibold text-slate-500">
            {m[q.section]}
          </p>
          {q.script && (
            <PracticeAudio
              key={q.id}
              paperId={paper.id}
              questionId={q.id}
              className="mb-6"
            />
          )}
          <p
            className="whitespace-pre-wrap text-lg leading-9"
            lang={paper.language}
          >
            {q.prompt}
          </p>
          {q.picture && (
            <p className="my-5 text-6xl" role="img" aria-label={q.pictureLabel}>
              {q.picture}
            </p>
          )}
          {q.passage && (
            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <PracticePassage question={q} language={paper.language} />
            </div>
          )}
          <PracticeAnswer
            question={q}
            language={paper.language}
            value={answer}
            onChange={setAnswer}
            disabled={checked}
          />
          {checked && (
            <div
              role="status"
              className={`mt-6 rounded-xl p-5 ${results[q.id] ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}
            >
              <h2 className="font-bold">
                {results[q.id] ? m.correct : m.wrong}
              </h2>
              <p className="mt-2 text-sm">
                {m.accepted}: {practiceAnswerText(q, q.answer!, paper.language)}
              </p>
              <p className="mt-3 text-sm leading-7">
                {explanationFor(q.explanation, locale)}
              </p>
              {q.script && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    {m.transcript}
                  </summary>
                  <p className="mt-2 leading-8" lang={paper.language}>
                    {q.script}
                  </p>
                </details>
              )}
            </div>
          )}
          {checked && !results[q.id] && q.kind !== "writing" && (
            <ExamLearningLink question={`e:${paper.id}:${q.id}`} />
          )}
          <div className="mt-7 flex flex-wrap justify-end gap-3">
            {checked && !results[q.id] && (
              <button className="ielts-button" onClick={reset}>
                {m.tryAgain}
              </button>
            )}
            {checked ? (
              <button
                className="ielts-button !bg-slate-900 !text-white"
                onClick={() => {
                  if (index + 1 === round.length) setFinished(true);
                  else setIndex(index + 1);
                  reset();
                }}
              >
                {index + 1 === round.length ? m.drillDone : m.next} →
              </button>
            ) : (
              <button
                className="ielts-button !bg-slate-900 !text-white"
                disabled={!answer.trim()}
                onClick={() => {
                  setResults({
                    ...results,
                    [q.id]: practiceCorrect(q, answer),
                  });
                  setChecked(true);
                }}
              >
                {m.checkAnswer}
              </button>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

import { QuestionFeedback } from "@/components/learning/QuestionFeedback";
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n/context";
import { lessonById, type StudyLocale } from "@/lib/learning/catalog";
import { gradedText } from "@/lib/learning/workbench-content";
import { workbenchMessages } from "@/lib/learning/workbench-messages";
import {
  activityQuestion,
  freshRetest,
  conceptProfiles,
  activityLanguage,
  answerActivity,
  finishActivity,
  scoreActivity,
  startActivity,
  withWorkbench,
  workbench,
  type ActivityKind,
} from "@/lib/learning/workbench";
import type { StudyJournal } from "@/lib/learning/session";
export function ReadingText({
  id,
  session,
  commit,
  explanationLocale,
  listening = false,
}: {
  id: string;
  session: StudyJournal;
  commit: (s: StudyJournal) => void;
  explanationLocale: StudyLocale;
  listening?: boolean;
}) {
  const { locale, t } = useI18n(),
    m = workbenchMessages(locale),
    text = gradedText(id)!;
  const [audioError, setAudioError] = React.useState(false),
    [audioKey, setAudioKey] = React.useState(0);
  return (
    <div className="space-y-4" data-testid="reading-text">
      <p className="text-xs text-slate-500">
        <a
          className="underline"
          href="/learning-audio/NOTICE.md"
          target="_blank"
          rel="noreferrer"
        >
          {m.synthetic} · CC BY-SA 4.0
        </a>
      </p>
      <audio
        key={audioKey}
        controls
        preload="metadata"
        className="w-full"
        src={"/api/learning/audio?id=" + encodeURIComponent(id)}
        onError={() => setAudioError(true)}
        aria-label={text.title[explanationLocale]}
      />
      {audioError && (
        <p role="alert" className="text-sm">
          {m.audioError}{" "}
          <button
            className="ielts-button"
            onClick={() => {
              setAudioError(false);
              setAudioKey((n) => n + 1);
            }}
          >
            {m.retry}
          </button>
        </p>
      )}
      <details
        open={!listening}
        className="rounded-xl border border-slate-200 p-4"
      >
        <summary className="cursor-pointer font-semibold">
          {m.transcript}
        </summary>
        <ol className="mt-4 space-y-4">
          {text.sentences.map((s, i) => (
            <li key={i}>
              <p lang={text.language} className="text-lg leading-8">
                {s.text}
              </p>
              <details className="mt-1 text-sm text-slate-600">
                <summary className="cursor-pointer">
                  {t("learn.sentenceExplanation")}
                </summary>
                <p className="mt-2 leading-7">
                  {s.explanation[explanationLocale]}
                </p>
              </details>
            </li>
          ))}
        </ol>
      </details>
      <ul className="flex flex-wrap gap-3">
        {text.words.map((w) => {
          const saved = workbench(session).words.includes(w.id);
          return (
            <li
              key={w.id}
              className="rounded-xl border border-slate-200 p-3 text-sm"
            >
              <strong lang={text.language}>{w.word}</strong>
              <p className="my-2">{w.meaning[explanationLocale]}</p>
              <button
                className="ielts-button"
                disabled={saved}
                onClick={() =>
                  commit(
                    withWorkbench(session, {
                      words: [...workbench(session).words, w.id],
                    }),
                  )
                }
              >
                {saved ? m.savedWord : m.saveWord}
              </button>
            </li>
          );
        })}
      </ul>
      <Link
        to="/learn"
        search={{ tab: "review" }}
        className="ielts-button inline-block"
      >
        {m.reviewWords} →
      </Link>
    </div>
  );
}
export function LearningActivity({
  kind,
  target,
  session,
  commit,
  onFinish,
  explanationLocale,
}: {
  kind: ActivityKind;
  target: string;
  session: StudyJournal;
  commit: (s: StudyJournal) => void;
  onFinish: (s: StudyJournal, id: string) => void;
  explanationLocale: StudyLocale;
}) {
  const { locale, learningLanguage, setLearningLanguage } = useI18n(),
    m = workbenchMessages(locale);
  const [choice, setChoice] = React.useState<number | null>(null),
    [checked, setChecked] = React.useState(false);
  const [result, setResult] = React.useState<
    ReturnType<typeof workbench>["rounds"][number] | null
  >(null);
  const w = workbench(session),
    draft = w.draft;
  const language = activityLanguage({ kind, target }),
    lesson = lessonById(target),
    text = gradedText(target);
  const heading = React.useRef<HTMLLegendElement>(null);
  const i = draft
    ? Math.min(draft.answers.length - (checked ? 1 : 0), draft.items.length - 1)
    : 0;
  React.useEffect(() => {
    setChoice(null);
    setChecked(false);
    setResult(null);
  }, [kind, target]);
  React.useEffect(() => {
    heading.current?.focus();
  }, [i, kind, target]);
  if (!language) return <p role="status">{m.empty}</p>;
  if (language !== learningLanguage)
    return (
      <p>
        {m.otherLanguage}{" "}
        <button
          className="ielts-button"
          onClick={() => language && setLearningLanguage(language)}
        >
          {m.switchLanguage}
        </button>
      </p>
    );
  if (draft && (draft.target !== target || draft.kind !== kind))
    return (
      <div role="status">
        <p>{m.draft}</p>
        <Link
          to="/learn"
          search={{ tab: "today", concept: draft.target, activity: draft.kind }}
          className="ielts-button inline-block mt-3"
        >
          {m.continueDraft}
        </Link>
      </div>
    );
  if (result)
    return (
      <section data-testid="activity-result" className="space-y-4">
        <h3 className="text-xl font-bold">
          {m.finish} · {scoreActivity(result)}/{result.items.length}
        </h3>
        {result.items.map((id, n) => {
          const q = activityQuestion(id)!;
          return (
            <div key={id} className="rounded-xl bg-slate-50 p-4">
              <p>{q.prompt}</p>
              <p className="mt-2">
                {m.answer}: {q.choices[q.answer]}
              </p>
              <p className="text-sm">
                {result.answers[n] === q.answer ? "✓" : "×"}
              </p>
            </div>
          );
        })}
        <button className="ielts-button" onClick={() => setResult(null)}>
          {m.next}
        </button>
      </section>
    );
  if (!draft && kind === "retest" && !freshRetest(session, target).length) {
    const p = conceptProfiles(session, language).find((p) => p.id === target)!;
    return (
      <div role="status">
        <p>
          {p.dueAt
            ? `${m.wait} ${new Date(p.dueAt).toLocaleDateString(locale)}`
            : p.lastAt
              ? m.exhausted
              : m.unknown}
        </p>
        <Link
          to="/learn"
          search={{ tab: "profile", concept: target, activity: "practice" }}
          className="ielts-button mt-3 inline-block"
        >
          {m.variants}
        </Link>
      </div>
    );
  }
  if (!draft)
    return (
      <section className="space-y-4" data-testid="activity-intro">
        <h2 className="text-xl font-bold">
          {(lesson?.title ?? text?.title)?.[explanationLocale]}
        </h2>
        {lesson && kind !== "retest" && (
          <div className="rounded-xl bg-brand-50 p-4">
            <p className="leading-8">{lesson.explanation[explanationLocale]}</p>
            <ul className="mt-3 space-y-2">
              {lesson.examples.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {text && (
          <ReadingText
            id={target}
            session={session}
            commit={commit}
            explanationLocale={explanationLocale}
            listening={kind === "listening"}
          />
        )}
        <p className="text-sm">{kind === "retest" ? m.delayed : m[kind]}</p>
        <button
          className="ielts-button"
          onClick={() => {
            const next = startActivity(
              session,
              kind,
              target,
              crypto.randomUUID(),
            );
            commit(next);
          }}
        >
          {m.begin} →
        </button>
      </section>
    );
  const q = activityQuestion(draft.items[i])!,
    feedback =
      kind !== "retest" &&
      (checked || draft.answers.length === draft.items.length);
  const repeated = w.rounds.some((r) => r.items.includes(q.id));
  const complete = () => {
    const next = finishActivity(session);
    const r = workbench(next).rounds.at(-1);
    if (r?.id === draft.id) {
      setResult(r);
      onFinish(next, r.id);
      setChecked(false);
      setChoice(null);
    }
  };
  return (
    <section className="space-y-4" data-testid="learning-activity">
      <h2 className="text-xl font-bold">
        {(lesson?.title ?? text?.title)?.[explanationLocale]}
      </h2>
      {text && (
        <ReadingText
          id={target}
          session={session}
          commit={commit}
          explanationLocale={explanationLocale}
          listening={kind === "listening"}
        />
      )}
      <p className="text-xs text-slate-600">
        {kind === "retest" ? m.delayed : repeated ? m.repeated : m.first} ·{" "}
        {i + 1}/{draft.items.length}
      </p>
      {kind === "retest" && draft.answers.length === draft.items.length ? (
        <button className="ielts-button" onClick={complete}>
          {m.finish} →
        </button>
      ) : (
        <>
          <QuestionFeedback question={"x:" + q.id} />
          <fieldset disabled={feedback}>
            <legend
              ref={heading}
              tabIndex={-1}
              className="mb-4 text-lg leading-8 focus:outline-none"
              lang={language}
            >
              {q.prompt}
            </legend>
            <div className="space-y-3">
              {q.choices.map((c, n) => (
                <label
                  key={n}
                  className={`learning-choice flex min-h-12 items-center gap-3 rounded-xl border p-4 ${feedback && n === q.answer ? "is-correct" : ""}`}
                >
                  <input
                    type="radio"
                    name={"activity-" + q.id}
                    checked={feedback ? draft.answers[i] === n : choice === n}
                    onChange={() => setChoice(n)}
                  />
                  <span lang={language}>{c}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {feedback ? (
            <div role="status" className="rounded-xl bg-brand-50 p-4">
              <p>
                {draft.answers[i] === q.answer ? "✓" : "×"} {m.answer}:{" "}
                {q.choices[q.answer]}
              </p>
              {lesson && (
                <p className="mt-3 text-sm leading-7">
                  {lesson.explanation[explanationLocale]}
                </p>
              )}
              <button
                className="ielts-button mt-4"
                onClick={() => {
                  if (draft.answers.length === draft.items.length) complete();
                  else {
                    setChoice(null);
                    setChecked(false);
                  }
                }}
              >
                {draft.answers.length === draft.items.length
                  ? m.finish
                  : m.nextQuestion}{" "}
                →
              </button>
            </div>
          ) : (
            <button
              className="ielts-button"
              disabled={choice === null}
              onClick={() => {
                if (choice === null) return;
                commit(answerActivity(session, choice));
                setChoice(null);
                if (kind !== "retest") setChecked(true);
              }}
            >
              {kind === "retest" ? m.nextQuestion : m.check} →
            </button>
          )}
        </>
      )}
    </section>
  );
}

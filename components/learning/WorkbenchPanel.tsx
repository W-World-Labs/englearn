import { learningMessages } from "@/lib/learning/messages";
import { QuestionFeedback } from "./QuestionFeedback";
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n/context";
import {
  lessonById,
  LEARNING_LANGUAGES,
  type LearningLanguage,
  type StudyLocale,
} from "@/lib/learning/catalog";
import { gradedText, GRADED_TEXTS } from "@/lib/learning/workbench-content";
import { workbenchMessages } from "@/lib/learning/workbench-messages";
import { planMessages } from "@/lib/learning/plan-messages";
import { studyCard } from "@/lib/learning/cards";
import {
  DAY,
  finishReview,
  rateReview,
  startReview,
} from "@/lib/learning/review";
import {
  activeDaily,
  activityLanguage,
  scoreActivity,
  completeDailyTask,
  conceptProfiles,
  createDaily,
  dailyIndex,
  freshRetest,
  lastStudyAt,
  preference,
  skipDailyTask,
  weeklyReport,
  withWorkbench,
  workbench,
  MAX_ACTIVITY_ROUNDS,
  type ActivityKind,
  type DailyTask,
  type StudyPurpose,
} from "@/lib/learning/workbench";
import type { StudyJournal } from "@/lib/learning/session";
import type { LearningPlan } from "@/lib/learning/plan";
import { XpAward } from "@/components/learn/XpAward";
import { addXp } from "@/lib/gamification/store";
import {
  xpForDailyRead,
  xpForRecallRound,
  xpForScoredRound,
} from "@/lib/gamification/xp";
import { LearningActivity } from "./LearningActivity";
export type WorkbenchTab = "today" | "profile" | "reading" | "week";
export function WorkbenchPanel({
  home = false,
  tab,
  session,
  commit,
  plan,
  explanationLocale,
  concept,
  activity,
}: {
  home?: boolean;
  tab: WorkbenchTab;
  session: StudyJournal | null;
  commit: (s: StudyJournal) => void;
  plan: LearningPlan | null;
  explanationLocale: StudyLocale;
  concept?: string;
  activity?: ActivityKind;
}) {
  const { locale, learningLanguage, setLearningLanguage } = useI18n(),
    m = workbenchMessages(locale),
    lm = learningMessages(locale),
    pm = planMessages(locale),
    language = learningLanguage as LearningLanguage;
  const p = preference(session, language),
    w = workbench(session),
    now = Date.now();
  const [minutes, setMinutes] = React.useState<5 | 15 | 30>(p.minutes),
    [purpose, setPurpose] = React.useState<StudyPurpose>(p.purpose),
    [running, setRunning] = React.useState(false),
    [signal, setSignal] = React.useState("");
  const [newPlan, setNewPlan] = React.useState(false),
    [status, setStatus] = React.useState(""),
    [awardedXp, setAwardedXp] = React.useState<number | null>(null);
  const last = lastStudyAt(session, language),
    recover = last > 0 && now - last >= 7 * DAY;
  React.useEffect(() => {
    setMinutes(recover ? 5 : p.minutes);
    setPurpose(p.purpose);
    setSignal("");
  }, [language, p.minutes, p.purpose]);
  if (!LEARNING_LANGUAGES.includes(language))
    return (
      <p
        role="status"
        className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5 text-sm leading-6 text-slate-600"
      >
        {lm.noCourse}
      </p>
    );
  const d = activeDaily(session, language),
    index = d ? dailyIndex(d) : -1,
    task = d && index >= 0 ? d.tasks[index] : null;
  const title = (t: DailyTask) =>
    (lessonById(t.target)?.title ?? gradedText(t.target)?.title)?.[
      explanationLocale
    ] ?? m.recall;
  const done = (next: StudyJournal, id: string) => {
    const r = workbench(next).rounds.find((r) => r.id === id);
    if (r) {
      const xp = xpForScoredRound(scoreActivity(r));
      addXp(xp);
      setAwardedXp(xp);
      setStatus(`${m.finish}: ${scoreActivity(r)}/${r.items.length}`);
    }
    commit(
      r && d && task?.kind === r.kind && task.target === r.target
        ? completeDailyTask(next, language, id)
        : next,
    );
  };
  const profiles = conceptProfiles(session, language, now).sort(
    (a, b) =>
      Number(b.status === "weak") - Number(a.status === "weak") ||
      Number(!!b.total) - Number(!!a.total),
  );
  const full = w.rounds.length >= MAX_ACTIVITY_ROUNDS || w.days.length >= 500;
  return (
    <section data-testid="workbench" className="space-y-6">
      {!home && <nav
        className="grid grid-cols-4 gap-2"
        aria-label={m.today}
      >
        {(["today", "profile", "reading", "week"] as const).map((t) => (
          <Link
            key={t}
            to="/learn"
            search={{ tab: t }}
            aria-current={tab === t ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center rounded-xl border p-2 text-center text-xs font-semibold sm:p-3 sm:text-sm ${tab === t ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white"}`}
          >
            {m[t]}
          </Link>
        ))}
      </nav>}
      {awardedXp !== null && (
        <XpAward
          amount={awardedXp}
          className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"
        />
      )}
      {status && (
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm">
          {status}
        </p>
      )}
      {full && <p role="alert">{m.full}</p>}
      {concept && activity && session ? (
        <LearningActivity
          key={concept + activity}
          kind={activity}
          target={concept}
          session={session}
          commit={commit}
          onFinish={done}
          explanationLocale={explanationLocale}
        />
      ) : (
        <>
          {tab === "today" && (
            <>
              {w.draft && !running && (
                <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
                  <p>{m.draft}</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link
                      to="/learn"
                      search={{
                        tab: "today",
                        concept: w.draft.target,
                        activity: w.draft.kind,
                      }}
                      className="ielts-button"
                    >
                      {m.continueDraft}
                    </Link>
                    <button
                      className="ielts-button"
                      onClick={() => {
                        if (session && window.confirm(m.cancelConfirm))
                          commit(withWorkbench(session, { draft: null }));
                      }}
                    >
                      {m.cancelDraft}
                    </button>
                  </div>
                </div>
              )}
              {d ? (
                <div
                  className="rounded-2xl border border-brand-200 bg-white p-5"
                  data-testid="daily-plan"
                >
                  <p className="font-semibold">
                    {m.progress}:{" "}
                    {d.tasks.filter((t) => t.at && !t.skipped).length}/
                    {d.tasks.length} · {d.minutes} min
                  </p>
                  <ol className="my-4 space-y-2">
                    {d.tasks.map((t, i) => (
                      <li
                        key={i}
                        className={`rounded-xl p-3 text-sm ${i === index ? "bg-brand-50 text-brand-900" : "bg-slate-50"}`}
                      >
                        {t.skipped ? m.skipped : t.at ? "✓" : i + 1}.{" "}
                        {m[t.kind]} · {title(t)} · ~{t.minutes} min
                      </li>
                    ))}
                  </ol>
                  {!running ? (
                    <button
                      className="ielts-button"
                      disabled={!session}
                      onClick={() => setRunning(true)}
                    >
                      {m.resume} →
                    </button>
                  ) : (
                    session &&
                    task && (
                      <div className="border-t border-slate-200 pt-5">
                        {task.kind === "lesson" ? (
                          <div className="space-y-4" data-testid="daily-lesson">
                            <h3 className="text-xl font-bold">{title(task)}</h3>
                            <p className="leading-8">
                              {
                                lessonById(task.target)!.explanation[
                                  explanationLocale
                                ]
                              }
                            </p>
                            <ul className="space-y-3">
                              {lessonById(task.target)!.examples.map((x, i) => (
                                <li
                                  key={i}
                                  lang={language}
                                  className="rounded-xl bg-slate-50 p-4"
                                >
                                  {x}
                                </li>
                              ))}
                            </ul>
                            <button
                              className="ielts-button"
                              onClick={() => {
                                const xp = xpForDailyRead();
                                addXp(xp);
                                setAwardedXp(xp);
                                commit(
                                  completeDailyTask(session, language),
                                );
                              }}
                            >
                              {m.readDone} →
                            </button>
                          </div>
                        ) : task.kind === "recall" ? (
                          <DailyRecall
                            key={d.id + index}
                            session={session}
                            commit={commit}
                            items={task.items}
                            explanationLocale={explanationLocale}
                            onFinish={(next, id) => {
                              const round = next.reviews?.find(
                                (r) => r.id === id,
                              );
                              if (round) {
                                const xp = xpForRecallRound(round.cards.length);
                                addXp(xp);
                                setAwardedXp(xp);
                              }
                              commit(completeDailyTask(next, language, id));
                            }}
                          />
                        ) : (
                          <LearningActivity
                            key={d.id + index}
                            kind={task.kind}
                            target={task.target}
                            session={session}
                            commit={commit}
                            onFinish={done}
                            explanationLocale={explanationLocale}
                          />
                        )}
                        <button
                          className="mt-5 block min-h-11 text-sm text-slate-600 underline"
                          onClick={() => {
                            commit(skipDailyTask(session, language));
                            setStatus(m.skipped);
                          }}
                        >
                          {m.skip}
                        </button>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <>
                  {!newPlan &&
                  w.days.some(
                    (x) =>
                      x.language === language &&
                      x.completedAt &&
                      new Date(x.completedAt).toDateString() ===
                        new Date(now).toDateString(),
                  ) ? (
                    <div
                      className="rounded-2xl bg-emerald-50 p-5"
                      data-testid="daily-complete"
                    >
                      <h3 className="text-xl font-semibold">{m.done}</h3>
                      <Link
                        className="ielts-button mt-4 inline-block"
                        to="/learn"
                        search={{ tab: "week" }}
                      >
                        {m.week}
                      </Link>
                      <button
                        className="ielts-button ml-3"
                        onClick={() => setNewPlan(true)}
                      >
                        {m.another}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      {recover && (
                        <p className="mb-4 text-sm leading-7">{m.recovery}</p>
                      )}
                      <label className="block text-sm font-semibold">
                        {m.purpose}
                        <select
                          className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 px-3"
                          value={purpose}
                          onChange={(e) =>
                            setPurpose(e.target.value as StudyPurpose)
                          }
                        >
                          {(["general", "travel", "work", "exam"] as const).map(
                            (v) => (
                              <option key={v} value={v}>
                                {m[v]}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      <fieldset className="my-5">
                        <legend className="mb-2 text-sm font-semibold">
                          {m.minutes}
                        </legend>
                        <div className="flex flex-wrap gap-3">
                          {([5, 15, 30] as const).map((n) => (
                            <button
                              key={n}
                              className="ielts-button"
                              aria-pressed={n === minutes}
                              onClick={() => setMinutes(n)}
                            >
                              {n} min
                            </button>
                          ))}
                        </div>
                      </fieldset>
                      <button
                        className="ielts-button"
                        disabled={!session || !plan || full}
                        onClick={() => {
                          if (session && plan) {
                            commit(
                              createDaily(
                                session,
                                plan,
                                minutes,
                                purpose,
                                crypto.randomUUID(),
                              ),
                            );
                            setRunning(true);
                            setNewPlan(false);
                          }
                        }}
                      >
                        {m.start} →
                      </button>
                      {!plan && (
                        <p role="status" className="mt-3 text-sm">
                          {m.blocked}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {tab === "profile" && (
            <>
              <h2 className="text-2xl font-bold">{m.profile}</h2>
              <p className="text-sm leading-7 text-slate-600">
                {m.lowEvidence} {m.countNote}
              </p>
              {signal && <p role="status">{m.feedbackSaved}</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                {profiles.map((p) => (
                  <article
                    key={p.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5"
                    data-testid="concept-profile"
                    data-concept={p.id}
                    data-evidence={p.status}
                  >
                    <h3 className="font-semibold">
                      {lessonById(p.id)!.title[explanationLocale]}
                    </h3>
                    <p className="my-3 text-sm text-brand-800">{m[p.status]}</p>
                    <details>
                      <summary className="cursor-pointer text-sm">
                        {m.evidence}
                      </summary>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <dt>{m.firstScore}</dt>
                        <dd>
                          {p.firstCorrect}/{p.firstTotal}
                        </dd>
                        <dt>{m.repeatScore}</dt>
                        <dd>
                          {p.repeatCorrect}/{p.repeatTotal}
                        </dd>
                        <dt>{m.delayedScore}</dt>
                        <dd>
                          {p.delayedTotal
                            ? `${p.delayedCorrect}/${p.delayedTotal}`
                            : "—"}
                        </dd>
                        <dt>{m.dates}</dt>
                        <dd>{p.dates}</dd>
                        <dt>{m.last}</dt>
                        <dd>
                          {p.lastAt
                            ? new Date(p.lastAt).toLocaleDateString(locale)
                            : "—"}
                        </dd>
                      </dl>
                    </details>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        to="/learn"
                        search={{ lesson: p.id }}
                        className="ielts-button"
                      >
                        {m.choose}
                      </Link>
                      <Link
                        to="/learn"
                        search={{
                          tab: "profile",
                          concept: p.id,
                          activity: "practice",
                        }}
                        className="ielts-button"
                      >
                        {m.variants}
                      </Link>
                    </div>
                    {p.dueAt &&
                      (p.dueAt <= now ? (
                        <Link
                          className="ielts-button mt-3 inline-block"
                          to="/learn"
                          search={{
                            tab: "profile",
                            concept: p.id,
                            activity: "retest",
                          }}
                        >
                          {m.due} →
                        </Link>
                      ) : (
                        <p className="mt-3 text-xs leading-6">
                          {m.wait}:{" "}
                          {new Date(p.dueAt).toLocaleDateString(locale)}
                        </p>
                      ))}
                    {!p.dueAt && p.delayedTotal > 0 && (
                      <p className="mt-3 text-xs leading-6">{m.exhausted}</p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-3">
                      {(["easy", "hard"] as const).map((value) => (
                        <button
                          key={value}
                          aria-pressed={p.signal === value}
                          className="ielts-button"
                          disabled={!session || w.difficulty.length >= 2000}
                          onClick={() => {
                            if (session) {
                              commit(
                                withWorkbench(session, {
                                  difficulty: [
                                    ...w.difficulty,
                                    {
                                      id: crypto.randomUUID(),
                                      lessonId: p.id,
                                      at: Date.now(),
                                      value,
                                    },
                                  ],
                                }),
                              );
                              setSignal(p.id);
                            }
                          }}
                        >
                          {m[value]}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          {tab === "reading" && (
            <>
              <h2 className="text-2xl font-bold">{m.reading}</h2>
              <p className="text-sm text-slate-600">{m.countNote}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {GRADED_TEXTS.filter((t) => t.language === language)
                  .sort(
                    (a, b) =>
                      Number(b.stage === plan?.stage) -
                      Number(a.stage === plan?.stage),
                  )
                  .map((t) => (
                    <article
                      key={t.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5"
                    >
                      <p className="mb-2 text-xs text-brand-700">
                        {lm[t.stage]}
                        {t.stage === plan?.stage
                          ? " · " +
                            pm.recommended
                          : ""}
                      </p>
                      <h3 className="text-lg font-semibold">
                        {t.title[explanationLocale]}
                      </h3>
                      <p className="my-3 text-sm leading-7" lang={language}>
                        {t.sentences[0].text}
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {(["reading", "listening"] as const).map((kind) => (
                          <Link
                            key={kind}
                            className="ielts-button"
                            to="/learn"
                            search={{
                              tab: "reading",
                              concept: t.id,
                              activity: kind,
                            }}
                          >
                            {kind === "reading" ? m.read : m.listen} →
                          </Link>
                        ))}
                      </div>
                    </article>
                  ))}
              </div>
            </>
          )}
          {tab === "week" && (
            <Weekly
              session={session}
              language={language}
              explanationLocale={explanationLocale}
            />
          )}
        </>
      )}
    </section>
  );
}
function DailyRecall({
  session,
  commit,
  items,
  explanationLocale,
  onFinish,
}: {
  session: StudyJournal;
  commit: (s: StudyJournal) => void;
  items: string[];
  explanationLocale: StudyLocale;
  onFinish: (s: StudyJournal, id: string) => void;
}) {
  const { locale } = useI18n(),
    m = workbenchMessages(locale),
    [revealed, setRevealed] = React.useState(false),
    d = session.reviewDraft;
  if (d && JSON.stringify(d.cards) !== JSON.stringify(items))
    return (
      <div>
        <p>{m.draft}</p>
        <Link
          className="ielts-button mt-3 inline-block"
          to="/learn"
          search={{ tab: "review" }}
        >
          {m.continueDraft}
        </Link>
      </div>
    );
  if (!d)
    return (
      <button
        className="ielts-button"
        onClick={() => commit(startReview(session, items, crypto.randomUUID()))}
      >
        {m.recall} →
      </button>
    );
  if (d.ratings.length === d.cards.length)
    return (
      <button
        className="ielts-button"
        onClick={() => onFinish(finishReview(session), d.id)}
      >
        {m.finish}
      </button>
    );
  const card = studyCard(d.cards[d.ratings.length])!;
  return (
    <div data-testid="daily-recall" className="space-y-4">
      <p className="text-xs">
        {d.ratings.length + 1}/{d.cards.length}
      </p>
      <h3 className="text-xl leading-8" lang={card.language}>
        {card.front}
      </h3>
      <QuestionFeedback question={card.id} />
      {revealed ? (
        <>
          <p className="rounded-xl bg-brand-50 p-4">
            {card.answer[explanationLocale]}
          </p>
          <div className="flex flex-wrap gap-3">
            {([0, 1, 2] as const).map((r) => (
              <button
                key={r}
                className="ielts-button"
                onClick={() => {
                  const next = rateReview(session, r);
                  setRevealed(false);
                  if (next.reviewDraft?.ratings.length === items.length)
                    onFinish(finishReview(next), d.id);
                  else commit(next);
                }}
              >
                {[m.again, m.help, m.good][r]}
              </button>
            ))}
          </div>
        </>
      ) : (
        <button className="ielts-button" onClick={() => setRevealed(true)}>
          {m.reveal}
        </button>
      )}
    </div>
  );
}
function Weekly({
  session,
  language,
  explanationLocale,
}: {
  session: StudyJournal | null;
  language: LearningLanguage;
  explanationLocale: StudyLocale;
}) {
  const { locale } = useI18n(),
    m = workbenchMessages(locale),
    r = weeklyReport(session, language);
  return (
    <section className="space-y-5" data-testid="weekly-report">
      <h2 className="text-2xl font-bold">{m.weekly}</h2>
      <div className="grid grid-cols-2 gap-4">
        <Metric title={m.plansStarted} value={r.started} />
        <Metric title={m.plansCompleted} value={r.completed} />
        <Metric
          title={m.delayedScore}
          value={r.delayedTotal ? `${r.delayedCorrect}/${r.delayedTotal}` : "—"}
        />
        <Metric title={m.signals} value={r.difficulty} />
        <Metric
          title={m.firstScore}
          value={r.firstTotal ? `${r.firstCorrect}/${r.firstTotal}` : "—"}
        />
        <Metric
          title={m.repeatScore}
          value={r.repeatTotal ? `${r.repeatCorrect}/${r.repeatTotal}` : "—"}
        />
        <Metric title={m.skipped} value={r.skipped} />
      </div>
      {!r.started && !r.firstTotal && !r.repeatTotal && (
        <div>
          <p className="text-sm">{m.noData}</p>
          <Link
            to="/learn"
            search={{ tab: "today" }}
            className="ielts-button mt-3 inline-block"
          >
            {m.start} →
          </Link>
        </div>
      )}
      {!r.delayedTotal && <p className="text-sm">{m.noDelayed}</p>}
      {[
        { title: m.improved, ids: r.improved },
        { title: m.stillWeak, ids: r.needsWork },
      ].map((group) => (
        <div key={group.title}>
          <h3 className="font-semibold">
            {group.title} · {group.ids.length}
          </h3>
          <ul className="mt-3 space-y-2">
            {group.ids.map((id) => (
              <li key={id}>
                <Link
                  to="/learn"
                  search={{ tab: "profile", concept: id, activity: "practice" }}
                  className="text-brand-800 underline"
                >
                  {lessonById(id)!.title[explanationLocale]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
function Metric({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs leading-6 text-slate-600">{title}</p>
      <strong className="mt-2 block text-2xl">{value}</strong>
    </div>
  );
}

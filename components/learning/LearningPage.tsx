import { QuestionFeedback } from "@/components/learning/QuestionFeedback";
import { PreparationPanel } from "@/components/ielts/PreparationPanel";
import * as React from "react";
import { WorkbenchPanel, type WorkbenchTab } from "./WorkbenchPanel";
import { workbenchMessages } from "@/lib/learning/workbench-messages";
import type { ActivityKind } from "@/lib/learning/workbench";
import { learningEvidence } from "@/lib/learning/plan";
import type { LearningLanguage } from "@/lib/learning/catalog";
import { PersonalPlan } from "./PersonalPlan";
import { useAccountPlan } from "@/lib/learning/useAccountPlan";
import { arrangeLearning } from "@/lib/learning/plan";
import { planMessages } from "@/lib/learning/plan-messages";
import { BookReader } from "./BookReader";
import { Link } from "@tanstack/react-router";
import { RecallPanel } from "./RecallPanel";
import { MaterialBuilder } from "./MaterialBuilder";
import { PracticeHistory } from "./PracticeHistory";
import { reinforcementMessages } from "@/lib/learning/reinforcement-messages";
import { PageShell } from "@/components/layout/PageShell";
import { CoursePicker } from "@/components/learn/CoursePicker";
import { LanguageSwitcher } from "@/components/learn/LanguageSwitcher";
import { HomeVocabularyFallback } from "@/components/home/HomeLower";
import { isCoursePlayable } from "@/lib/i18n/languages";
import { getStoredSessionId } from "@/lib/client/active-session";
import { ExamSaveStatus } from "@/components/exams/ExamSaveStatus";
import { useI18n } from "@/lib/i18n/context";
import { studyTextLocale } from "@/lib/i18n/localized";
import { useAuth } from "@/lib/client/auth";
import { useExamCloud } from "@/lib/exams/useExamCloud";
import { examMessages } from "@/lib/exams/messages";
import {
  BOOK,
  COURSE_CONTENT,
  STAGES,
  courseLessons,
  lessonById,
  type Lesson,
  type Stage,
  type StudyLocale,
} from "@/lib/learning/catalog";
import {
  answerLesson,
  createJournal,
  dueLessons,
  dueReviewCount,
  finishLesson,
  lessonCardStatus,
  MAX_STUDY_EVENTS,
  nextLessonSuggestion,
  parseJournal,
  scoreLesson,
  startLesson,
  studyProgress,
  type StudyJournal,
} from "@/lib/learning/session";
import { lessonExamTargets } from "@/lib/learning/exam-links";
import { learningMessages } from "@/lib/learning/messages";
import { XpAward } from "@/components/learn/XpAward";
import { addXp } from "@/lib/gamification/store";
import { xpForScoredRound } from "@/lib/gamification/xp";
import { MAX_JOURNAL_BYTES } from "@/lib/learning/review";

export type LearningTab =
  | "ielts"
  | "today"
  | "profile"
  | "reading"
  | "week"
  | "courses"
  | "review"
  | "history"
  | "library"
  | "materials";
export function LearningPage({
  home = false,
  lessonId,
  wordIds,
  tab = "today",
  concept,
  activity,
}: {
  home?: boolean;
  lessonId?: string;
  wordIds?: string;
  tab?: LearningTab;
  concept?: string;
  activity?: ActivityKind;
}) {
  const auth = useAuth(),
    { locale, t } = useI18n(),
    e = examMessages(locale);
  if (auth.loading)
    return (
      <PageShell active={home ? "home" : "learn"} title={home ? t("ieltsPrep.navtoday") : undefined}>
        <p role="status" className="mt-8">
          {e.preparing}
        </p>
      </PageShell>
    );
  if (auth.error)
    return (
      <PageShell active={home ? "home" : "learn"} title={home ? t("ieltsPrep.navtoday") : undefined}>
        <p role="alert" className="mt-8">
          {e.authError}
        </p>
        <button
          className="ielts-button mt-3"
          onClick={() => void auth.refresh()}
        >
          {e.retry}
        </button>
        <button className="ielts-button ml-3 mt-3" onClick={() => void auth.logout()}>{e.freeUse}</button>
      </PageShell>
    );
  const owner = auth.user ? `user:${auth.user.sub}` : "guest";
  return (
    <Workspace
      home={home}
      key={owner}
      concept={concept}
      activity={activity}
      owner={owner}
      lessonId={lessonId}
      wordIds={wordIds}
      tab={tab}
    />
  );
}
function download(raw: string, name: string) {
  const url = URL.createObjectURL(
      new Blob([raw], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Workspace({
  home,
  concept,
  activity,
  owner,
  wordIds,
  lessonId,
  tab,
}: {
  home: boolean;
  owner: string;
  concept?: string;
  activity?: ActivityKind;
  lessonId?: string;
  wordIds?: string;
  tab: LearningTab;
}) {
  const { locale, learningLanguage, t } = useI18n(),
    m = learningMessages(locale),
    reinforcement = reinforcementMessages(locale),
    e = examMessages(locale),
    auth = useAuth();
  const accountPlan = useAccountPlan(auth.user?.sub, learningLanguage);
  const pm = planMessages(locale),
    wm = workbenchMessages(locale);
  const isWorkbench = ["today", "profile", "reading", "week"].includes(tab);
  const prefix = `lingolearn:learning:${encodeURIComponent(owner)}`;
  const [session, setSession] = React.useState<StudyJournal | null>(null),
    current = React.useRef<StudyJournal | null>(null);
  const [loaded, setLoaded] = React.useState(false),
    [storageError, setStorageError] = React.useState(false),
    [invalid, setInvalid] = React.useState<string | null>(null);
  const [hasAssessment, setHasAssessment] = React.useState(false);
  const [hasLocalBackup, setHasLocalBackup] = React.useState(false);
  const [importError, setImportError] = React.useState("");
  React.useEffect(() => {
    if (home) setHasAssessment(Boolean(getStoredSessionId()));
  }, [home]);
  const [stage, setStage] = React.useState<Stage | "all" | "auto">(
      auth.user ? "auto" : "all",
    ),
    [query, setQuery] = React.useState("");
  const [explanationLocale, setExplanationLocale] = React.useState<StudyLocale>(
    studyTextLocale(locale),
  );
  const [choice, setChoice] = React.useState<number | null>(null),
    [feedback, setFeedback] = React.useState(false),
    [finished, setFinished] = React.useState(false),
    [xpEarned, setXpEarned] = React.useState<number | null>(null);
  const questionHeading = React.useRef<HTMLLegendElement>(null);
  const heading = React.useRef<HTMLHeadingElement>(null),
    [now, setNow] = React.useState(Date.now);
  const commit = React.useCallback(
    (next: StudyJournal) => {
      current.current = next;
      setSession(next);
      try {
        localStorage.setItem(prefix, JSON.stringify(next));
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    },
    [prefix],
  );
  const cloud = useExamCloud<StudyJournal, { id: string }>({
    prefix,
    endpoint: "/api/learning/journal",
    account: auth.user?.sub ?? null,
    loaded,
    session,
    current,
    commit,
  });
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(prefix),
        saved = parseJournal(raw);
      if (saved) commit(saved);
      else if (raw) setInvalid(raw);
      setHasLocalBackup(Boolean(parseJournal(localStorage.getItem(`${prefix}:before-import`))));
    } catch {
      setStorageError(true);
    }
    setLoaded(true);
  }, [prefix, commit]);
  React.useEffect(() => {
    if (
      loaded &&
      !current.current &&
      !invalid &&
      (!auth.user || cloud.status === "saved")
    )
      commit(createJournal());
  }, [loaded, invalid, auth.user, cloud.status, commit]);
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);
  React.useEffect(() => {
    setChoice(null);
    setFeedback(false);
    setFinished(false);
    setXpEarned(null);
    heading.current?.focus({ preventScroll: true });
  }, [lessonId, tab]);
  const progress = React.useMemo(() => studyProgress(session), [session]);
  const lessons = courseLessons(learningLanguage),
    due = dueLessons(session, learningLanguage, now),
    dueTotal = dueReviewCount(session, learningLanguage, now);
  const active = lessonId ? lessonById(lessonId) : null;
  const draft =
    active && session?.draft?.lessonId === active.id ? session.draft : null;
  const practiceIndex = draft
    ? Math.min(
        draft.answers.length - (feedback ? 1 : 0),
        active!.questions.length - 1,
      )
    : 0;
  const question = active?.questions[practiceIndex];
  const showFeedback =
    !!draft && (feedback || draft.answers.length === active!.questions.length);
  React.useEffect(() => {
    if (draft && !showFeedback)
      questionHeading.current?.focus({ preventScroll: true });
  }, [practiceIndex, showFeedback, !!draft]);
  const latest = active
    ? session?.events.filter((ev) => ev.lessonId === active.id).at(-1)
    : null;
  const nextSuggestion =
      active && finished
        ? nextLessonSuggestion(session, learningLanguage, active.id, now)
        : null,
    examTargets = active ? lessonExamTargets(active.id) : [];
  const txt = (text: { en: string; zh: string }) => text[explanationLocale];
  const plan =
    accountPlan.status === "ready" && accountPlan.data
      ? session
        ? arrangeLearning(accountPlan.data.evidence, session, now)
        : accountPlan.data.plan
      : null;
  const effectiveStage = stage === "auto" ? (plan?.stage ?? "all") : stage;
  React.useEffect(() => {
    setStage(auth.user ? "auto" : "all");
    setQuery("");
  }, [learningLanguage, owner]);
  const visibleLessons = lessons.filter(
    (l) =>
      (effectiveStage === "all" || l.stage === effectiveStage) &&
      `${l.title.en} ${l.title.zh} ${l.examples.join(" ")}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const full = (session?.events.length ?? 0) >= MAX_STUDY_EVENTS;
  const backup = () =>
    download(
      current.current
        ? JSON.stringify(current.current, null, 2)
        : (invalid ?? "null"),
      "lingolearn-learning-backup.json",
    );
  function useLocalBackup(next: StudyJournal) {
    if (auth.user || !current.current || !window.confirm(m.importConfirm)) return;
    try {
      localStorage.setItem(`${prefix}:before-import`, JSON.stringify(current.current));
      localStorage.setItem(prefix, JSON.stringify(next));
      window.location.reload();
    } catch {
      setImportError(e.storageError);
    }
  }
  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || auth.user) return;
    setImportError("");
    try {
      const next = file.size <= MAX_JOURNAL_BYTES ? parseJournal(await file.text()) : null;
      if (!next) setImportError(m.importInvalid);
      else useLocalBackup(next);
    } catch {
      setImportError(m.importInvalid);
    }
  }
  function restoreLocalBackup() {
    try {
      const previous = parseJournal(localStorage.getItem(`${prefix}:before-import`));
      if (previous) useLocalBackup(previous);
      else setImportError(m.importInvalid);
    } catch {
      setImportError(e.storageError);
    }
  }
  function begin(lesson: Lesson) {
    const s = current.current;
    if (!s || full) return;
    if (
      s.draft?.lessonId !== lesson.id &&
      s.draft &&
      !window.confirm(m.replace)
    )
      return;
    if (s.draft?.lessonId !== lesson.id) commit(startLesson(s, lesson.id));
    setFinished(false);
    setChoice(null);
    setFeedback(false);
  }
  function check() {
    const s = current.current;
    if (s && choice !== null) {
      commit(answerLesson(s, choice));
      setFeedback(true);
      setChoice(null);
    }
  }
  function finish() {
    const s = current.current;
    if (!s || !active) return;
    const next = finishLesson(s, crypto.randomUUID());
    if (next !== s) {
      const xp = xpForScoredRound(
        scoreLesson(active, next.events[next.events.length - 1].answers),
      );
      addXp(xp);
      setXpEarned(xp);
      commit(next);
      setFinished(true);
      setFeedback(false);
      setNow(Date.now());
    }
  }
  function bookPage(value: number) {
    const s = current.current;
    if (s && Number.isInteger(value) && value >= 1 && value <= BOOK.pages)
      commit({ ...s, bookPage: value });
  }
  function lessonEntry(l: Lesson) {
    const p = progress[l.id],
      status = lessonCardStatus(p, session?.draft?.lessonId, l.id, now),
      label =
        status === "draft"
          ? m.statusDraft
          : status === "notStarted"
            ? m.notStarted
            : status === "due"
              ? m.due
              : status === "needsPractice"
                ? m.needsPractice
                : m.learned;
    return (
      <Link
        key={l.id}
        to="/learn"
        search={{ lesson: l.id }}
        data-testid="learning-lesson"
        className="catalog-entry"
      >
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-slate-900">{txt(l.title)}</h3>
          {status === "draft" && session?.draft ? (
            <p className="mt-1 text-xs text-slate-600">
              {m.question} {session.draft.answers.length}/{l.questions.length}
            </p>
          ) : p && (
            <p className="mt-1 text-xs text-slate-600">
              {m.latest}: {p.correct}/{p.total} · {m.nextReview}:{" "}
              {new Date(p.dueAt).toLocaleDateString(locale)}
            </p>
          )}
        </div>
        {status !== "notStarted" && (
          <span className={`text-xs ${status === "draft" || status === "due" ? "text-amber-900" : "text-slate-600"}`}>
            {label}
          </span>
        )}
        <span aria-hidden="true" className="text-slate-400">→</span>
      </Link>
    );
  }
  const pageTitle = home ? wm.today : active ? txt(active.title) : tab === "ielts" ? t("ieltsPrep.title") : isWorkbench ? wm[tab as WorkbenchTab] : tab === "courses" ? m.courses : m.title;
  return (
    <PageShell active={home ? "home" : "learn"} title={pageTitle} wide>
      <div className="mt-1 overflow-hidden rounded-xl">
        <ExamSaveStatus
          status={cloud.status}
          compact={home || tab === "ielts"}
          onRetry={cloud.retry}
          onLogin={() => auth.login(home ? "/" : "/learn")}
          onBackup={backup}
          onUseServer={cloud.useServer}
          onGuest={() => void auth.logout()}
        />
      </div>
      {!auth.user && !isWorkbench && tab !== "ielts" && (
        <p className="mt-3 text-sm text-slate-600">{m.guestHint}</p>
      )}
      {storageError && (
        <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-4 text-sm">
          {e.storageError}
        </p>
      )}
      {invalid && !session && (
        <div role="alert" className="mt-4 rounded-xl bg-amber-50 p-4">
          <p>{m.invalid}</p>
          <button className="ielts-button mt-3" onClick={backup}>
            {m.backup}
          </button>
          <button
            className="ielts-button mt-3"
            onClick={() => {
              if (window.confirm(m.resetConfirm)) {
                setInvalid(null);
                commit(createJournal());
              }
            }}
          >
            {m.reset}
          </button>
        </div>
      )}
      {full && (
        <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-4">
          {m.full}{" "}
          <button className="underline" onClick={backup}>
            {m.backup}
          </button>
        </p>
      )}
      <h1 ref={heading} tabIndex={-1} className="sr-only">{pageTitle}</h1>
      {home && hasAssessment && <Link to="/test" className="my-3 flex min-h-11 items-center justify-between rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm font-medium text-brand-900">{t("home.resumeAssessment")}<span aria-hidden="true">→</span></Link>}
      {active && <p className="my-2 text-xs text-slate-500">{m[active.stage]} · {active.language.toUpperCase()}</p>}
      {!home && tab !== "ielts" && <nav
        aria-label={m.name}
        className={`mb-4 flex gap-2 overflow-x-auto pb-2 whitespace-nowrap`}
      >
        {(
          [
            "today",
            "ielts",
            "courses",
            "review",
            "history",
            "materials",
            "library",
          ] as const
        ).map((t) => (
          <Link
            key={t}
            to="/learn"
            search={{ tab: t }}
            aria-current={
              !active && (tab === t || (t === "today" && isWorkbench))
                ? "page"
                : undefined
            }
            className={`shrink-0 rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 ${!active && (tab === t || (t === "today" && isWorkbench)) ? "bg-brand-700 text-white" : "bg-white text-slate-700 ring-1 ring-stone-200"}`}
          >
            {t === "ielts"
              ? "IELTS"
              : t === "today"
              ? wm.today
              : t === "materials"
                ? reinforcement.materials
                : m[t]}
            {t === "review" && dueTotal > 0 ? ` (${dueTotal})` : ""}
          </Link>
        ))}
      </nav>}
      {!home && tab !== "ielts" && tab !== "library" && tab !== "materials" && (
        <details className="mb-4 rounded-xl border border-stone-200 bg-white px-4 py-1">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-medium text-slate-600">{m.settings}</summary>
          <div className="flex flex-wrap items-center gap-3 pb-3 pt-2">
          <CoursePicker compact />
          <label className="text-sm font-medium">
            {m.explanations}
            <select
              className="ml-2 min-h-11 rounded-lg border border-slate-300 bg-white px-3"
              value={explanationLocale}
              onChange={(ev) =>
                setExplanationLocale(ev.target.value as StudyLocale)
              }
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </label>
          {!isWorkbench && (
            <p className="text-xs text-slate-600">{m.explanationHint}</p>
          )}
          </div>
        </details>
      )}
      {lessonId && !active && (
        <p role="alert">
          {m.noMatches}{" "}
          <Link to="/learn" className="underline">
            {m.back}
          </Link>
        </p>
      )}
      {active && (
        <Link
          to="/learn"
          search={{ tab: "profile", concept: active.id, activity: "practice" }}
          className="ielts-button mb-4 inline-block"
        >
          {wm.variants} →
        </Link>
      )}
      {active && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <p className="text-base leading-8" lang={explanationLocale}>
              {txt(active.explanation)}
            </p>
            <h2 className="mt-6 font-semibold">{m.examples}</h2>
            <ul className="mt-3 space-y-3" lang={active.language}>
              {active.examples.map((line) => (
                <li key={line} className="rounded-xl bg-brand-50 p-4 text-lg">
                  {line}
                </li>
              ))}
            </ul>
            {!draft && !finished && (
              <button
                disabled={!session || full}
                className="ielts-button mt-6 min-h-12 disabled:opacity-50"
                onClick={() => begin(active)}
              >
                {m.practice} →
              </button>
            )}
          </section>
          <section
            className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
            aria-label={m.practice}
          >
            {draft && question ? (
              <>
                <p className="text-sm text-slate-600">
                  {m.question} {practiceIndex + 1} / {active.questions.length}
                </p>
                <QuestionFeedback
                  question={`g:${active.id}:${practiceIndex}`}
                />
                <fieldset disabled={showFeedback} className="mt-4 min-w-0">
                  <legend
                    tabIndex={-1}
                    ref={questionHeading}
                    className="mb-4 text-lg font-semibold focus:outline-none"
                    lang={active.language}
                  >
                    {question.prompt}
                  </legend>
                  <div className="space-y-3">
                    {question.choices.map((option, i) => (
                      <label
                        key={i}
                        className={`learning-choice flex min-h-12 items-start gap-3 rounded-xl border p-3 ${showFeedback && i === question.answer ? "is-correct" : ""}`}
                      >
                        <input
                          type="radio"
                          name="learning-answer"
                          value={i}
                          checked={
                            showFeedback
                              ? draft.answers[practiceIndex] === i
                              : choice === i
                          }
                          onChange={() => setChoice(i)}
                          className="mt-1"
                        />
                        <span lang={active.language}>{option}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {showFeedback ? (
                  <div
                    role="status"
                    className="mt-5 rounded-xl bg-slate-50 p-4"
                  >
                    <h2 className="font-semibold">
                      {draft.answers[practiceIndex] === question.answer
                        ? m.correct
                        : m.incorrect}
                    </h2>
                    <p className="mt-2">
                      {m.answer}:{" "}
                      <strong lang={active.language}>
                        {question.choices[question.answer]}
                      </strong>
                    </p>
                    <p className="mt-3 text-sm font-semibold">{m.rule}</p>
                    <p
                      className="mt-1 text-sm leading-7"
                      lang={explanationLocale}
                    >
                      {txt(active.explanation)}
                    </p>
                    <button
                      className="ielts-button mt-4"
                      onClick={() => {
                        if (draft.answers.length === active.questions.length)
                          finish();
                        else {
                          setFeedback(false);
                          setChoice(null);
                        }
                      }}
                    >
                      {draft.answers.length === active.questions.length
                        ? m.finish
                        : m.next}{" "}
                      →
                    </button>
                  </div>
                ) : (
                  <button
                    className="ielts-button mt-5 disabled:opacity-50"
                    disabled={choice === null}
                    onClick={check}
                  >
                    {m.check}
                  </button>
                )}
              </>
            ) : finished && latest ? (
              <>
                <h2 className="text-xl font-semibold">{m.result}</h2>
                <p className="mt-3 text-3xl font-bold">
                  {scoreLesson(active, latest.answers)} /{" "}
                  {active.questions.length}
                </p>
                {xpEarned !== null && (
                  <XpAward
                    amount={xpEarned}
                    className="mt-2 text-sm text-emerald-800"
                  />
                )}
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {m.reviewSoon}
                </p>
                <p className="mt-3 text-sm font-semibold">
                  {m.nextReview}:{" "}
                  {new Date(progress[active.id].dueAt).toLocaleDateString(
                    locale,
                  )}
                </p>
                <h3 className="mt-5 font-semibold">{m.missed}</h3>
                <ol className="mt-3 space-y-3">
                  {active.questions.map((q, i) => (
                    <li key={i} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <p lang={active.language}>{q.prompt}</p>
                      <p className="mt-2">
                        {latest.answers[i] === q.answer ? "✓" : "↻"}{" "}
                        <span lang={active.language}>
                          {q.choices[latest.answers[i]]}
                        </span>
                      </p>
                      <p>
                        {m.answer}:{" "}
                        <span lang={active.language}>
                          {q.choices[q.answer]}
                        </span>
                      </p>
                    </li>
                  ))}
                </ol>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    className="ielts-button"
                    onClick={() => begin(active)}
                  >
                    {m.restart}
                  </button>
                  <Link to="/learn" className="ielts-button">
                    {m.back}
                  </Link>
                </div>
                {(nextSuggestion || examTargets.length > 0) && (
                  <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/50 p-5">
                    <h3 className="font-semibold text-slate-900">
                      {m.recommend}
                    </h3>
                    <div className="mt-4 grid gap-4">
                      {nextSuggestion && lessonEntry(nextSuggestion)}
                      {examTargets.map((fam) => (
                        <Link
                          key={fam}
                          to={`/${fam}`}
                          className="ielts-button inline-block text-center"
                        >
                          {fam.toUpperCase()} · {e.centre} →
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-sm leading-7 text-slate-600">{m.intro}</p>
                {progress[active.id] && (
                  <p className="mt-3 text-sm">
                    {m.latest}: {progress[active.id].correct}/
                    {progress[active.id].total} · {m.nextReview}:{" "}
                    {new Date(progress[active.id].dueAt).toLocaleDateString(
                      locale,
                    )}
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      )}
      {!lessonId &&
        !isWorkbench &&
        tab !== "ielts" &&
        tab !== "library" &&
        tab !== "materials" && (
          <>

            <div
              className="my-5 flex flex-wrap gap-4 text-sm"
              data-testid="learning-progress"
            >
              <span>
                {m.learned}:{" "}
                <strong>
                  {lessons.filter((l) => progress[l.id]).length}/
                  {lessons.length}
                </strong>
              </span>
              <span>
                {m.due}: <strong>{due.length}</strong>
              </span>
              <span>
                {m.completed}:{" "}
                <strong>
                  {session?.events.filter(
                    (ev) =>
                      lessonById(ev.lessonId)?.language === learningLanguage,
                  ).length ?? 0}
                </strong>
              </span>
            </div>
            {session?.draft && (
              <Link
                to="/learn"
                search={{ lesson: session.draft.lessonId }}
                className="mb-5 block rounded-xl bg-brand-50 p-4 font-semibold text-brand-900"
              >
                {m.resume}: {txt(lessonById(session.draft.lessonId)!.title)} →
              </Link>
            )}
            {tab === "review" && (
              <>
                <RecallPanel
                  session={session}
                  commit={commit}
                  explanationLocale={explanationLocale}
                  wordIds={wordIds}
                />
                <h2 className="mb-4 font-semibold">
                  {reinforcement.unitReview}
                </h2>
              </>
            )}
            {tab === "courses" ? (
              lessons.length === 0 ? (
                <p
                  role="status"
                  className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5 text-sm leading-6 text-slate-600"
                >
                  {m.noCourse}
                </p>
              ) : (
              <>
                {auth.user && lessons.length > 0 && (
                  <PersonalPlan
                    plan={plan}
                    evidence={accountPlan.data?.evidence ?? null}
                    status={accountPlan.status}
                    retry={accountPlan.retry}
                    explanationLocale={explanationLocale}
                  />
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  {auth.user && (
                    <button
                      aria-pressed={stage === "auto"}
                      onClick={() => setStage("auto")}
                      className={`min-h-11 rounded-xl border px-4 text-sm ${stage === "auto" ? "border-brand-500 bg-brand-50 text-brand-900" : "border-slate-200 bg-white"}`}
                    >
                      {pm.auto}
                    </button>
                  )}
                  {(["all", ...STAGES] as const).map((s) => (
                    <button
                      key={s}
                      aria-pressed={stage === s}
                      onClick={() => setStage(s)}
                      className={`min-h-11 rounded-xl border px-4 text-sm ${stage === s ? "border-brand-500 bg-brand-50 text-brand-900" : "border-slate-200 bg-white"}`}
                    >
                      {m[s]}
                    </button>
                  ))}
                </div>
                <label className="mt-5 block text-sm font-medium">
                  {m.search}
                  <input
                    type="search"
                    value={query}
                    onChange={(ev) => setQuery(ev.target.value)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4"
                  />
                </label>
                <div className="mt-4 space-y-6">
                  {STAGES.map((level) => {
                    const entries = visibleLessons.filter((lesson) => lesson.stage === level);
                    return entries.length > 0 && (
                      <section key={level} aria-label={m[level]}>
                        <h2 className="mb-2 text-sm font-medium text-slate-600">{m[level]}</h2>
                        <div className="catalog-list">{entries.map(lessonEntry)}</div>
                      </section>
                    );
                  })}
                </div>
                {visibleLessons.length === 0 && (
                  <p role="status" className="mt-6">
                    {m.noMatches}{" "}
                    <button
                      type="button"
                      className="font-semibold text-brand-800 underline"
                      onClick={() => {
                        setQuery("");
                        setStage(auth.user ? "auto" : "all");
                      }}
                    >
                      {m.clearFilters}
                    </button>
                  </p>
                )}
              </>
              )
            ) : tab === "history" ? (
              <PracticeHistory
                session={session}
                explanationLocale={explanationLocale}
              />
            ) : due.length ? (
              <div className="catalog-list mt-4">
                {due.map(lessonEntry)}
              </div>
            ) : (
              <div className="rounded-2xl bg-white p-6">
                <h2 className="font-semibold">{m.noDue}</h2>
                <p className="mt-3 text-sm text-slate-600">{m.noDueHint}</p>
                <Link
                  to="/learn"
                  search={{ tab: "courses" }}
                  className="ielts-button mt-4 inline-block"
                >
                  {m.courses} →
                </Link>
              </div>
            )}
          </>
        )}
      {!lessonId && tab === "ielts" && session && (
        <PreparationPanel
          home={home}
          session={session}
          commit={commit}
          owner={owner}
          disabled={!loaded || !session || !!invalid || (!!auth.user && ["loading", "error", "conflict"].includes(cloud.status))}
        />
      )}
      {!lessonId && isWorkbench && (
        <>
          {auth.user && accountPlan.status !== "ready" && (
            <PersonalPlan
              plan={null}
              status={accountPlan.status}
              retry={accountPlan.retry}
              explanationLocale={explanationLocale}
            />
          )}
          <WorkbenchPanel
            home={home}
            key={learningLanguage}
            tab={tab as WorkbenchTab}
            session={session}
            commit={commit}
            plan={
              plan ??
              (!auth.user && lessons.length
                ? arrangeLearning(
                    learningEvidence(
                      learningLanguage as LearningLanguage,
                      [],
                      [],
                    ),
                    session,
                    now,
                  )
                : null)
            }
            explanationLocale={explanationLocale}
            concept={concept}
            activity={activity}
          />
        </>
      )}
      {!lessonId && tab === "materials" && (
        <MaterialBuilder session={session} wordIds={wordIds} />
      )}
      {!lessonId && tab === "library" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <h2 className="text-2xl font-bold">{BOOK.title}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {BOOK.author} · {BOOK.publisher}
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-7">{m.bookHint}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              className="ielts-button"
              href={`/api/library/book?id=${BOOK.id}#page=${session?.bookPage ?? 1}`}
              target="_blank"
              rel="noreferrer"
            >
              {m.openPdf}
            </a>
            <a
              className="ielts-button"
              href={`/api/library/book?id=${BOOK.id}`}
              download={BOOK.file}
            >
              {m.download}
            </a>
          </div>
          {(session?.bookPage ?? 1) > 1 && (
            <p className="mt-4 text-sm text-slate-600">
              {m.savedReading}: {session?.bookPage} / {BOOK.pages}
            </p>
          )}
          <form
            key={session?.bookPage ?? 1}
            className="mt-5 flex flex-wrap items-end gap-3"
            onSubmit={(ev) => {
              ev.preventDefault();
              bookPage(Number(new FormData(ev.currentTarget).get("page")));
            }}
          >
            <label className="text-sm">
              {m.page} / {BOOK.pages}
              <input
                name="page"
                type="number"
                min={1}
                max={BOOK.pages}
                defaultValue={session?.bookPage ?? 1}
                required
                className="ml-2 min-h-11 w-24 rounded-lg border border-slate-300 px-3"
              />
            </label>
            <button className="ielts-button" disabled={!session}>
              {m.go}
            </button>
            <button
              type="button"
              className="ielts-button"
              disabled={!session || session.bookPage <= 1}
              onClick={() => bookPage((session?.bookPage ?? 1) - 1)}
            >
              {m.previousPage}
            </button>
            <button
              type="button"
              className="ielts-button"
              disabled={!session || session.bookPage >= BOOK.pages}
              onClick={() => bookPage((session?.bookPage ?? 1) + 1)}
            >
              {m.nextPage}
            </button>
          </form>
          <BookReader page={session?.bookPage ?? 1} />
          <div className="mt-6 text-sm leading-7">
            <h3 className="font-semibold">{m.credit}</h3>
            <p>
              <a
                href={BOOK.source}
                target="_blank"
                rel="noreferrer"
                className="text-brand-800 underline"
              >
                {BOOK.publisher}
              </a>{" "}
              ·{" "}
              <a
                href={BOOK.licenseUrl}
                target="_blank"
                rel="noreferrer"
                className="text-brand-800 underline"
              >
                {BOOK.license}
              </a>
            </p>
            <p>{m.original}</p>
            <a
              href="/library/ATTRIBUTION.txt"
              className="text-brand-800 underline"
            >
              Attribution
            </a>{" "}
            ·{" "}
            <button
              onClick={() =>
                download(
                  JSON.stringify(COURSE_CONTENT, null, 2),
                  "grammar-v1.json",
                )
              }
              className="text-brand-800 underline"
            >
              {m.downloadCourse}
            </button>
          </div>
        </section>
      )}
      {home && <HomeVocabularyFallback available={isCoursePlayable(learningLanguage)} />}
      {home && (
        <details className="mt-4 rounded-xl border border-stone-200 bg-white px-4 py-1">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-medium text-slate-600">{m.settings}</summary>
          <div className="flex flex-wrap items-center gap-3 py-3">
            <CoursePicker compact />
            <LanguageSwitcher />
            {session && <button className="ielts-button" onClick={backup}>{m.backup}</button>}
            {!auth.user && session && <>
              <label className="ielts-button relative cursor-pointer">
                {m.importBackup}
                <input className="absolute inset-0 w-full cursor-pointer opacity-0" aria-label={m.importBackup} type="file" accept=".json,application/json" onChange={(event) => void importBackup(event)} />
              </label>
              {hasLocalBackup && <button className="ielts-button" onClick={restoreLocalBackup}>{m.restoreBackup}</button>}
              <p className="w-full text-xs text-slate-500">{m.transferHint}</p>
              {importError && <p role="alert" className="w-full text-sm text-red-700">{importError}</p>}
            </>}
            <Link className="ielts-button" to="/guide">{t("nav.guide")}</Link>
          </div>
        </details>
      )}
      {!home && session && (
        <button
          className="mt-7 self-start text-sm text-brand-800 underline"
          onClick={backup}
        >
          {m.backup}
        </button>
      )}
    </PageShell>
  );
}

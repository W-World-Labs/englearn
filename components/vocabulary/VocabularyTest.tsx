import { QuestionFeedback } from "@/components/learning/QuestionFeedback";
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/PageShell";
import { useI18n } from "@/lib/i18n/context";
import { studyTextLocale } from "@/lib/i18n/localized";
import { useAuth } from "@/lib/client/auth";
import { useExamCloud } from "@/lib/exams/useExamCloud";
import { ExamSaveStatus } from "@/components/exams/ExamSaveStatus";
import { examMessages } from "@/lib/exams/messages";
import { vocabularyMessages } from "@/lib/vocabulary/messages";
import {
  VOCABULARY_LANGUAGES,
  LANGUAGE_NAMES,
  isVocabularyLanguage,
  vocabularyWord,
  type VocabularyLanguage,
  type MeaningLanguage,
} from "@/lib/vocabulary/bank";
import { vocabularyStopping } from "@/lib/vocabulary/score";
import {
  createVocabulary,
  answerVocabulary,
  advanceVocabulary,
  vocabularyTotal,
  parseVocabulary,
  vocabularyStorageKey,
  type VocabularyMode,
  type VocabularySession,
  type VocabularySummary,
} from "@/lib/vocabulary/session";
import {
  VocabularyResult,
  VocabularyMethod,
  downloadVocabulary,
} from "./VocabularyResult";
import { XpAward } from "@/components/learn/XpAward";
import { addXpOnce } from "@/lib/gamification/store";
import { xpForExamPaper } from "@/lib/gamification/xp";

export function VocabularyTest() {
  const auth = useAuth(),
    m = examMessages(useI18n().locale);
  if (auth.loading)
    return (
      <PageShell active="vocabulary">
        <p role="status" className="mt-10">
          {m.preparing}
        </p>
      </PageShell>
    );
  if (auth.error)
    return (
      <PageShell active="vocabulary">
        <p role="alert" className="mt-10">
          {m.authError}
        </p>
        <button
          className="ielts-button mt-3"
          onClick={() => void auth.refresh()}
        >
          {m.retry}
        </button>
      </PageShell>
    );
  const owner = auth.user ? `user:${auth.user.sub}` : "guest";
  return <VocabularyWorkspace key={owner} owner={owner} />;
}
function VocabularyWorkspace({ owner }: { owner: string }) {
  const { locale, learningLanguage } = useI18n(),
    m = vocabularyMessages(locale),
    e = examMessages(locale);
  const { user, configured, login } = useAuth();
  const [language, setLanguage] = React.useState<VocabularyLanguage | null>(
    isVocabularyLanguage(learningLanguage) ? learningLanguage : null,
  );
  const [meaningLanguage, setMeaningLanguage] = React.useState<MeaningLanguage>(
    studyTextLocale(locale),
  );
  const [mode, setMode] = React.useState<VocabularyMode>("quick");
  const [session, setSession] = React.useState<VocabularySession | null>(null);
  const current = React.useRef<VocabularySession | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [entered, setEntered] = React.useState(false);
  const [storageError, setStorageError] = React.useState(false);
  const [invalid, setInvalid] = React.useState(false);
  const [replace, setReplace] = React.useState(false);
  const [xpEarned, setXpEarned] = React.useState<number | null>(null);
  const dialog = React.useRef<HTMLDialogElement>(null);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const prefix = vocabularyStorageKey(owner);
  const commit = React.useCallback(
    (s: VocabularySession) => {
      current.current = s;
      setSession(s);
      if (s.status === "finished") {
        const xp = xpForExamPaper(Object.keys(s.answers).length);
        setXpEarned(addXpOnce(`vocab-finish:${s.id}`, xp) ? xp : null);
      }
      try {
        localStorage.setItem(prefix, JSON.stringify(s));
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    },
    [prefix],
  );
  const cloud = useExamCloud<VocabularySession, VocabularySummary>({
    prefix,
    endpoint: "/api/vocabulary/attempts",
    account: user?.sub ?? null,
    loaded,
    session,
    current,
    commit,
  });
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(prefix),
        saved = parseVocabulary(raw);
      if (saved) {
        commit(saved);
        setLanguage(saved.language);
        setMeaningLanguage(saved.meaningLanguage);
        setMode(saved.mode);
      } else if (raw) setInvalid(true);
    } catch {
      setStorageError(true);
    }
    setLoaded(true);
  }, [prefix, commit]);
  React.useEffect(() => {
    if (replace) dialog.current?.showModal();
    else dialog.current?.close();
  }, [replace]);
  React.useEffect(() => {
    if (entered) heading.current?.focus({ preventScroll: true });
  }, [entered, session?.index]);
  const blocked =
    !loaded ||
    (!!user &&
      ["loading", "saving", "error", "conflict"].includes(cloud.status));
  function answer(value: string) {
    const s = current.current;
    if (s) commit(answerVocabulary(s, value));
  }
  React.useEffect(() => {
    if (!entered || session?.status !== "running") return;
    const keyboard = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        (event.target as HTMLElement)?.closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      const s = current.current!;
      if (/^[1-4]$/.test(event.key)) {
        event.preventDefault();
        answer(s.questions[s.index].options[Number(event.key) - 1]);
      }
      if (event.key === "0") {
        event.preventDefault();
        answer("unknown");
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [entered, session?.status, commit]);
  async function start() {
    if (!language || !(await cloud.flush())) return;
    commit(
      createVocabulary(
        language,
        meaningLanguage,
        mode,
        Date.now(),
        crypto.randomUUID(),
      ),
    );
    setInvalid(false);
    setReplace(false);
    setEntered(true);
  }
  const saveStatus = (
    <ExamSaveStatus
      status={cloud.status}
      onRetry={cloud.retry}
      onLogin={() => login("/vocabulary")}
      onBackup={() =>
        current.current && downloadVocabulary(current.current, true)
      }
      onUseServer={cloud.useServer}
    />
  );
  const q = session?.questions[session.index],
    word = q && vocabularyWord(q.id),
    locked =
      !!session?.adaptive && session.index < session.questions.length - 1,
    dynamic = session?.adaptive?.version === 2,
    stopping = dynamic ? vocabularyStopping(session!) : null,
    canFinish =
      !!session &&
      (dynamic
        ? session.index === session.questions.length - 1 && !!stopping?.reason
        : session.index + 1 === vocabularyTotal(session));
  return (
    <PageShell active="vocabulary" wide>
      <div className="mt-7 overflow-hidden rounded-xl">{saveStatus}</div>
      {storageError && (
        <div
          role="alert"
          className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6"
        >
          {e.storageError}
          {session && (
            <button
              className="ml-3 underline"
              onClick={() => downloadVocabulary(session, true)}
            >
              {m.backup}
            </button>
          )}
        </div>
      )}
      {entered && session?.status === "finished" ? (
        <>
          {xpEarned !== null && (
            <XpAward
              amount={xpEarned}
              className="mx-auto mt-5 max-w-3xl rounded-xl bg-emerald-50 p-4 text-emerald-900"
            />
          )}
          <VocabularyResult
            key={session.id}
            session={session}
            onBack={() => setEntered(false)}
            onMoreEvidence={() => {
              setMode("full");
              setLanguage(session.language);
              setMeaningLanguage(session.meaningLanguage);
              setEntered(false);
            }}
          />
        </>
      ) : entered && session && q && word ? (
        <div className="mx-auto mt-7 w-full max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="font-semibold">
              {LANGUAGE_NAMES[session.language]} · {m[session.mode]}
            </span>
            <button
              className="ielts-button text-xs"
              onClick={() => {
                void cloud.flush();
                setEntered(false);
              }}
            >
              {m.pause}
            </button>
          </div>
          <div className="my-5">
            <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
              <span>
                {m.question} {session.index + 1} {dynamic ? `· ${m.upTo}` : "/"}{" "}
                {vocabularyTotal(session)}
              </span>
              <span>
                {m.answered} {Object.keys(session.answers).length} · {m.noTime}
              </span>
            </div>
            <progress
              aria-label={m.progress}
              max={vocabularyTotal(session)}
              value={Object.keys(session.answers).length}
              className="h-2 w-full appearance-none overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:bg-amber-500 [&::-moz-progress-bar]:bg-amber-500"
            />
          </div>
          {session.adaptive && (
            <div
              className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4"
              data-testid="vocabulary-adaptive"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-amber-950">
                <span>{m.adaptive}</span>
                <span data-testid="vocabulary-difficulty">
                  {m.difficulty} {word.band + 1} / 4
                </span>
              </div>
              <p className="mt-2 text-xs leading-6 text-amber-900">
                {dynamic ? m.dynamicAdapting : m.adapting}
              </p>
              {stopping && (
                <p
                  className="mt-2 text-xs font-semibold text-amber-950"
                  role="status"
                  data-testid="vocabulary-count-status"
                >
                  {stopping.reason
                    ? m.ready
                    : stopping.covered < 4
                      ? `${m.coverageCheck} ${stopping.covered} / 4`
                      : m.refining}
                </p>
              )}
            </div>
          )}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-8">
            <p className="text-center text-sm text-slate-500">{m.known}</p>
            <h1
              ref={heading}
              tabIndex={-1}
              lang={session.language}
              className="my-8 break-words text-center text-4xl font-bold tracking-tight focus:outline-none sm:text-5xl"
            >
              {word.word}
            </h1>
            <QuestionFeedback question={"v:" + word.id} />
            <fieldset disabled={locked}>
              <legend className="sr-only">{m.known}</legend>
              <div className="space-y-3">
                {[...q.options, "unknown"].map((option, index) => (
                  <label
                    key={option}
                    className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm leading-6 transition-colors ${session.answers[q.id] === option ? "border-amber-500 bg-amber-50 ring-1 ring-amber-500" : "border-slate-200 hover:bg-slate-50"}`}
                  >
                    <input
                      type="radio"
                      className="h-4 w-4 shrink-0 accent-amber-700"
                      name={q.id}
                      value={option}
                      checked={session.answers[q.id] === option}
                      onChange={() => answer(option)}
                    />
                    <span
                      aria-hidden="true"
                      className="font-semibold text-slate-400"
                    >
                      {index === 4 ? "0" : index + 1}
                    </span>
                    <span
                      lang={
                        option === "unknown" ? locale : session.meaningLanguage
                      }
                    >
                      {option === "unknown"
                        ? m.unknown
                        : vocabularyWord(option)!.meaning[
                            session.meaningLanguage
                          ]}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {locked && (
              <p
                role="status"
                className="mt-4 text-xs leading-6 text-slate-500"
              >
                {m.locked}
              </p>
            )}
            <div className="mt-7 flex flex-wrap justify-between gap-3">
              <button
                className="ielts-button"
                disabled={session.index === 0}
                onClick={() => commit({ ...session, index: session.index - 1 })}
              >
                ← {m.previous}
              </button>
              <button
                className="ielts-button !border-slate-900 !bg-slate-900 !text-white"
                data-testid="vocabulary-next"
                data-finish={canFinish}
                disabled={
                  !session.answers[q.id] ||
                  (session.index === vocabularyTotal(session) - 1 &&
                    Object.keys(session.answers).length !==
                      vocabularyTotal(session))
                }
                onClick={() => commit(advanceVocabulary(session, Date.now()))}
              >
                {canFinish ? m.finish : m.next} →
              </button>
            </div>
          </section>
        </div>
      ) : (
        <>
          <header className="mb-7 mt-8">
            <Link to="/" className="text-xs font-semibold text-slate-500">
              ← {m.home}
            </Link>
            <p className="mt-6 text-xs font-semibold tracking-widest text-amber-800">
              {m.name}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              {m.title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
              {m.intro}
            </p>
          </header>
          {invalid && (
            <p role="alert" className="mb-5 rounded-xl bg-amber-50 p-4 text-sm">
              {e.invalidDraft}
            </p>
          )}
          {session && (
            <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div>
                <h2 className="text-sm font-semibold">
                  {m.savedDraft} · {LANGUAGE_NAMES[session.language]}
                </h2>
                <p className="mt-2 text-xs text-slate-600">
                  {m[session.mode]} · {Object.keys(session.answers).length} /{" "}
                  {dynamic && session.status === "running" ? `${m.upTo} ` : ""}
                  {vocabularyTotal(session)}
                </p>
              </div>
              <button
                className="ielts-button"
                disabled={blocked}
                onClick={() => setEntered(true)}
              >
                {session.status === "finished" ? m.report : m.resume} →
              </button>
            </section>
          )}
          <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
              <fieldset>
                <legend className="text-sm font-semibold">{m.language}</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {VOCABULARY_LANGUAGES.map((id) => (
                    <button
                      key={id}
                      className={`ielts-button ${language === id ? "!bg-slate-900 !text-white" : ""}`}
                      aria-pressed={language === id}
                      onClick={() => setLanguage(id)}
                    >
                      {LANGUAGE_NAMES[id]}
                    </button>
                  ))}
                </div>
              </fieldset>
              {!isVocabularyLanguage(learningLanguage) && (
                <p className="mt-3 text-xs leading-6 text-amber-800">
                  {m.unsupported}
                </p>
              )}
              <label className="mt-6 block text-sm font-semibold">
                {m.meanings}
                <select
                  aria-label={m.meanings}
                  value={meaningLanguage}
                  onChange={(event) =>
                    setMeaningLanguage(event.target.value as MeaningLanguage)
                  }
                  className="ml-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
              </label>
              <div className="my-6 grid gap-3 sm:grid-cols-2">
                {(["quick", "full"] as const).map((value) => (
                  <button
                    key={value}
                    aria-pressed={mode === value}
                    onClick={() => setMode(value)}
                    className={`rounded-2xl border p-5 text-left ${mode === value ? "border-amber-500 bg-amber-50 ring-1 ring-amber-500" : "border-slate-200"}`}
                  >
                    <strong className="text-sm">{m[value]}</strong>
                    <p className="mt-2 text-xs leading-6 text-slate-500">
                      {value === "quick" ? m.quickHint : m.fullHint}
                    </p>
                  </button>
                ))}
              </div>
              <div className="mb-5 rounded-2xl bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-950">
                  {m.adaptive}
                </p>
                <p className="mt-2 text-xs leading-6 text-amber-900">
                  {m.adaptiveHint}
                </p>
              </div>
              <p className="text-sm leading-7 text-slate-600">{m.beginHint}</p>
              <p className="mt-3 text-xs leading-6 text-slate-500">{m.scope}</p>
              <button
                className="ielts-button mt-6 w-full !border-slate-900 !bg-slate-900 !py-3 !text-white"
                disabled={!language || blocked}
                onClick={() => (session ? setReplace(true) : void start())}
              >
                {m.start} →
              </button>
            </section>
            <aside className="rounded-3xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">W-ID · {m.history}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {m.historyHint}
              </p>
              {!user && (
                <button
                  className="ielts-button mt-4 w-full"
                  disabled={!configured}
                  onClick={() => login("/vocabulary")}
                >
                  {e.signIn}
                </button>
              )}
              {user && (
                <div className="mt-4 space-y-3">
                  {cloud.history?.items.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-xl border border-slate-100 p-3"
                    >
                      <p className="text-sm font-semibold">
                        {LANGUAGE_NAMES[item.language]} · {m[item.mode]}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(item.startedAt).toLocaleString(locale)} ·{" "}
                        {item.answered} /{" "}
                        {item.adaptiveVersion === 2 && item.status === "running"
                          ? `${m.upTo} `
                          : ""}
                        {item.total}
                      </p>
                      <button
                        disabled={blocked}
                        className="mt-3 text-xs font-semibold text-blue-700 disabled:opacity-50"
                        onClick={async () => {
                          if (await cloud.open(item.id)) setEntered(true);
                        }}
                      >
                        {item.status === "finished" ? m.report : m.resume} →
                      </button>
                    </article>
                  ))}
                  {cloud.history?.total === 0 && (
                    <p className="text-xs text-slate-500">{m.noHistory}</p>
                  )}
                  {cloud.history && cloud.history.totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <button
                        className="ielts-button"
                        disabled={cloud.history.page <= 1}
                        aria-label={e.previous}
                        onClick={() =>
                          void cloud.readHistory(cloud.history!.page - 1)
                        }
                      >
                        ←
                      </button>
                      <span className="text-xs">
                        {cloud.history.page} / {cloud.history.totalPages}
                      </span>
                      <button
                        className="ielts-button"
                        disabled={
                          cloud.history.page >= cloud.history.totalPages
                        }
                        aria-label={e.next}
                        onClick={() =>
                          void cloud.readHistory(cloud.history!.page + 1)
                        }
                      >
                        →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>
          <VocabularyMethod />
        </>
      )}
      <dialog
        ref={dialog}
        onCancel={() => setReplace(false)}
        onClose={() => setReplace(false)}
        className="w-[min(480px,calc(100vw-32px))] rounded-2xl border border-slate-200 p-6 shadow-xl backdrop:bg-slate-950/40"
        aria-labelledby="vocabulary-replace-title"
      >
        <h2 id="vocabulary-replace-title" className="text-xl font-semibold">
          {m.replace}
        </h2>
        <p className="my-4 text-sm leading-7 text-slate-600">{m.replaceHint}</p>
        <div className="flex flex-wrap justify-end gap-3">
          <button
            className="ielts-button"
            onClick={() => session && downloadVocabulary(session, true)}
          >
            {m.backup}
          </button>
          <button className="ielts-button" onClick={() => setReplace(false)}>
            {m.cancel}
          </button>
          <button
            className="ielts-button !bg-slate-900 !text-white"
            disabled={blocked}
            onClick={() => void start()}
          >
            {m.confirm}
          </button>
        </div>
      </dialog>
    </PageShell>
  );
}

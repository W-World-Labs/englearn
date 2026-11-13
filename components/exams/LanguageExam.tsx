import * as React from "react";
import { Link } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/PageShell";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/lib/client/auth";
import { examMessages } from "@/lib/exams/messages";
import {
  papersFor,
  getPaper,
  explanationFor,
  practiceSections,
  type ExamFamily,
  type PracticeMode,
} from "@/lib/exams/catalog";
import {
  createPractice,
  parsePractice,
  reconcilePractice,
  finishPracticeSection,
  practiceStorageKey,
  type PracticeSession,
  type PracticeSummary,
} from "@/lib/exams/session";
import { useExamCloud } from "@/lib/exams/useExamCloud";
import { XpAward } from "@/components/learn/XpAward";
import { addXpOnce } from "@/lib/gamification/store";
import { xpForExamPaper } from "@/lib/gamification/xp";
import { ExamSaveStatus } from "./ExamSaveStatus";
import { PracticeReview, downloadPractice } from "./PracticeReview";
import { PracticeAudio } from "./PracticeAudio";
import { PracticeAnswer } from "./PracticeAnswer";
import { PracticePassage } from "./PracticePassage";

export function LanguageExam({ family }: { family: ExamFamily }) {
  const { user, loading, error, refresh } = useAuth();
  const m = examMessages(useI18n().locale);
  if (loading)
    return (
      <main className="mx-auto max-w-5xl p-8">
        <p className="font-semibold text-blue-700">
          LingoLearn · {family.toUpperCase()}
        </p>
        <p role="status" className="mt-10">
          {m.preparing}
        </p>
      </main>
    );
  if (error)
    return (
      <PageShell active="exams">
        <p role="alert" className="mt-10">
          {m.authError}
        </p>
        <button className="ielts-button mt-4" onClick={() => void refresh()}>
          {m.retry}
        </button>
      </PageShell>
    );
  const owner = user ? `user:${user.sub}` : "guest";
  return (
    <PracticeWorkspace
      key={`${family}:${owner}`}
      family={family}
      owner={owner}
    />
  );
}
function PracticeWorkspace({
  family,
  owner,
}: {
  family: ExamFamily;
  owner: string;
}) {
  const { locale } = useI18n();
  const m = examMessages(locale);
  const { user, configured, login } = useAuth();
  const profile = {
    topik: {
      badge: "한",
      native: "한국어능력시험",
      color: "bg-violet-100 text-violet-800",
      intro: m.topikIntro,
      format: m.topikFormat,
      tag: "IBT skills",
    },
    hsk: {
      badge: "汉",
      native: "汉语水平考试",
      color: "bg-emerald-100 text-emerald-800",
      intro: m.hskIntro,
      format: m.hskFormat,
      tag: "HSK 2.0 skills",
    },
    jlpt: {
      badge: "あ",
      native: "日本語能力試験",
      color: "bg-rose-100 text-rose-800",
      intro: m.jlptIntro,
      format: m.jlptFormat,
      tag: "JLPT skills",
    },
  }[family];
  const papers = papersFor(family);
  const [selected, setSelected] = React.useState(papers[0].id);
  const [session, setSession] = React.useState<PracticeSession | null>(null);
  const current = React.useRef<PracticeSession | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [entered, setEntered] = React.useState(false);
  const [now, setNow] = React.useState(Date.now);
  const [navFilter, setNavFilter] = React.useState("all");
  const [largeText, setLargeText] = React.useState(false);
  const [storageError, setStorageError] = React.useState(false);
  const [invalid, setInvalid] = React.useState(false);
  const [preflight, setPreflight] = React.useState<{
    paperId: string;
    mode: PracticeMode;
  } | null>(null);
  const [consent, setConsent] = React.useState(false);
  const [heard, setHeard] = React.useState(false);
  const [soundChecked, setSoundChecked] = React.useState(false);
  const [modal, setModal] = React.useState<
    "submit" | { paperId: string; mode: PracticeMode } | null
  >(null);
  const [xpEarned, setXpEarned] = React.useState<number | null>(null);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const questionRef = React.useRef<HTMLHeadingElement>(null);
  const prefix = practiceStorageKey(owner, family);
  const commit = React.useCallback(
    (next: PracticeSession) => {
      current.current = next;
      setSession(next);
      if (next.status === "finished") {
        const xp = xpForExamPaper(
          getPaper(next.paperId)?.questions.length ?? 0,
        );
        setXpEarned(addXpOnce(`exam-finish:${next.id}`, xp) ? xp : null);
      }
      try {
        localStorage.setItem(prefix, JSON.stringify(next));
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    },
    [prefix],
  );
  const cloud = useExamCloud<PracticeSession, PracticeSummary>({
    prefix,
    endpoint: `/api/exams/${family}/attempts`,
    account: user?.sub ?? null,
    loaded,
    session,
    current,
    commit,
  });
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(prefix);
      const saved = parsePractice(raw);
      if (saved && getPaper(saved.paperId)?.family === family) {
        commit(reconcilePractice(saved, Date.now()));
        setSelected(saved.paperId);
      } else if (raw) setInvalid(true);
    } catch {
      setStorageError(true);
    }
    setLoaded(true);
  }, [prefix, family, commit]);
  React.useEffect(() => {
    if (session) setSelected(session.paperId);
  }, [session?.id]);
  React.useEffect(() => {
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (!current.current) return;
      const next = reconcilePractice(current.current, time);
      if (next !== current.current) {
        commit(next);
        setModal(null);
      }
    };
    const timer = window.setInterval(tick, 1000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [commit]);
  React.useEffect(() => {
    if (!entered || session?.status !== "running") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [entered, session?.status]);
  React.useEffect(() => {
    if (modal && !dialogRef.current?.open) dialogRef.current?.showModal();
    else if (!modal) dialogRef.current?.close();
  }, [modal]);
  React.useEffect(() => {
    if (entered) {
      questionRef.current?.focus({ preventScroll: true });
      questionRef.current?.scrollIntoView({ block: "start" });
    }
  }, [entered, session?.sectionIndex, session?.questionIndex]);
  React.useEffect(() => {
    setNavFilter("all");
  }, [session?.id, session?.sectionIndex]);
  const activeQuestions = session
    ? getPaper(session.paperId)!.questions.filter(
        (q) =>
          q.section ===
          practiceSections(getPaper(session.paperId)!, session.mode)[
            session.sectionIndex
          ].id,
      )
    : [];
  const unanswered = activeQuestions.filter(
    (q) => !session?.answers[q.id]?.trim(),
  );
  const marked = activeQuestions.filter((q) => session?.flags.includes(q.id));
  const blocked =
    !loaded ||
    (!!user &&
      ["loading", "saving", "error", "conflict"].includes(cloud.status));
  const backup = () => {
    if (current.current) downloadPractice(current.current, true);
  };
  const status = (
    <ExamSaveStatus
      status={cloud.status}
      onRetry={cloud.retry}
      onLogin={() => login(`/${family}`)}
      onBackup={backup}
      onUseServer={cloud.useServer}
    />
  );
  const warning = storageError && (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 bg-amber-50 px-5 py-3 text-sm text-amber-900"
    >
      <p>{m.storageError}</p>
      <button className="underline" onClick={backup}>
        {m.backup}
      </button>
    </div>
  );
  async function prepare(paperId: string, mode: PracticeMode) {
    if (!(await cloud.flush())) return;
    setConsent(false);
    setHeard(false);
    setSoundChecked(false);
    setPreflight({ paperId, mode });
    setModal(null);
  }
  function requestStart(mode: PracticeMode) {
    if (session) setModal({ paperId: selected, mode });
    else void prepare(selected, mode);
  }
  function change(update: (s: PracticeSession) => PracticeSession) {
    const old = current.current;
    if (!old || old.status !== "running") return;
    const fresh = reconcilePractice(old, Date.now());
    if (fresh !== old) {
      commit(fresh);
      return;
    }
    commit(update(old));
  }
  const dialog = (
    <dialog
      ref={dialogRef}
      onCancel={() => setModal(null)}
      onClose={() => setModal(null)}
      className="w-[min(480px,calc(100vw-32px))] rounded-2xl border border-slate-200 p-6 shadow-xl backdrop:bg-slate-950/40"
      aria-labelledby="practice-dialog-title"
    >
      <h2 id="practice-dialog-title" className="text-xl font-bold">
        {modal === "submit" ? m.submitTitle : m.replace}
      </h2>
      <p className="my-4 text-sm leading-7 text-slate-600">
        {modal === "submit" ? m.submitHint : m.replaceHint}
      </p>
      {modal === "submit" && (
        <section
          className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4"
          aria-label={m.checkBeforeSubmit}
        >
          <h3 className="text-sm font-semibold">{m.checkBeforeSubmit}</h3>
          <div className="my-3 flex gap-5 text-sm">
            <span>
              {m.blank}: <strong>{unanswered.length}</strong>
            </span>
            <span>
              {m.marked}: <strong>{marked.length}</strong>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              [unanswered, m.jumpBlank],
              [marked, m.jumpMarked],
            ].map(([items, label]) => {
              const questions = items as typeof activeQuestions;
              return (
                !!questions.length && (
                  <button
                    key={String(label)}
                    className="ielts-button text-xs"
                    onClick={() => {
                      setModal(null);
                      setNavFilter("all");
                      change((s) => ({
                        ...s,
                        questionIndex: activeQuestions.findIndex(
                          (q) => q.id === questions[0].id,
                        ),
                      }));
                    }}
                  >
                    {String(label)} →
                  </button>
                )
              );
            })}
          </div>
        </section>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {modal !== "submit" && (
          <button className="ielts-button" onClick={backup}>
            {m.backup}
          </button>
        )}
        <button className="ielts-button" onClick={() => setModal(null)}>
          {m.cancel}
        </button>
        <button
          className="ielts-button !bg-slate-900 !text-white"
          onClick={() => {
            if (modal === "submit") {
              change((s) => finishPracticeSection(s, Date.now()));
              setModal(null);
            } else if (modal) void prepare(modal.paperId, modal.mode);
          }}
        >
          {m.confirm}
        </button>
      </div>
    </dialog>
  );
  if (entered && session?.status === "finished")
    return (
      <>
        {warning}
        {status}
        {xpEarned !== null && (
          <XpAward
            amount={xpEarned}
            className="mx-auto mt-4 max-w-5xl rounded-xl bg-emerald-50 px-4 py-4 text-emerald-900 sm:px-6"
          />
        )}
        <PracticeReview
          key={session.id}
          session={session}
          onBack={() => setEntered(false)}
        />
      </>
    );
  if (preflight) {
    const paper = getPaper(preflight.paperId)!;
    const listening = practiceSections(paper, preflight.mode).some(
      (s) => s.id === "listening",
    );
    return (
      <PageShell active="exams">
        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {warning}
          {status}
          <div className="p-5 sm:p-8">
            <p className="text-xs font-semibold text-blue-700">
              {paper.label} · {m.short}
            </p>
            <h1 className="mt-3 text-2xl font-bold">{m.preparation}</h1>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              {family === "jlpt" ? m.jlptChecks : m.checks}
            </p>
            <p className="mt-3 text-sm font-semibold">
              {practiceSections(paper, preflight.mode).reduce(
                (sum, s) => sum + s.minutes,
                0,
              )}{" "}
              {m.minutes} ·{" "}
              {
                paper.questions.filter(
                  (q) =>
                    preflight.mode === "all" || q.section === preflight.mode,
                ).length
              }{" "}
              {m.questions}
            </p>
            {listening && (
              <div className="my-6 space-y-4">
                <p className="text-sm leading-7 text-slate-600">
                  {m.audioNote}
                </p>
                <PracticeAudio
                  key={`${family}-check`}
                  paperId={`${family}-check-v1`}
                  questionId="sample"
                  onPlayed={() => setHeard(true)}
                />
                <label className="flex items-start gap-3 text-sm leading-6">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    disabled={!heard}
                    checked={soundChecked}
                    onChange={(e) => setSoundChecked(e.target.checked)}
                  />
                  {m.audioCheck}
                </label>
                <p className="text-xs leading-6 text-slate-500">
                  {m.voiceNeeded}
                </p>
              </div>
            )}
            <label className="mt-6 flex items-start gap-3 text-sm leading-6">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              {m.consent}
            </label>
            <div className="mt-7 flex flex-wrap justify-between gap-3">
              <button
                className="ielts-button"
                onClick={() => setPreflight(null)}
              >
                {m.back}
              </button>
              <button
                className="ielts-button !bg-slate-900 !text-white"
                disabled={!consent || (listening && !soundChecked)}
                onClick={async () => {
                  if (!(await cloud.flush())) return;
                  const next = createPractice(
                    paper.id,
                    preflight.mode,
                    Date.now(),
                    crypto.randomUUID(),
                  );
                  commit(next);
                  setInvalid(false);
                  setPreflight(null);
                  setEntered(true);
                }}
              >
                {m.begin}
              </button>
            </div>
          </div>
        </section>
      </PageShell>
    );
  }
  if (!entered || !session) {
    const paper = getPaper(selected)!;
    return (
      <PageShell active="exams" wide>
        {warning}
        <div className="mb-6 mt-8">
          <Link to="/exams" className="text-sm font-semibold text-slate-500">
            ← {m.centre}
          </Link>
          <div className="mt-5 flex items-center gap-4">
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold ${profile.color}`}
              aria-hidden="true"
            >
              {profile.badge}
            </span>
            <div>
              <p className="text-xs font-semibold tracking-widest text-slate-500">
                {profile.native}
              </p>
              <h1 className="mt-1 text-3xl font-bold">
                {family.toUpperCase()}
              </h1>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            {profile.intro}
          </p>
        </div>
        {session && (
          <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-5">
            <div>
              <h2 className="font-semibold">
                {m.draft} · {getPaper(session.paperId)?.label}
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                {session.status === "running" ? m.running : m.finished}
              </p>
            </div>
            <button
              className="ielts-button"
              onClick={() => {
                commit(reconcilePractice(session, Date.now()));
                setEntered(true);
              }}
            >
              {session.status === "finished" ? m.review : m.resume}
            </button>
          </section>
        )}
        {invalid && (
          <p role="status" className="mb-4 text-sm text-amber-800">
            {m.invalidDraft}
          </p>
        )}
        <section className="mb-6" aria-label={m.choose}>
          <h2 className="mb-3 text-sm font-semibold">{m.choose}</h2>
          <div className="flex flex-wrap gap-2">
            {papers.map((p) => (
              <button
                key={p.id}
                className={`ielts-button ${selected === p.id ? "!border-slate-900 !bg-slate-900 !text-white" : ""}`}
                aria-pressed={selected === p.id}
                onClick={() => setSelected(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            <section className="rounded-2xl bg-slate-900 p-6 text-white">
              <p className="text-xs font-semibold tracking-widest text-slate-300">
                {m.short} · 01
              </p>
              <h2 className="mt-3 text-2xl font-bold">
                {paper.label} · {m.all}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {explanationFor(paper.description, locale)}
              </p>
              <div className="my-5 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full bg-white/10 px-3 py-2">
                  {paper.questions.length} {m.questions}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-2">
                  {paper.sections.reduce((sum, s) => sum + s.minutes, 0)}{" "}
                  {m.minutes}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-2">
                  {profile.tag}
                </span>
              </div>
              <button
                className="ielts-button w-full !text-slate-900 sm:w-auto"
                disabled={blocked}
                onClick={() => requestStart("all")}
              >
                {m.start} →
              </button>
            </section>
            <section
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              aria-label={m.skills}
            >
              <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">
                {m.skills}
              </h2>
              {paper.sections.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 last:border-0"
                >
                  <div>
                    <h3 className="font-semibold">{m[s.id]}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {paper.questions.filter((q) => q.section === s.id).length}{" "}
                      {m.questions} · {s.minutes} {m.minutes}
                    </p>
                  </div>
                  <button
                    className="ielts-button"
                    disabled={blocked}
                    aria-label={`${m.start} ${m[s.id]}`}
                    onClick={() => requestStart(s.id)}
                  >
                    {m.start} →
                  </button>
                </div>
              ))}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 font-semibold">{m.warmup}</h2>
              <div className="space-y-3">
                {paper.tips.map((tip) => (
                  <details
                    key={tip.pattern}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <summary className="cursor-pointer font-medium">
                      <span lang={paper.language}>{tip.pattern}</span>
                      <span className="ml-3 text-xs font-normal text-slate-500">
                        {m.meaning}
                      </span>
                    </summary>
                    <p className="mt-4 leading-8" lang={paper.language}>
                      {tip.example}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {explanationFor(tip.meaning, locale)}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          </div>
          <aside className="space-y-5">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="p-5">
                <h2 className="font-semibold">W-ID · {m.history}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {m.accountHint}
                </p>
                {!user && (
                  <button
                    className="ielts-button mt-4 w-full"
                    disabled={!configured}
                    onClick={() => login(`/${family}`)}
                  >
                    {m.signIn}
                  </button>
                )}
              </div>
              {status}
            </section>
            <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
              <h2 className="text-sm font-semibold">{m.listeningReady}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                {m.listeningReadyHint}
              </p>
              <p className="mt-3 text-xs leading-6 text-slate-600">
                {m.audioNote}
              </p>
            </section>
          </aside>
        </div>
        {user && cloud.history && (
          <section
            className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"
            aria-label={m.history}
          >
            <h2 className="font-semibold">
              {m.history}{" "}
              <span className="text-sm font-normal text-slate-500">
                ({cloud.history.total})
              </span>
            </h2>
            {!cloud.history.total && (
              <p className="mt-3 text-sm text-slate-500">{m.emptyHistory}</p>
            )}
            <ul className="mt-3 divide-y divide-slate-100">
              {cloud.history.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {getPaper(item.paperId)?.label} · {m[item.mode]}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(item.startedAt).toLocaleString(locale)} ·{" "}
                      {item.status === "finished" ? m.finished : m.running}
                    </p>
                  </div>
                  <button
                    className="ielts-button"
                    disabled={blocked}
                    onClick={async () => {
                      if (await cloud.open(item.id)) setEntered(true);
                    }}
                  >
                    {item.status === "finished" ? m.review : m.resume}
                  </button>
                </li>
              ))}
            </ul>
            {cloud.history.totalPages > 1 && (
              <div className="mt-3 flex items-center justify-end gap-3">
                <button
                  className="ielts-button"
                  aria-label={m.previous}
                  disabled={cloud.history.page <= 1}
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
                  aria-label={m.next}
                  disabled={cloud.history.page >= cloud.history.totalPages}
                  onClick={() =>
                    void cloud.readHistory(cloud.history!.page + 1)
                  }
                >
                  →
                </button>
              </div>
            )}
          </section>
        )}
        <section className="mt-6 rounded-xl border border-slate-200 p-5 text-xs leading-7 text-slate-600">
          <h2 className="mb-2 font-semibold text-slate-800">{m.sources}</h2>
          <p>{profile.format}</p>
          <p className="mt-2">{m.original}</p>
          <div className="mt-3 flex flex-wrap gap-4">
            {family === "jlpt" ? (
              <>
                <a
                  className="underline"
                  href="https://www.jlpt.jp/e/guideline/testsections.html"
                >
                  JLPT · {m.sources}
                </a>
                <a
                  className="underline"
                  href="https://www.jlpt.jp/samples/forlearners.html"
                >
                  JLPT · 問題例
                </a>
              </>
            ) : family === "topik" ? (
              <>
                <a
                  className="underline"
                  href="https://www.niied.go.kr/web/NIIED/contents/niiedEng/eng_topikOverview"
                >
                  NIIED · TOPIK
                </a>
                <a
                  className="underline"
                  href="https://www.topik.go.kr/asset/vendor/tutorial/exam2/listen_exam.html"
                >
                  TOPIK IBT tutorial
                </a>
              </>
            ) : (
              <>
                <a
                  className="underline"
                  href={`https://www.chinesetest.cn/HSK/${paper.level}`}
                >
                  HSK · {paper.level}
                </a>
                <a
                  className="underline"
                  href="https://www.chinesetest.cn/notice"
                >
                  HSK 3.0 ·{" "}
                  {m.trialNotice}
                </a>
              </>
            )}
          </div>
        </section>
        {dialog}
      </PageShell>
    );
  }
  const paper = getPaper(session.paperId)!;
  const sections = practiceSections(paper, session.mode);
  const section = sections[session.sectionIndex];
  const questions = paper.questions.filter((q) => q.section === section.id);
  const q = questions[session.questionIndex];
  const remaining = Math.min(
    section.minutes * 60,
    Math.max(0, Math.ceil((session.deadline - now) / 1000)),
  );
  const readRemaining = q.readSeconds
    ? Math.max(
        0,
        Math.ceil(
          (session.deadline -
            section.minutes * 60000 +
            q.readSeconds * 1000 -
            now) /
            1000,
        ),
      )
    : 0;
  const answer = session.answers[q.id] ?? "";
  function go(index: number) {
    change((s) => ({ ...s, questionIndex: index }));
    questionRef.current?.scrollIntoView({
      block: "start",
      behavior: "instant",
    });
  }
  return (
    <main
      className="min-h-screen bg-slate-50"
      dir="ltr"
      style={
        {
          "--practice-font-size": largeText ? "21px" : "17px",
        } as React.CSSProperties
      }
    >
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div>
          <p className="text-xs font-semibold text-slate-500">
            LingoLearn · {m.short}
          </p>
          <h1 className="mt-1 font-bold">
            {paper.label} · {m[section.id]}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="ielts-button !px-3"
            aria-pressed={largeText}
            onClick={() => setLargeText(!largeText)}
          >
            {m.largerText}
          </button>
          <div
            role="timer"
            aria-label="Time remaining"
            className={`font-mono text-xl font-bold tabular-nums ${remaining <= 60 ? "text-rose-700" : "text-slate-900"}`}
          >
            {String(Math.floor(remaining / 60)).padStart(2, "0")}:
            {String(remaining % 60).padStart(2, "0")}
          </div>
          <button
            className="ielts-button !px-3"
            onClick={() => setEntered(false)}
          >
            {m.back}
          </button>
        </div>
      </header>
      {warning}
      {status}
      {remaining <= 60 && (
        <p
          role="status"
          className="bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-900"
        >
          {m.minuteWarning}
        </p>
      )}
      <div className="mx-auto grid max-w-7xl items-start gap-5 px-4 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 lg:sticky lg:top-24">
          <p className="text-xs font-semibold text-slate-500">
            {session.sectionIndex + 1} / {sections.length} · {m[section.id]}
          </p>
          <p className="my-3 text-sm font-semibold">
            {questions.filter((q) => session.answers[q.id]?.trim()).length} /{" "}
            {questions.length} {m.answered}
          </p>
          <progress
            aria-label={m.completeLabel}
            value={questions.length - unanswered.length}
            max={questions.length}
            className="mb-4 h-1.5 w-full appearance-none overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:bg-blue-700 [&::-moz-progress-bar]:bg-blue-700"
          />
          <div
            className="mb-4 flex flex-wrap gap-1.5"
            role="group"
            aria-label={m.navigation}
          >
            {[
              ["all", m.allQuestions, questions.length],
              ["blank", m.blank, unanswered.length],
              ["marked", m.marked, marked.length],
            ].map(([value, label, count]) => (
              <button
                key={value}
                aria-pressed={navFilter === value}
                className={`rounded-lg px-2 py-2 text-xs font-semibold ${navFilter === value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
                onClick={() => setNavFilter(String(value))}
              >
                {label} {count}
              </button>
            ))}
          </div>
          {((navFilter === "blank" && !unanswered.length) ||
            (navFilter === "marked" && !marked.length)) && (
            <p role="status" className="mb-3 text-xs leading-6 text-slate-500">
              {m.noNavMatches}
            </p>
          )}
          <nav
            aria-label={m.navigation}
            className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-4"
          >
            {questions.map(
              (item, i) =>
                (navFilter === "all" ||
                  (navFilter === "blank"
                    ? !session.answers[item.id]?.trim()
                    : session.flags.includes(item.id))) && (
                  <button
                    key={item.id}
                    className={`relative min-h-11 rounded-lg border text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${i === session.questionIndex ? "border-slate-900 bg-slate-900 text-white" : session.answers[item.id]?.trim() ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600"}`}
                    aria-label={`${m.question} ${i + 1}, ${session.answers[item.id]?.trim() ? m.answered : m.blank}${session.flags.includes(item.id) ? `, ${m.flag}` : ""}`}
                    aria-current={
                      i === session.questionIndex ? "step" : undefined
                    }
                    onClick={() => go(i)}
                  >
                    {i + 1}
                    {session.flags.includes(item.id) && (
                      <span
                        aria-hidden="true"
                        className="absolute right-1 top-0 text-amber-500"
                      >
                        •
                      </span>
                    )}
                  </button>
                ),
            )}
          </nav>
        </aside>
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2
              ref={questionRef}
              tabIndex={-1}
              className="scroll-mt-40 font-semibold focus:outline-none sm:scroll-mt-28"
            >
              {m.question} {session.questionIndex + 1} / {questions.length}
            </h2>
            <button
              className="ielts-button !py-2 text-xs"
              aria-pressed={session.flags.includes(q.id)}
              onClick={() =>
                change((s) => ({
                  ...s,
                  flags: s.flags.includes(q.id)
                    ? s.flags.filter((id) => id !== q.id)
                    : [...s.flags, q.id],
                }))
              }
            >
              {session.flags.includes(q.id) ? m.unflag : m.flag} ⚑
            </button>
          </div>
          {q.script && (
            <PracticeAudio
              key={q.id}
              paperId={paper.id}
              questionId={q.id}
              className="mb-6"
            />
          )}
          <p
            className="whitespace-pre-wrap text-[length:var(--practice-font-size,18px)] leading-9"
            lang={paper.language}
          >
            {q.prompt}
          </p>
          {q.picture && (
            <p className="my-6 text-7xl" role="img" aria-label={q.pictureLabel}>
              {q.picture}
            </p>
          )}
          <div
            className={
              q.passage &&
              (q.passage.length > 220 || q.table) &&
              (!q.readSeconds || readRemaining > 0)
                ? "grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-2"
                : ""
            }
          >
            {q.passage && (
              <div className="my-6 min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-5 xl:max-h-[65vh] xl:overflow-y-auto">
                {q.readSeconds && (
                  <p className="mb-3 text-sm font-semibold text-blue-800">
                    {readRemaining
                      ? `${m.readFirst} · ${readRemaining}s`
                      : m.hiddenSource}
                  </p>
                )}
                {(!q.readSeconds || readRemaining > 0) && (
                  <PracticePassage question={q} language={paper.language} />
                )}
              </div>
            )}
            <PracticeAnswer
              question={q}
              language={paper.language}
              value={answer}
              disabled={readRemaining > 0}
              onChange={(value) =>
                change((s) => ({
                  ...s,
                  answers: { ...s.answers, [q.id]: value },
                }))
              }
            />
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <div className="flex gap-2">
              <button
                className="ielts-button"
                disabled={session.questionIndex === 0}
                onClick={() => go(session.questionIndex - 1)}
              >
                ← {m.previous}
              </button>
              <button
                className="ielts-button"
                disabled={session.questionIndex === questions.length - 1}
                onClick={() => go(session.questionIndex + 1)}
              >
                {m.next} →
              </button>
            </div>
            <button
              className="ielts-button !border-slate-900 !bg-slate-900 !text-white"
              onClick={() => setModal("submit")}
            >
              {m.submit}
            </button>
          </div>
        </section>
      </div>
      {dialog}
    </main>
  );
}

import * as React from "react";
import { Link } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/PageShell";
import { useI18n } from "@/lib/i18n/context";
import { localizedText } from "@/lib/i18n/localized";
import { SECTION_LABELS, SECTION_SUMMARIES, GUIDE_STEPS } from "@/lib/ielts/ui";
import { useAuth } from "@/lib/client/auth";
import {
  EXAM_ID,
  EXAM_IDS,
  EXAM_LABELS,
  isExamId,
  sectionsFor,
  sectionIds,
  wordCount,
  type ExamId,
  type ExamMode,
} from "@/lib/ielts/exam";
import {
  createSession,
  finishSection,
  parseSession,
  reconcileSession,
  storageKey,
  type ExamSession,
  type ExamSummary,
} from "@/lib/ielts/session";
import { useExamCloud } from "@/lib/exams/useExamCloud";
import { XpAward } from "@/components/learn/XpAward";
import { addXpOnce } from "@/lib/gamification/store";
import { xpForExamPaper } from "@/lib/gamification/xp";
import { ExamQuestions } from "./ExamQuestions";
import { ExamAudio } from "./ExamAudio";
import { ExamPassage } from "./ExamPassage";
import { ExamWritingTable } from "./ExamWritingTable";
import { ExamResults } from "./ExamResults";
import { ExamSaveStatus } from "@/components/exams/ExamSaveStatus";
import { ExamSources } from "./ExamSources";
import { examMessages } from "@/lib/exams/messages";

export function IeltsExam() {
  const { user, loading, error, refresh, logout } = useAuth();
  const { locale, t } = useI18n();
  if (error)
    return (
      <PageShell active="ielts">
        <p role="alert" className="mt-10">
          {t("ielts.authError")}
        </p>
        <button className="ielts-button mt-4" onClick={() => void refresh()}>
          {t("common.retry")}
        </button>
        <button className="ielts-button ml-3 mt-4" onClick={() => void logout()}>
          {examMessages(locale).freeUse}
        </button>
      </PageShell>
    );
  if (loading)
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <p className="text-lg font-semibold text-brand-600">LingoLearn</p>
        <div
          className="mt-10 rounded-2xl border border-slate-200 bg-white p-8"
          role="status"
          aria-busy="true"
        >
          <p className="font-semibold">Preparing your test workspace…</p>
          <p className="mt-2 text-sm text-slate-500">{t("ielts.checking")}</p>
          <div
            aria-hidden="true"
            className="mt-6 h-32 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none"
          />
        </div>
      </main>
    );
  const owner = user ? `user:${user.sub}` : "guest";
  return <ExamWorkspace key={owner} owner={owner} />;
}

function ExamWorkspace({ owner }: { owner: string }) {
  const { locale, t } = useI18n();
  const { user, configured, login, logout } = useAuth();
  const [session, setSession] = React.useState<ExamSession | null>(null);
  const current = React.useRef<ExamSession | null>(null);
  const [examId, setExamId] = React.useState<ExamId>(EXAM_ID);
  // A loaded session pins its own set; the picker only governs new starts.
  const activeExamId =
    session && isExamId(session.examId) ? session.examId : examId;
  const sections = sectionsFor(activeExamId);
  const [loaded, setLoaded] = React.useState(false);
  const [entered, setEntered] = React.useState(false);
  const [now, setNow] = React.useState(Date.now);
  const [storageError, setStorageError] = React.useState(false);
  const [invalidDraft, setInvalidDraft] = React.useState(false);
  const [fontSize, setFontSize] = React.useState(16);
  const [activeQuestion, setActiveQuestion] = React.useState("");
  const [split, setSplit] = React.useState(50);
  const [contrast, setContrast] = React.useState("standard");
  const [optionsPage, setOptionsPage] = React.useState<"menu" | "contrast" | "font" | null>(null);
  const optionsRef = React.useRef<HTMLDialogElement>(null);
  const [preflight, setPreflight] = React.useState<ExamMode | null>(null);
  const [preflightStep, setPreflightStep] = React.useState(0);
  const [detailsChecked, setDetailsChecked] = React.useState(false);
  const [helpStep, setHelpStep] = React.useState<number | null>(null);
  const splitPane = React.useRef<HTMLDivElement>(null);
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [volume, setVolume] = React.useState(0.8);
  const [soundChecked, setSoundChecked] = React.useState(false);
  const [dialog, setDialog] = React.useState<"submit" | ExamMode | null>(null);
  const [xpEarned, setXpEarned] = React.useState<number | null>(null);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const sample = React.useRef<HTMLAudioElement>(null);
  const questionPane = React.useRef<HTMLDivElement>(null);
  const materialPane = React.useRef<HTMLElement>(null);
  const key = storageKey(owner, activeExamId);
  const labels = localizedText(SECTION_LABELS, locale) ?? SECTION_LABELS.en;

  const commit = React.useCallback(
    (next: ExamSession) => {
      current.current = next;
      setSession(next);
      if (next.status === "finished") {
        const set = sectionsFor(isExamId(next.examId) ? next.examId : EXAM_ID);
        const total = sectionIds(next.mode).reduce(
          (sum, id) =>
            sum + Math.max(set[id].questions.length, set[id].parts.length),
          0,
        );
        const xp = xpForExamPaper(total);
        setXpEarned(addXpOnce(`ielts-finish:${next.id}`, xp) ? xp : null);
      }
      try {
        localStorage.setItem(key, JSON.stringify(next));
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    },
    [key],
  );

  const cloud = useExamCloud<ExamSession, ExamSummary>({
    prefix: key,
    endpoint: "/api/ielts/attempts",
    account: user?.sub ?? null,
    loaded,
    session,
    current,
    commit,
  });
  const startDisabled =
    !loaded ||
    (!!user &&
      ["loading", "saving", "error", "conflict"].includes(cloud.status));
  function downloadDraft() {
    if (!current.current) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(current.current, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `ielts-draft-${current.current.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const cloudNotice = (
    <ExamSaveStatus
      status={cloud.status}
      onRetry={cloud.retry}
      onLogin={() => login("/ielts")}
      onBackup={downloadDraft}
      onUseServer={cloud.useServer}
      onGuest={() => void logout()}
    />
  );
  const syncWarning = cloud.status === "error" || cloud.status === "conflict";
  const saveLabel = storageError
    ? "Not saved in this browser"
    : cloud.status === "guest"
      ? "Saved in this browser"
      : examMessages(locale)[cloud.status];

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      const draft = parseSession(raw);
      if (raw && !draft) setInvalidDraft(true);
      if (draft) commit(reconcileSession(draft, Date.now()));
    } catch {
      setStorageError(true);
    }
    setLoaded(true);
  }, [key, commit]);

  React.useEffect(() => {
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (!current.current) return;
      const next = reconcileSession(current.current, time);
      if (next !== current.current) {
        commit(next);
        setDialog(null);
        setOptionsPage(null);
      }
    };
    const interval = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [commit]);

  React.useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== key) return;
      const other = parseSession(event.newValue);
      if (other) {
        if (other.id !== current.current?.id) setEntered(false);
        const next = reconcileSession(other, Date.now());
        current.current = next;
        setSession(next);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key]);

  React.useEffect(() => {
    if (!entered || session?.status !== "running") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [entered, session?.status]);

  React.useEffect(() => {
    if (dialog) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [dialog]);

  React.useEffect(() => {
    const element = optionsRef.current;
    if (optionsPage && element) {
      if (!element.open) element.showModal();
      else element.querySelector("h2")?.focus();
    } else element?.close();
  }, [optionsPage]);

  function change(update: (s: ExamSession) => ExamSession) {
    const old = current.current;
    if (!old || old.status !== "running") return;
    const valid = reconcileSession(old, Date.now());
    // An input received after a deadline cannot write into the completed section.
    commit(valid === old ? update(old) : valid);
  }

  async function start(mode: ExamMode) {
    if (!(await cloud.flush())) return;
    sample.current?.pause();
    const time = Date.now();
    commit(createSession(mode, time, crypto.randomUUID(), examId));
    setNow(time);
    setEntered(true);
    setDialog(null);
    setInvalidDraft(false);
    setPreflight(null);
  }

  async function prepare(mode: ExamMode) {
    if (!(await cloud.flush())) return;
    setPreflight(mode);
    setPreflightStep(0);
    setDetailsChecked(false);
    setSoundChecked(false);
    setDialog(null);
  }

  const ids = sectionIds(session?.mode ?? "reading");
  const section = sections[ids[session?.sectionIndex ?? 0]];
  const part = section.parts[session?.partIndex ?? 0];
  const questions = section.questions.filter((q) => q.partId === part.id);
  const passageText =
    section.id === "writing"
      ? part.content.split("\n\n").slice(1, -1).join("\n\n")
      : part.content;
  React.useEffect(() => {
    materialPane.current?.scrollTo({ top: 0 });
    questionPane.current?.scrollTo({ top: 0 });
  }, [part.id]);
  const remaining = Math.max(
    0,
    Math.ceil(((session?.deadline ?? now) - now) / 1000),
  );
  const answered =
    section.id === "writing"
      ? section.parts.filter((p) => session?.answers[p.id]?.trim()).length
      : section.questions.filter((q) => session?.answers[q.id]?.trim()).length;
  const total = section.id === "writing" ? 2 : section.questions.length;

  function jump(partIndex: number, questionId?: string) {
    change((s) => ({ ...s, partIndex }));
    if (questionId) setActiveQuestion(questionId);
    requestAnimationFrame(() => {
      if (questionId) {
        const element = document.getElementById(`question-${questionId}`);
        element?.scrollIntoView({ block: "start", behavior: "instant" });
        const input = element?.querySelector<HTMLInputElement>("input");
        if (input) input.focus({ preventScroll: true });
        else {
          element?.setAttribute("tabindex", "-1");
          element?.focus({ preventScroll: true });
        }
      } else questionPane.current?.scrollTo({ top: 0 });
    });
  }

  const warning = storageError ? (
    <p
      role="alert"
      className="border-b border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-900"
    >
      {t("ielts.storageFail")}
    </p>
  ) : null;
  const modal = (
    <dialog
      ref={dialogRef}
      onCancel={() => setDialog(null)}
      className="w-[min(92vw,460px)] rounded-xl border border-slate-200 p-6 shadow-xl backdrop:bg-slate-900/40"
      aria-labelledby="exam-dialog-title"
    >
      <h2 id="exam-dialog-title" className="text-xl font-bold">
        {dialog === "submit"
          ? t("ielts.confirmSubmitSection")
          : t("ielts.confirmNewTest")}
      </h2>
      <p className="my-4 text-sm leading-7 text-slate-600">
        {dialog === "submit"
          ? t("ielts.confirmUnanswered", {
              count: total - answered,
              next:
                session && session.sectionIndex < ids.length - 1
                  ? t("ielts.confirmNextTimed")
                  : "",
            })
          : user ? t("ielts.confirmReplaceAccount") : t("ielts.confirmReplaceGuest")}
      </p>
      <div className="flex justify-end gap-3">
        <button
          className="ielts-button"
          autoFocus
          onClick={() => setDialog(null)}
        >
          {t("common.cancel")}
        </button>
        <button
          className="ielts-button !border-blue-700 !bg-blue-700 !text-white"
          onClick={() => {
            if (dialog === "submit") {
              change((s) => finishSection(s, Date.now()));
              setDialog(null);
            } else if (dialog) prepare(dialog);
          }}
        >
          {t("common.confirm")}
        </button>
      </div>
    </dialog>
  );

  if (entered && session?.status === "finished")
    return (
      <>
        {warning}
        {cloudNotice}
        {xpEarned !== null && (
          <XpAward
            amount={xpEarned}
            className="mx-auto mt-4 max-w-6xl rounded-xl bg-emerald-50 px-4 py-4 text-emerald-900 sm:px-6"
          />
        )}
        <ExamResults
          session={session}
          locale={locale}
          onBack={() => setEntered(false)}
        />
      </>
    );

  if (preflight)
    return (
      <main className="exam-preflight" dir="ltr">
        {syncWarning && cloudNotice}
        <header className="exam-header">
          <span className="exam-wordmark">
            LingoLearn<span>IELTS PRACTICE</span>
          </span>
          <strong>Test taker ID EL000001</strong>
        </header>
        <div className="mx-auto max-w-3xl px-6 py-16">
          <p className="mb-5 text-sm text-slate-500">
            {t("ielts.pretest")}
          </p>
          <ol
            aria-label="Pre-test steps"
            className="mb-8 flex gap-3 border-b border-slate-200 pb-5 text-xs sm:gap-6 sm:text-sm"
          >
            {[
              { step: 0, label: "Details" },
              ...(preflight === "full" || preflight === "listening"
                ? [{ step: 1, label: "Sound" }]
                : []),
              { step: 2, label: "Instructions" },
            ].map(({ step, label }, i) => (
              <li
                key={step}
                aria-current={preflightStep === step ? "step" : undefined}
                className={`flex items-center gap-2 ${preflightStep === step ? "font-bold text-slate-950" : "text-slate-500"}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${preflightStep === step ? "bg-slate-900 text-white" : "bg-slate-100"}`}
                >
                  {preflightStep > step ? "✓" : i + 1}
                </span>
                {label}
              </li>
            ))}
          </ol>
          {preflightStep === 0 ? (
            <>
              <h1 className="mb-8 text-3xl font-bold">Confirm your details</h1>
              <dl className="mb-8 grid grid-cols-2 gap-4 border-y py-6">
                <dt>Name</dt>
                <dd>Practice Candidate</dd>
                <dt>Test taker ID</dt>
                <dd>EL000001</dd>
                <dt>Test</dt>
                <dd>IELTS Academic · {labels[preflight]}</dd>
              </dl>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={detailsChecked}
                  onChange={(e) => setDetailsChecked(e.target.checked)}
                />
                My details are correct.
              </label>
              <p className="mt-4 text-sm text-slate-500">
                {t("ielts.practiceId")}
              </p>
            </>
          ) : preflightStep === 1 ? (
            <>
              <h1 className="mb-6 text-3xl font-bold">Check your sound</h1>
              <p className="mb-6">
                Put on your headphones. Play the sample and adjust the volume
                until you can hear it clearly.
              </p>
              <audio
                ref={sample}
                controls
                src={sectionsFor(examId).listening.parts[0].audio}
                className="w-full"
              />
              <label className="mt-6 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={soundChecked}
                  onChange={(e) => setSoundChecked(e.target.checked)}
                />
                I can hear the sound clearly.
              </label>
            </>
          ) : (
            <>
              <h1 className="mb-8 text-3xl font-bold">
                {preflight === "full"
                  ? "Listening, Reading and Writing"
                  : `${preflight[0].toUpperCase()}${preflight.slice(1)}`}{" "}
                — Instructions
              </h1>
              <ul className="list-disc space-y-3 pl-5 leading-6">
                <li>
                  {preflight === "writing"
                    ? "Complete both writing tasks within 60 minutes."
                    : "Answer every question, following the instructions for each group."}
                </li>
                {preflight === "writing" && (
                  <li>Task 1: 150 words minimum, about 20 minutes. Task 2: 250 words minimum, about 40 minutes. Use connected paragraphs.</li>
                )}
                {preflight === "full" && (
                  <li>Reading and Writing each allow 60 minutes.</li>
                )}
                <li>
                  {preflight === "writing"
                    ? "In the official exam, Task 2 carries twice the weight of Task 1."
                    : preflight === "reading"
                      ? "You have 60 minutes for the three reading passages."
                      : "Listening follows this practice recording, with 30 seconds to preview each part and 2 minutes for a final check."}
                </li>
                <li>
                  Move freely within the section. After submission, answers are locked.
                  The timer keeps running when you leave or refresh.
                </li>
                {(preflight === "listening" || preflight === "full") && (
                  <li>Returning to Listening resumes the recording at the current test time.</li>
                )}
              </ul>
              <p className="mt-6 border-l-4 border-slate-300 pl-4 text-sm leading-6 text-slate-500">
                {t("ielts.fidelity")}
              </p>
            </>
          )}
          <div className="mt-10 flex justify-between">
            <button
              className="ielts-button"
              onClick={() => {
                sample.current?.pause();
                setPreflight(null);
              }}
            >
              {t("ielts.backToTests")}
            </button>
            <button
              className="ielts-button !border-black !bg-black !text-white"
              disabled={
                preflightStep === 0
                  ? !detailsChecked
                  : preflightStep === 1
                    ? !soundChecked
                    : false
              }
              onClick={() => {
                sample.current?.pause();
                if (preflightStep === 0)
                  setPreflightStep(
                    preflight === "full" || preflight === "listening" ? 1 : 2,
                  );
                else if (preflightStep === 1) setPreflightStep(2);
                else start(preflight);
              }}
            >
              {preflightStep === 2 ? "Start test" : "Continue"}
            </button>
          </div>
        </div>
      </main>
    );

  if (!entered || !session)
    return (
      <PageShell active="ielts" title="IELTS Academic" wide>
        {warning}
        <h1 className="sr-only">IELTS Academic</h1>
        <div className="my-3 text-xs text-slate-500">{EXAM_LABELS[session && isExamId(session.examId) ? session.examId : examId]}</div>
        <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2">
          <h2 className="text-sm font-semibold">{t("ieltsPrep.title")}</h2>
          <Link to="/learn" search={{ tab: "ielts" }} className="ielts-button">{t("ieltsPrep.open")} →</Link>
        </section>
        {!session && (
          <div
            className="mb-4 flex flex-wrap gap-3"
            role="group"
            aria-label="Practice set"
          >
            {EXAM_IDS.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={examId === id}
                onClick={() => setExamId(id)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${examId === id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}
              >
                {EXAM_LABELS[id]}
              </button>
            ))}
          </div>
        )}
        {loaded && session && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 p-5">
            <div>
              <h2 className="font-semibold">
                {session.status === "finished"
                  ? t("ielts.prevComplete")
                  : t("ielts.inProgressNote")}
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                {EXAM_LABELS[session && isExamId(session.examId) ? session.examId : examId]} · {labels[session.mode]} ·{" "}
                {new Date(session.startedAt).toLocaleString(locale)}
                {session.status === "running" &&
                  (t("ielts.timerRunning"))}
              </p>
            </div>
            <button
              className="ielts-button !border-blue-700 !bg-blue-700 !text-white"
              onClick={() => {
                commit(reconcileSession(session, Date.now()));
                setEntered(true);
              }}
            >
              {session.status === "finished"
                ? t("ielts.viewReview")
                : t("ielts.resumeTest")}
            </button>
          </div>
        )}
        {invalidDraft && (
          <p role="status" className="mt-4 text-sm text-amber-800">
            {t("ielts.invalidDraft")}
          </p>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            <article
              className="rounded-2xl bg-slate-900 p-4 text-white shadow-sm sm:p-5"
              dir="ltr"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-widest text-blue-200">
                    LISTENING → READING → WRITING
                  </p>
                  <h2 className="mt-2 text-lg font-semibold sm:text-xl">
                    {t("ielts.fullRehearsal")}
                  </h2>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-2 text-sm font-medium text-slate-100">
                  {t("ielts.aboutMin", {
                    min: 120 + sections.listening.minutes,
                  })}
                </span>
              </div>
              <div className="my-6 grid grid-cols-3 divide-x divide-white/15 rounded-xl border border-white/15 bg-white/5 py-4">
                {(["listening", "reading", "writing"] as const).map((id, i) => (
                  <div key={id} className="px-3 sm:px-4">
                    <p className="text-xs text-slate-300">
                      0{i + 1} · {labels[id]}
                    </p>
                    <p className="mt-2 text-lg font-semibold tabular-nums">
                      {sections[id].minutes}
                      <span className="ml-1 text-xs font-normal text-slate-300">
                        {t("common.minutes")}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="max-w-xs text-xs leading-6 text-slate-300">
                  {t("ielts.sectionsNote")}
                </p>
                <button
                  className="ielts-button w-full !border-white !bg-white !text-slate-900 hover:!bg-blue-50 sm:w-auto"
                  disabled={startDisabled}
                  onClick={() =>
                    session ? setDialog("full") : prepare("full")
                  }
                >
                  {t("ielts.startFull")}
                  <span className="ml-3" aria-hidden="true">
                    →
                  </span>
                </button>
              </div>
            </article>
            <section
              aria-labelledby="single-skill-heading"
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                <h2
                  id="single-skill-heading"
                  className="font-semibold text-slate-900"
                >
                  {t("ielts.singleTitle")}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {t("ielts.singleHint")}
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {(["listening", "reading", "writing"] as const).map(
                  (mode, i) => (
                    <article
                      key={mode}
                      className="flex flex-wrap items-center gap-4 px-5 py-5 sm:px-6"
                    >
                      <span
                        aria-hidden="true"
                        className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-sm font-semibold text-slate-500 sm:flex"
                      >
                        0{i + 1}
                      </span>
                      <div className="min-w-0 flex-1 basis-40">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h3 className="font-bold text-slate-900">
                            {labels[mode]}
                          </h3>
                          <span className="text-xs tabular-nums text-slate-500">
                            {mode === "listening" ? "~" : ""}
                            {sections[mode].minutes} {t("common.minutes")}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs leading-6 text-slate-600">
                          {localizedText(SECTION_SUMMARIES, locale)?.[i]}
                        </p>
                      </div>
                      <button
                        className="ielts-button !border-blue-200 !text-blue-800 hover:!bg-blue-50"
                        disabled={startDisabled}
                        onClick={() =>
                          session ? setDialog(mode) : prepare(mode)
                        }
                      >
                        {t("ielts.start")} {labels[mode]}
                      </button>
                    </article>
                  ),
                )}
              </div>
            </section>
          </div>
          <aside className="space-y-5">
            <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
              <p className="text-xs font-semibold tracking-widest text-blue-700">
                {t("ielts.newBadge")}
              </p>
              <h2 className="mt-3 text-lg font-bold text-slate-900">
                {t("ielts.guideTitle")}
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {t("ielts.guideDesc")}
              </p>
              <button
                className="ielts-button mt-4 w-full !border-blue-200 !bg-white !text-blue-800"
                disabled={startDisabled}
                onClick={() => {
                  setHelpStep(0);
                  if (session) setDialog("reading");
                  else prepare("reading");
                }}
              >
                {t("ielts.guideCta")}
              </button>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {t("ielts.clockNote")}
              </p>
            </section>
            <section
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              aria-label={t("ielts.storageLabel")}
            >
              <div className="p-5">
                <h2 className="font-semibold text-slate-900">
                  {user ? t("ielts.syncTitle") : t("ielts.syncTitleGuest")}
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {user
                    ? t("ielts.syncDesc")
                    : t("ielts.signinDesc")}
                </p>
                {!user && (
                  <button
                    disabled={!configured}
                    className="ielts-button mt-4 w-full"
                    onClick={() => login("/ielts")}
                  >
                    {configured
                      ? t("ielts.signinWid")
                      : t("ielts.signinMissing")}
                  </button>
                )}
              </div>
              {cloudNotice}
            </section>
          </aside>
        </div>
        {user && cloud.history && (
          <section
            className="mt-5 rounded-xl border bg-white p-5"
            aria-label={t("ielts.historyLabel")}
          >
            <h2 className="font-semibold">
              {t("ielts.historyTitle")}{" "}
              <span className="text-sm font-normal text-slate-500">
                ({cloud.history.total})
              </span>
            </h2>
            {!cloud.history.total && (
              <p className="mt-3 text-sm text-slate-500">
                {t("ielts.historyEmpty")}
              </p>
            )}
            <ul className="mt-3 divide-y">
              {cloud.history.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <strong className="text-sm">
                      {EXAM_LABELS[isExamId(item.examId) ? item.examId : EXAM_ID]} · {labels[item.mode]}
                    </strong>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(item.startedAt).toLocaleString(locale)} ·{" "}
                      {item.status === "finished"
                        ? t("ielts.statusDone")
                        : t("ielts.statusRunning")}
                    </p>
                  </div>
                  <button
                    className="ielts-button"
                    disabled={[
                      "loading",
                      "saving",
                      "error",
                      "conflict",
                    ].includes(cloud.status)}
                  onClick={async () => {
                    if (await cloud.open(item.id)) {
                      const opened = current.current;
                      if (opened && isExamId(opened.examId))
                        setExamId(opened.examId);
                      setEntered(true);
                    }
                  }}
                  >
                    {item.status === "finished"
                      ? t("ielts.viewSheet")
                      : t("ielts.resumeSheet")}
                  </button>
                </li>
              ))}
            </ul>
            {cloud.history.totalPages > 1 && (
              <div className="mt-3 flex items-center justify-end gap-3">
                <button
                  className="ielts-button"
                  disabled={cloud.history.page <= 1}
                  onClick={() =>
                    void cloud.readHistory(cloud.history!.page - 1)
                  }
                >
                  {t("pagination.prev")}
                </button>
                <span className="text-xs">
                  {cloud.history.page} / {cloud.history.totalPages}
                </span>
                <button
                  className="ielts-button"
                  disabled={cloud.history.page >= cloud.history.totalPages}
                  onClick={() =>
                    void cloud.readHistory(cloud.history!.page + 1)
                  }
                >
                  {t("pagination.next")}
                </button>
              </div>
            )}
          </section>
        )}

        <div className="mt-6 rounded-xl border border-slate-200/80 px-5 py-4 text-xs leading-6 text-slate-600">
          <p className="font-semibold text-slate-800">
            {t("ielts.aboutTitle")}
          </p>
          <p className="mt-1">
            {t("ielts.aboutDesc")}
          </p>
        </div>
        <ExamSources />
        {modal}
      </PageShell>
    );

  const active =
    activeQuestion && questions.some((q) => q.id === activeQuestion)
      ? activeQuestion
      : (questions[0]?.id ?? part.id);
  const activeIndex = section.questions.findIndex((q) => q.id === active);
  function move(direction: number) {
    if (section.id === "writing") {
      jump(Math.max(0, Math.min(1, session!.partIndex + direction)));
      return;
    }
    const q = section.questions[activeIndex + direction];
    if (q)
      jump(
        section.parts.findIndex((p) => p.id === q.partId),
        q.id,
      );
  }
  function answer(id: string, value: string) {
    change((s) => {
      const answers = { ...s.answers, [id]: value };
      const q = section.questions.find((q) => q.id === id);
      if (value && q?.type === "matching-headings") {
        for (const other of section.questions)
          if (
            other.id !== id &&
            other.groupId === q.groupId &&
            answers[other.id] === value
          )
            answers[other.id] = "";
      }
      return { ...s, answers };
    });
  }
  const guide = localizedText(GUIDE_STEPS, locale) ?? GUIDE_STEPS.en;
  return (
    <main className={`ielts-exam contrast-${contrast}`} dir="ltr">
      <header className="exam-header">
        <div className="exam-identity">
          <span className="exam-wordmark">LingoLearn</span>
          <div className="exam-candidate">
            <strong className="hidden sm:block">
              Test taker ID <span className="font-normal">EL000001</span>
            </strong>
            <div
              role="timer"
              aria-label="Time remaining"
              className={`exam-timer ${remaining <= 300 ? "time-low" : ""}`}
            >
              {String(Math.floor(remaining / 60)).padStart(2, "0")}:
              {String(remaining % 60).padStart(2, "0")}
              <span>remaining</span>
            </div>
          </div>
        </div>
        <div className="exam-tools">
          <span role="status" title={saveLabel} aria-label={saveLabel} className="exam-icon">
            {storageError || syncWarning ? "⚠" : (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0" />
                <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
              </svg>
            )}
          </span>
          <details className="exam-messages">
            <summary className="exam-icon" aria-label="Messages" title="Messages">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M5 17h14l-2-3V9a5 5 0 0 0-4-5V2h-2v2a5 5 0 0 0-4 5v5ZM10 20a2 2 0 0 0 4 0" />
              </svg>
            </summary>
            <p role="status">{saveLabel}</p>
          </details>
          <button className="exam-icon" aria-label="Options" title="Options" onClick={() => setOptionsPage("menu")}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 5h18M3 12h18M3 19h18" />
            </svg>
          </button>
        </div>
      </header>
      {warning}
      {syncWarning && cloudNotice}
      <div className="exam-instructions">
        <strong>Part {session.partIndex + 1}</strong>
        <p>
          {section.id === "writing"
            ? `You should spend about ${session.partIndex === 0 ? 20 : 40} minutes on this task. Write at least ${part.minWords} words.`
            : `Read ${section.id === "reading" ? "the text and answer" : "the questions and listen to the recording for"} questions ${questions[0]?.number}–${questions[questions.length - 1]?.number}.`}
        </p>
      </div>
      <div
        ref={splitPane}
        className={`exam-panes ${section.id === "listening" ? "is-listening" : ""}`}
        style={{ "--exam-split": `${split}%`, fontSize } as React.CSSProperties}
      >
        <section
          ref={materialPane}
          className="exam-material"
          aria-label="Test material"
        >
          {section.id === "listening" ? (
            <>
              <ExamAudio
                key={session.id}
                deadline={session.deadline}
                now={now}
                volume={volume}
                examId={activeExamId}
              />
              <label className="flex items-center gap-3 text-sm">
                Volume{" "}
                <input
                  aria-label="Volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
              </label>
            </>
          ) : (
            <>
              {section.id === "reading" && (
                <h2 className="mb-4 font-bold">{part.title}</h2>
              )}
              <ExamPassage
                key={part.id}
                text={passageText}
                highlights={session.highlights[part.id] ?? []}
                enabled
                onNote={(selected) => {
                  setNotesOpen(true);
                  change((s) => ({
                    ...s,
                    notes: {
                      ...s.notes,
                      [part.id]:
                        `${s.notes[part.id] ?? ""}${s.notes[part.id] ? "\n\n" : ""}“${selected}”\n`.slice(
                          0,
                          10000,
                        ),
                    },
                  }));
                }}
                onChange={(ranges) =>
                  change((s) => ({
                    ...s,
                    highlights: { ...s.highlights, [part.id]: ranges },
                  }))
                }
              />
              {part.id === "task-1" && <ExamWritingTable examId={activeExamId} />}
            </>
          )}
        </section>
        <div
          role="separator"
          aria-label="Resize passage and answers"
          aria-orientation="vertical"
          aria-valuemin={30}
          aria-valuemax={70}
          aria-valuenow={split}
          tabIndex={0}
          className="exam-divider"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              setSplit((n) =>
                Math.max(
                  30,
                  Math.min(70, n + (e.key === "ArrowLeft" ? -2 : 2)),
                ),
              );
            }
          }}
          onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
          onPointerMove={(e) => {
            if (
              !e.currentTarget.hasPointerCapture(e.pointerId) ||
              !splitPane.current
            )
              return;
            const bounds = splitPane.current.getBoundingClientRect();
            setSplit(
              Math.max(
                30,
                Math.min(70, ((e.clientX - bounds.left) / bounds.width) * 100),
              ),
            );
          }}
          onPointerUp={(e) =>
            e.currentTarget.releasePointerCapture(e.pointerId)
          }
        >
          <span>↔</span>
        </div>
        <section
          ref={questionPane}
          className="exam-answers"
          aria-label="Answer area"
        >
          {section.id === "listening" && (
            <h2 className="mb-6 font-bold">{part.title}</h2>
          )}
          {section.id === "writing" ? (
            <div className="exam-writing">
              <label htmlFor="writing-answer" className="sr-only">
                {part.title} response
              </label>
              <textarea
                id="writing-answer"
                aria-label={`${part.title} response`}
                value={session.answers[part.id] ?? ""}
                spellCheck={false}
                autoCorrect="off"
                autoComplete="off"
                autoCapitalize="off"
                lang="en"
                maxLength={30000}
                onChange={(e) => answer(part.id, e.target.value)}
              />
              <p className="text-right">
                Words: {wordCount(session.answers[part.id] ?? "")}
              </p>
            </div>
          ) : (
            <ExamQuestions
              questions={questions}
              answers={session.answers}
              flags={session.flags}
              examId={activeExamId}
              active={active}
              onAnswer={answer}
              onFlag={(id) =>
                change((s) => ({
                  ...s,
                  flags: s.flags.includes(id)
                    ? s.flags.filter((f) => f !== id)
                    : [...s.flags, id],
                }))
              }
              onFocus={setActiveQuestion}
            />
          )}
        </section>
        {notesOpen && (
          <aside className="exam-notes">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">
                Notes · Part {session.partIndex + 1}
              </h2>
              <button
                className="exam-icon"
                aria-label="Close notes"
                onClick={() => setNotesOpen(false)}
              >
                ×
              </button>
            </div>
            <label className="sr-only" htmlFor="exam-notes">
              Notes for this part
            </label>
            <textarea
              id="exam-notes"
              value={session.notes[part.id] ?? ""}
              maxLength={10000}
              onChange={(e) =>
                change((s) => ({
                  ...s,
                  notes: { ...s.notes, [part.id]: e.target.value },
                }))
              }
              placeholder="Your notes…"
            />
          </aside>
        )}
      </div>
      <div className="exam-arrows">
        <button
          aria-label="Previous question"
          disabled={
            section.id === "writing"
              ? session.partIndex === 0
              : activeIndex <= 0
          }
          onClick={() => move(-1)}
        >
          ➜
        </button>
        <button
          aria-label="Next question"
          disabled={
            section.id === "writing"
              ? session.partIndex === 1
              : activeIndex >= section.questions.length - 1
          }
          onClick={() => move(1)}
        >
          ➜
        </button>
      </div>
      <footer className="exam-footer">
        <nav aria-label="Question navigation">
          {section.parts.map((p, index) => {
            const qs =
              section.id === "writing"
                ? [{ id: p.id, number: index + 1 }]
                : section.questions.filter((q) => q.partId === p.id);
            const count = qs.filter((q) =>
              session.answers[q.id]?.trim(),
            ).length;
            return (
              <div
                key={p.id}
                className={`exam-part ${index === session.partIndex ? "is-current" : ""}`}
              >
                <button
                  className="exam-part-tab"
                  onClick={() => jump(index)}
                  aria-current={
                    session.partIndex === index ? "step" : undefined
                  }
                >
                  Part {index + 1}
                  {index !== session.partIndex && (
                    <span>
                      {count} of {qs.length}
                    </span>
                  )}
                </button>
                {index === session.partIndex && section.id !== "writing" && (
                  <div className="exam-question-nav">
                    {qs.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => jump(index, q.id)}
                        className={`${active === q.id ? "is-active" : ""} ${session.answers[q.id]?.trim() ? "is-answered" : ""} ${session.flags.includes(q.id) ? "is-flagged" : ""}`}
                        aria-label={`Question ${q.number}, ${session.answers[q.id]?.trim() ? "answered" : "unanswered"}${session.flags.includes(q.id) ? ", flagged" : ""}`}
                        aria-current={active === q.id ? "step" : undefined}
                      >
                        {q.number}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <button
          className="exam-submit"
          aria-label="Submit section"
          title="Submit section"
          onClick={() => setDialog("submit")}
        >
          ✓
        </button>
      </footer>
      {optionsPage && (
        <dialog
          ref={optionsRef}
          className="exam-options"
          aria-labelledby="options-title"
          onCancel={() => setOptionsPage(null)}
        >
          <h2 id="options-title" tabIndex={-1}>{optionsPage === "contrast" ? "Contrast" : optionsPage === "font" ? "Text size" : "Options"}</h2>
          {optionsPage !== "menu" && (
            <button className="exam-options-back" aria-label="Back to options" onClick={() => setOptionsPage("menu")}>‹</button>
          )}
          <button
            className="exam-close"
            aria-label="Close options"
            autoFocus
            onClick={() => setOptionsPage(null)}
          >
            ×
          </button>
          <div className="exam-options-list">
            {optionsPage === "menu" && <>
              <button className="exam-options-submit" onClick={() => { setOptionsPage(null); setDialog("submit"); }}>
                <span aria-hidden="true">➤</span>Go to submission page<span aria-hidden="true">›</span>
              </button>
              <div className="exam-options-menu">
                <button onClick={() => setOptionsPage("contrast")}><span aria-hidden="true">◐</span>Contrast<span aria-hidden="true">›</span></button>
                <button onClick={() => setOptionsPage("font")}><span aria-hidden="true">⊕</span>Text size<span aria-hidden="true">›</span></button>
              </div>
              <div className="exam-options-secondary">
                <button onClick={() => { setOptionsPage(null); setNotesOpen((v) => !v); }}>{notesOpen ? "Hide notes" : "Show notes"}</button>
                <button onClick={() => { setOptionsPage(null); setHelpStep(0); }}>{t("ielts.helpTitle")}</button>
                <button onClick={() => { setOptionsPage(null); setEntered(false); }}>Leave test (timer continues)</button>
              </div>
            </>}
            {optionsPage === "contrast" && <fieldset>
              <legend className="sr-only">Contrast</legend>
              {[
                ["standard", "Black on white"],
                ["dark", "White on black"],
                ["yellow", "Yellow on black"],
              ].map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="contrast"
                    checked={contrast === value}
                    onChange={() => setContrast(value)}
                  />{" "}
                  {label}
                </label>
              ))}
            </fieldset>}
            {optionsPage === "font" && <fieldset>
              <legend className="sr-only">Text size</legend>
              {[
                [16, "Regular"],
                [20, "Large"],
                [24, "Extra large"],
              ].map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="font"
                    checked={fontSize === value}
                    onChange={() => setFontSize(Number(value))}
                  />{" "}
                  {label}
                </label>
              ))}
            </fieldset>}
          </div>
        </dialog>
      )}
      {helpStep !== null && (
        <div
          className="exam-help"
          role="dialog"
          aria-modal="false"
          aria-labelledby="help-title"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 id="help-title" className="font-bold">
              {guide[helpStep][0]}
            </h2>
            <button aria-label="Close help" onClick={() => setHelpStep(null)}>
              ×
            </button>
          </div>
          <p className="my-3 text-sm leading-7">{guide[helpStep][1]}</p>
          <p className="mb-3 text-xs text-slate-500">
            {t("ielts.guideOverlay")}
          </p>
          <div className="flex justify-end gap-3">
            <button
              disabled={helpStep === 0}
              className="ielts-button"
              onClick={() => setHelpStep(helpStep - 1)}
            >
              ←
            </button>
            <button
              className="ielts-button"
              onClick={() =>
                helpStep === 4 ? setHelpStep(null) : setHelpStep(helpStep + 1)
              }
            >
              {helpStep === 4 ? (t("ielts.guideDone")) : "→"}
            </button>
          </div>
        </div>
      )}
      {modal}
    </main>
  );
}

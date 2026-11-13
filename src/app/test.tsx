import { QuestionFeedback } from "@/components/learning/QuestionFeedback";
import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { parseTestSearch } from "@/lib/routes/search";
import type { ClientItem, ClientResponse, ModuleType } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ProgressBar,
} from "@/components/ui";
import { ItemRenderer } from "@/components/itemRenderers";
import { PageShell } from "@/components/layout/PageShell";
import { CoursePicker } from "@/components/learn/CoursePicker";
import { ProgressStrip } from "@/components/learn/ProgressStrip";
import { AttemptsBar } from "@/components/learn/AttemptsBar";
import { AnswerFeedback } from "@/components/test/AnswerFeedback";
import { XpFloat } from "@/components/test/XpFloat";
import { addXp, recordAnswerXp } from "@/lib/gamification/store";
import { useI18n } from "@/lib/i18n/context";
import { isCoursePlayable } from "@/lib/i18n/languages";
import { MAX_HEARTS } from "@/lib/gamification/xp";
import {
  clearStoredSessionId,
  getStoredSessionId,
  setStoredSessionId,
} from "@/lib/client/active-session";
import {
  abandonTestSession,
  createTestSession,
  fetchSessionResume,
  scoreOpenItem,
  submitTestResponse,
} from "@/lib/client/api";
import { resultsRoute } from "@/lib/routes/navigation";
import type { ItemFormat } from "@/lib/types";

const MODULE_ORDER: ModuleType[] = [
  "vocabulary",
  "grammar",
  "reading",
  "listening",
  "speaking",
  "writing",
];

// Soft per-module cap used purely for the progress UI (server controls real stop).
const MAX_ITEMS_PER_MODULE = 15;

const PRESETS: Array<{
  id: string;
  labelKey: string;
  descKey: string;
  modules: ModuleType[];
}> = [
  {
    id: "quick",
    labelKey: "test.presetQuick",
    descKey: "test.presetQuickDesc",
    modules: ["vocabulary", "grammar"],
  },
  {
    id: "core",
    labelKey: "test.presetCore",
    descKey: "test.presetCoreDesc",
    modules: ["vocabulary", "grammar", "reading", "listening"],
  },
  {
    id: "full",
    labelKey: "test.presetFull",
    descKey: "test.presetFullDesc",
    modules: MODULE_ORDER,
  },
];

type Phase = "select" | "running";

interface ResumeInfo {
  learningLanguage?: string;
  sessionId: string;
  modules: ModuleType[];
  currentModule: ModuleType;
  moduleCounts: Record<string, number>;
  item: ClientItem | null;
  createdAt?: string;
}

interface LastGrade {
  attemptLost: boolean;
  correct: boolean;
  format: ItemFormat;
  aiScore?: number;
  aiFeedback?: string;
  xpEarned?: number;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export const Route = createFileRoute("/test")({
  validateSearch: parseTestSearch,
  component: TestPage,
});

function TestPage() {
  const searchModules = Route.useSearch().modules;
  const navigate = useNavigate();
  const { t, courseName, learningLanguage, setLearningLanguage, locale } =
    useI18n();
  const courseAvailable = isCoursePlayable(learningLanguage);
  const lifecycleGeneration = React.useRef(0);

  React.useEffect(() => () => {
    // Account changes remount this page. In-flight callbacks still resolve,
    // but must not award XP, replace the resume link, or navigate afterwards.
    lifecycleGeneration.current += 1;
  }, []);

  const [phase, setPhase] = React.useState<Phase>("select");
  const [selected, setSelected] = React.useState<Set<ModuleType>>(() => {
    if (searchModules?.length) {
      return new Set(MODULE_ORDER.filter((m) => searchModules.includes(m)));
    }
    return new Set(PRESETS[0].modules);
  });

  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [item, setItem] = React.useState<ClientItem | null>(null);
  const [currentModule, setCurrentModule] = React.useState<ModuleType | null>(
    null,
  );

  // Per-module answered counters, for the progress display.
  const [moduleCounts, setModuleCounts] = React.useState<
    Record<string, number>
  >({});
  const [activeModules, setActiveModules] = React.useState<ModuleType[]>([]);

  const [submitting, setSubmitting] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resumeInfo, setResumeInfo] = React.useState<ResumeInfo | null>(null);
  const [checkingResume, setCheckingResume] = React.useState(true);
  const [resumeFailed, setResumeFailed] = React.useState(false);
  const [resumeCheck, setResumeCheck] = React.useState(0);
  const dismissFeedback = React.useCallback(() => setLastGrade(null), []);
  const [lastGrade, setLastGrade] = React.useState<LastGrade | null>(null);
  const [hearts, setHearts] = React.useState(MAX_HEARTS);
  const [xpFloat, setXpFloat] = React.useState<number | null>(null);
  const [activePreset, setActivePreset] = React.useState<string | null>(() => {
    const modules = searchModules?.length ? searchModules : PRESETS[0].modules;
    return (
      PRESETS.find(
        (p) =>
          p.modules.length === modules.length &&
          p.modules.every((m) => modules.includes(m)),
      )?.id ?? null
    );
  });
  const [sessionStartedAt, setSessionStartedAt] = React.useState<string | null>(
    null,
  );
  const [elapsedSec, setElapsedSec] = React.useState(0);
  const [moduleNotice, setModuleNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (phase !== "running" || !sessionStartedAt) return;
    const tick = () =>
      setElapsedSec(
        Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(sessionStartedAt).getTime()) / 1000,
          ),
        ),
      );
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [phase, sessionStartedAt]);

  React.useEffect(() => {
    let cancelled = false;
    setCheckingResume(true);
    setResumeFailed(false);
    const sid = getStoredSessionId();
    if (!sid) {
      setCheckingResume(false);
      return;
    }
    (async () => {
      try {
        const data = await fetchSessionResume(sid);
        if (cancelled) return;
        if (!data) {
          clearStoredSessionId();
          return;
        }
        if (data.finished) {
          clearStoredSessionId();
          void navigate(resultsRoute(data.sessionId));
          return;
        }
        if (!data.item) throw new Error("Saved session has no pending item");
        if (!cancelled) {
          setResumeInfo({
            sessionId: data.sessionId,
            learningLanguage: data.learningLanguage,
            modules: data.modules,
            currentModule: data.currentModule,
            moduleCounts: data.moduleCounts,
            item: data.item,
            createdAt: data.createdAt,
          });
        }
      } catch {
        if (!cancelled) setResumeFailed(true);
      } finally {
        if (!cancelled) setCheckingResume(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, resumeCheck]);

  function applyPreset(presetId: string) {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setActivePreset(presetId);
    setSelected(new Set(preset.modules));
  }

  async function abandonSession(sessionId: string | null) {
    if (starting) return;
    const generation = lifecycleGeneration.current;
    setStarting(true);
    setError(null);
    try {
      if (sessionId && !(await abandonTestSession(sessionId)))
        throw new Error();
    } catch {
      if (generation !== lifecycleGeneration.current) return;
      setError(t("common.deleteFailed"));
      setStarting(false);
      return;
    }
    if (generation !== lifecycleGeneration.current) return;
    setStarting(false);
    clearStoredSessionId();
    setResumeInfo(null);
    setSessionId(null);
    setPhase("select");
    setItem(null);
    setLastGrade(null);
  }

  /* --------------------------- selection --------------------------- */

  function toggle(key: ModuleType) {
    setActivePreset(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const orderedSelected = MODULE_ORDER.filter((k) => selected.has(k));

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, "0");
    return t("test.elapsed", { time: `${m}:${s}` });
  };

  async function start() {
    if (
      orderedSelected.length === 0 ||
      starting ||
      checkingResume ||
      resumeFailed ||
      resumeInfo ||
      !courseAvailable
    )
      return;
    const generation = lifecycleGeneration.current;
    setStarting(true);
    setError(null);
    try {
      const data = await createTestSession(orderedSelected, learningLanguage);
      if (generation !== lifecycleGeneration.current) return;
      if (!data) throw new Error(t("test.sessionFail"));

      if (!data.item) {
        throw new Error(t("test.noItems"));
      }

      setSessionId(data.sessionId);
      setStoredSessionId(data.sessionId);
      setSessionStartedAt(new Date().toISOString());
      setResumeInfo(null);
      setLastGrade(null);
      setHearts(MAX_HEARTS);
      setModuleNotice(null);
      setActiveModules(orderedSelected);
      setModuleCounts(Object.fromEntries(orderedSelected.map((m) => [m, 0])));
      setItem(data.item);
      setCurrentModule(data.currentModule);
      setPhase("running");
    } catch (e) {
      if (generation === lifecycleGeneration.current)
        setError(e instanceof Error ? e.message : t("test.startFail"));
    } finally {
      if (generation === lifecycleGeneration.current) setStarting(false);
    }
  }

  async function resumeSession() {
    if (!resumeInfo || starting) return;
    setStarting(true);
    setError(null);
    try {
      if (resumeInfo.learningLanguage)
        setLearningLanguage(resumeInfo.learningLanguage);
      setSessionId(resumeInfo.sessionId);
      setStoredSessionId(resumeInfo.sessionId);
      setSessionStartedAt(resumeInfo.createdAt ?? new Date().toISOString());
      setActiveModules(resumeInfo.modules);
      setModuleCounts(resumeInfo.moduleCounts);
      setItem(resumeInfo.item);
      setCurrentModule(resumeInfo.currentModule);
      setSelected(new Set(resumeInfo.modules));
      setResumeInfo(null);
      setLastGrade(null);
      setHearts(MAX_HEARTS);
      setPhase("running");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("test.resumeFail"));
    } finally {
      setStarting(false);
    }
  }

  /* ---------------------------- runner ----------------------------- */

  const handleAnswer = React.useCallback(
    async (resp: ClientResponse) => {
      if (!sessionId || !item || submitting) return;
      const generation = lifecycleGeneration.current;
      setSubmitting(true);
      setError(null);
      setLastGrade(null);

      const answeredModule = currentModule;
      let openScore: { score: number; feedback: string } | null = null;

      try {
        // Open (speaking/writing) items are AI-scored first, then recorded.
        if (item.format === "open") {
          openScore = await scoreOpenItem(
            sessionId,
            resp.itemId,
            resp.text ?? "",
            locale,
          ).catch(() => null);
          if (generation !== lifecycleGeneration.current) return;
        }

        const data = await submitTestResponse(sessionId, resp);
        if (generation !== lifecycleGeneration.current) return;
        if (!data) throw new Error(t("test.respondFail"));

        if (data.lastGrade) {
          const xp = recordAnswerXp(data.lastGrade.correct);
          addXp(xp);
          setXpFloat(xp);
          window.setTimeout(() => {
            if (generation === lifecycleGeneration.current) setXpFloat(null);
          }, 900);
          if (!data.lastGrade.correct && data.lastGrade.format !== "open") {
            setHearts((h) => Math.max(0, h - 1));
          }
          setLastGrade({
            attemptLost: !data.lastGrade.correct && data.lastGrade.format !== "open" && hearts > 0,
            correct: data.lastGrade.correct,
            format: data.lastGrade.format,
            aiScore: openScore?.score,
            aiFeedback: openScore?.feedback,
            xpEarned: xp,
          });
        }

        if (data.moduleDone && !data.done && answeredModule) {
          setModuleNotice(
            t("feedback.moduleDone", {
              module: t(`modules.${answeredModule}`),
            }),
          );
          window.setTimeout(() => {
            if (generation === lifecycleGeneration.current) setModuleNotice(null);
          }, 2800);
        }

        // Count the answer we just submitted against its module.
        if (answeredModule) {
          setModuleCounts((prev) => ({
            ...prev,
            [answeredModule]: (prev[answeredModule] ?? 0) + 1,
          }));
        }

        if (data.done || !data.item) {
          clearStoredSessionId();
          setItem(null);
          void navigate(resultsRoute(sessionId));
          return;
        }

        if (data.lastGrade?.format !== "open") {
          setItem(data.item);
          setCurrentModule(data.currentModule);
        } else {
          window.setTimeout(() => {
            if (generation !== lifecycleGeneration.current) return;
            setLastGrade(null);
            setItem(data.item);
            setCurrentModule(data.currentModule);
          }, 2800);
        }
      } catch (e) {
        if (generation === lifecycleGeneration.current)
          setError(e instanceof Error ? e.message : t("test.submitFail"));
      } finally {
        if (generation === lifecycleGeneration.current) setSubmitting(false);
      }
    },
    [sessionId, item, submitting, currentModule, navigate, t, hearts],
  );

  /* ----------------------------- views ----------------------------- */

  if (phase === "select") {
    return (
      <TestShell>
        <div className="mx-auto max-w-2xl">
          <div className="mb-6">
            <ProgressStrip />
          </div>
          <div className="mb-8 text-center">
            <Badge variant="brand" className="px-3 py-1 text-xs">
              {t("test.badge")}
            </Badge>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              {t("test.title")} · {courseName()}
            </h1>
            <p className="mt-3 text-sm text-slate-500">{t("test.desc")}</p>
          </div>

          <div className="mb-6">
            <CoursePicker disabled={starting} />
          </div>

          {resumeFailed && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
            >
              <p>{t("test.resumeRetry")}</p>
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => setResumeCheck((n) => n + 1)}
              >
                {t("test.retryResume")}
              </Button>
            </div>
          )}

          {checkingResume && (
            <p className="mb-4 text-center text-xs text-slate-400">
              {t("test.checkingResume")}
            </p>
          )}

          {resumeInfo && !checkingResume && (
            <Card className="mb-6 border-brand-200 bg-brand-50/50 p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                {t("test.resumeTitle")}
                {resumeInfo.learningLanguage
                  ? ` · ${t(`courses.${resumeInfo.learningLanguage}.name`)}`
                  : ""}
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                {t("test.resumeDesc")}
                {resumeInfo.createdAt && (
                  <span className="text-slate-400">
                    {" "}
                    ·{" "}
                    {t("test.resumeAt", {
                      date: new Date(resumeInfo.createdAt).toLocaleString(
                        locale,
                      ),
                    })}
                  </span>
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={resumeSession} disabled={starting}>
                  {t("test.resumeBtn")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={starting}
                  onClick={() => abandonSession(resumeInfo.sessionId)}
                >
                  {t("test.abandonBtn")}
                </Button>
              </div>
            </Card>
          )}

          <fieldset
            disabled={!courseAvailable || starting}
            className="min-w-0 disabled:opacity-60"
          >
            <div className="mb-6 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={activePreset === p.id}
                  onClick={() => applyPreset(p.id)}
                  className={cx(
                    "rounded-xl border px-3 py-2 text-left text-xs transition-colors",
                    activePreset === p.id
                      ? "border-brand-400 bg-brand-50 text-brand-800 shadow-card ring-1 ring-brand-200"
                      : "border-slate-200 bg-white/80 text-slate-600 hover:border-brand-200",
                  )}
                >
                  <span className="font-semibold">{t(p.labelKey)}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    {t(p.descKey)}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MODULE_ORDER.map((key) => {
                const checked = selected.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(key)}
                    className={cx(
                      "group flex items-start gap-3 rounded-2xl border-2 bg-white/80 p-4 text-left backdrop-blur-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2",
                      checked
                        ? "border-brand-400 shadow-card ring-1 ring-brand-200"
                        : "border-slate-200 hover:border-brand-200 hover:bg-brand-50/30",
                    )}
                  >
                    <span
                      className={cx(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold transition-colors",
                        checked
                          ? "bg-brand-gradient text-white shadow-card"
                          : "bg-slate-100 text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-700",
                      )}
                      aria-hidden="true"
                    >
                      {t(`modules.${key}Glyph`)}
                    </span>
                    <span className="flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">
                          {t(`modules.${key}`)}
                        </span>
                        <Check checked={checked} />
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                        {t(`modules.${key}Desc`)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <Card className="mb-6 border-slate-100 bg-slate-50/60 p-4">
              <p className="text-xs font-medium text-slate-700">
                {t("test.tipsTitle")}
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-500">
                <li>{t("test.tip1")}</li>
                <li>{t("test.tip2")}</li>
                <li>{t("test.tip3")}</li>
                <li>{t("test.tip4")}</li>
              </ul>
            </Card>
          </fieldset>
          {error && <ErrorNote>{error}</ErrorNote>}
          {resumeInfo && (
            <p className="mt-3 text-center text-sm text-slate-600">
              {t("test.existingFirst")}
            </p>
          )}

          {!courseAvailable && (
            <p
              role="status"
              className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
            >
              {t("course.unavailableHint", { name: courseName() })}
            </p>
          )}

          <div className="mt-8 flex flex-col items-center gap-3">
            <Button
              size="lg"
              className="min-w-[220px]"
              onClick={start}
              disabled={
                orderedSelected.length === 0 ||
                starting ||
                checkingResume ||
                resumeFailed ||
                Boolean(resumeInfo) ||
                !courseAvailable
              }
              aria-busy={starting}
            >
              {starting ? (
                <>
                  <Spinner /> {t("test.preparing")}
                </>
              ) : (
                <>{t("test.startBtn")}</>
              )}
            </Button>
            <p className="text-xs text-slate-400">
              {t("test.selected", {
                n: orderedSelected.length,
                total: MODULE_ORDER.length,
              })}
            </p>
          </div>
        </div>
      </TestShell>
    );
  }

  /* phase === "running" */
  const moduleIndex = currentModule ? activeModules.indexOf(currentModule) : 0;
  const totalModules = activeModules.length;
  const answeredInModule = currentModule
    ? (moduleCounts[currentModule] ?? 0)
    : 0;
  // Item being shown is answer #(answeredInModule + 1) of this module.
  const itemNumber = answeredInModule + 1;
  const progressValue = Math.min(itemNumber, MAX_ITEMS_PER_MODULE);

  return (
    <TestShell>
      <div className="mx-auto max-w-2xl">
        {xpFloat != null && <XpFloat amount={xpFloat} />}
        <div className="mb-4">
          <ProgressStrip />
        </div>
        {moduleNotice && (
          <div
            role="status"
            className="mb-4 animate-fade-up rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-center text-sm font-medium text-brand-900"
          >
            {moduleNotice} · {t("test.moduleEntering")}
          </div>
        )}

        {hearts === 0 && (
          <div
            role="status"
            className="mb-4 rounded-2xl border-2 border-rose-300 bg-rose-50 px-4 py-3 text-center"
          >
            <p className="text-sm font-black text-rose-800">
              {t("feedback.heartsEmptyTitle")}
            </p>
            <p className="mt-1 text-xs text-rose-700">
              {t("feedback.heartsEmpty")}
            </p>
          </div>
        )}

        {/* Progress header */}
        <div className="mb-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">
                {currentModule
                  ? t(`modules.${currentModule}`)
                  : t("test.badge")}
              </span>
              <Badge variant="neutral">
                {t("test.moduleOf", {
                  i: moduleIndex + 1,
                  total: totalModules,
                })}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <AttemptsBar remaining={hearts} />
              <span className="text-xs tabular-nums text-slate-400">
                {formatElapsed(elapsedSec)}
              </span>
              <span className="text-xs text-slate-500" aria-live="polite">
                {t("test.question", { n: itemNumber })}
                <span className="text-slate-400">
                  {" "}
                  / {t("test.maxQuestions", { max: MAX_ITEMS_PER_MODULE })}
                </span>
              </span>
            </div>
          </div>

          <ProgressBar value={progressValue} max={MAX_ITEMS_PER_MODULE} />

          {/* Module pips */}
          <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden="true">
            {activeModules.map((m, i) => (
              <span
                key={m}
                className={cx(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i < moduleIndex
                    ? "bg-brand-600"
                    : i === moduleIndex
                      ? "bg-brand-400"
                      : "bg-slate-200",
                )}
                title={t(`modules.${m}`)}
              />
            ))}
          </div>
        </div>

        {lastGrade && (
          <AnswerFeedback
            correct={lastGrade.correct}
            attemptLost={lastGrade.attemptLost}
            format={lastGrade.format}
            aiScore={lastGrade.aiScore}
            aiFeedback={lastGrade.aiFeedback}
            xpEarned={lastGrade.xpEarned}
            onDismiss={dismissFeedback}
          />
        )}

        {item && <QuestionFeedback question={"a:" + item.id} />}
        {/* The item */}
        <div
          className={cx(
            "transition-opacity duration-200",
            (submitting || lastGrade?.format === "open") &&
              "pointer-events-none opacity-60",
          )}
        >
          {item && !lastGrade ? (
            <ItemRenderer
              key={item.id}
              item={item}
              onAnswer={handleAnswer}
              disabled={submitting}
            />
          ) : !lastGrade ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-500">
                {t("test.loadingNext")}
              </CardContent>
            </Card>
          ) : null}
        </div>

        {error && (
          <div className="mt-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        {submitting && (
          <p
            className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400"
            aria-live="polite"
          >
            <Spinner /> {t("test.evaluating")}
          </p>
        )}

        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          <button
            type="button"
            onClick={() => abandonSession(sessionId)}
            className="text-xs text-slate-400 underline-offset-2 hover:text-rose-600 hover:underline"
          >
            {t("common.giveUp")}
          </button>
          <Link
            to="/"
            className="text-xs text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
          >
            {t("common.backHome")}
          </Link>
        </div>
      </div>
    </TestShell>
  );
}

function TestShell({ children }: { children: React.ReactNode }) {
  return (
    <PageShell active="test" className="max-w-2xl">
      <div className="mt-2 flex-1">{children}</div>
    </PageShell>
  );
}

function Check({ checked }: { checked: boolean }) {
  return (
    <span
      className={cx(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
        checked ? "border-brand-600 bg-brand-600" : "border-slate-300 bg-white",
      )}
      aria-hidden="true"
    >
      {checked && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </span>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
    >
      {children}
    </div>
  );
}

function Spinner({ large }: { large?: boolean }) {
  return (
    <svg
      className={cx("animate-spin", large ? "h-6 w-6" : "h-4 w-4")}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
}

function cx(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

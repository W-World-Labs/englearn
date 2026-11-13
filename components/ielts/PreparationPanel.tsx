import * as React from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n/context";
import { apiFetch } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import {
  EXAM_IDS,
  EXAM_LABELS,
  sectionsFor,
  sectionIds,
  sectionResult,
  isCorrect,
} from "@/lib/ielts/exam";
import {
  parseSession,
  storageKey,
  type ExamSession,
  type ExamSummary,
} from "@/lib/ielts/session";
import {
  SKILLS,
  CAUSES,
  createPreparation,
  preparationDay,
  prepQuestion,
  overallBand,
  MAX_PREP_MISTAKES,
  type IeltsPreparation,
  type PrepMistake,
  type ErrorCause,
  type PreparationWorkspace,
} from "@/lib/ielts/preparation";
import {
  learningResumeSearch,
  type StudyJournal,
} from "@/lib/learning/session";
import { lessonById } from "@/lib/learning/catalog";
import { gradedText } from "@/lib/learning/workbench-content";
import { studyTextLocale } from "@/lib/i18n/localized";
import { GRADED_TEXTS } from "@/lib/learning/workbench-content";
import { ExamLearningLink } from "@/components/learning/ExamLearningLink";
import { SpeakingDesk, WritingDesk } from "./PreparationDrills";
import { AirportMap } from "./ExamPassage";
import { Button } from "@/components/ui/Button";

const BANDS = Array.from({ length: 19 }, (_, i) => i / 2);
export function PreparationPanel({
  home = false,
  session,
  commit,
  owner,
  disabled,
}: {
  home?: boolean;
  session: StudyJournal | null;
  commit: (journal: StudyJournal) => void;
  owner: string;
  disabled: boolean;
}) {
  const { t, locale, setLearningLanguage } = useI18n(),
    { user } = useAuth();
  const [initial] = React.useState(createPreparation);
  const prep = session?.ieltsPrep ?? initial;
  const [now, setNow] = React.useState(() => new Date());
  const day = preparationDay(prep, now);
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const workspace = search.workspace ?? "today";
  function setWorkspace(next: PreparationWorkspace) {
    void navigate({
      to: home ? "/" : "/learn",
      search: home ? { workspace: next === "today" ? undefined : next } : { tab: "ielts", workspace: next === "today" ? undefined : next },
      resetScroll: false,
    });
  }
  const previousWorkspace = React.useRef(workspace);
  React.useEffect(() => {
    if (previousWorkspace.current === workspace) return;
    previousWorkspace.current = workspace;
    document
      .getElementById(`prep-${workspace}`)
      ?.focus({ preventScroll: true });
  }, [workspace]);
  const [editing, setEditing] = React.useState(false);
  const [profile, setProfile] = React.useState(initial);
  const [updated, setUpdated] = React.useState(false);
  React.useEffect(() => {
    if (!updated) return;
    const timer = window.setTimeout(() => setUpdated(false), 4000);
    return () => window.clearTimeout(timer);
  }, [updated]);
  const [speakingRunning, setSpeakingRunning] = React.useState(false);
  const [writingRunning, setWritingRunning] = React.useState(false);
  const activeTimer = home ? writingRunning ? "writing" : speakingRunning ? "speaking" : null : null;
  const configured = !!session?.ieltsPrep;
  const completed = day.tasks.filter((task) => task.done).length;
  const nextTask = day.tasks.find((task) => !task.done);
  const resume = home && day.days > 0 ? learningResumeSearch(session) : undefined;
  const resumeTitle = resume
    ? "lesson" in resume
      ? lessonById(resume.lesson)?.title[studyTextLocale(locale)]
      : "concept" in resume
        ? gradedText(resume.concept)?.title[studyTextLocale(locale)]
        : t("ieltsPrep.review")
    : undefined;
  const savedWriting = prep.writing.draft || prep.writing.rewrite;
  const resumeWriting = home && !!nextTask && day.days > 0 && !resume && !!savedWriting.trim() && !prep.completed.some((entry) => entry.date === day.today && entry.skill === "writing");
  const dueCount = prep.mistakes.filter((m) => m.dueAt <= now.getTime()).length;
  function editProfile() {
    setProfile(prep);
    setEditing(true);
    setUpdated(false);
  }
  function closeProfile() {
    setEditing(false);
    document
      .getElementById(`prep-${workspace}`)
      ?.focus({ preventScroll: true });
  }
  function practiceLink(skill: "listening" | "reading") {
    return {
      tab: "reading" as const,
      concept: textFor(skill),
      activity: skill,
    };
  }
  const textFor = (skill: "listening" | "reading") => {
    const band = prep.current[skill];
    const stage =
      band === null || band < 5
        ? "foundation"
        : band < 6.5
          ? "intermediate"
          : "advanced";
    return GRADED_TEXTS.find(
      (text) => text.language === "en" && text.stage === stage,
    )!.id;
  };
  const [attempts, setAttempts] = React.useState<ExamSession[]>([]);
  const [read, setRead] = React.useState(false),
    [reading, setReading] = React.useState(false),
    [readError, setReadError] = React.useState(false);
  const request = React.useRef<AbortController | null>(null);
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => {
      clearInterval(timer);
      request.current?.abort();
      request.current = null;
    };
  }, []);
  function change(next: IeltsPreparation) {
    if (session && !disabled) commit({ ...session, ieltsPrep: next });
  }
  function localAttempts() {
    return EXAM_IDS.flatMap((examId) => {
      const s = parseSession(localStorage.getItem(storageKey(owner, examId)));
      return s?.status === "finished" && s.mode !== "writing" ? [s] : [];
    });
  }
  async function readAttempts() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(() => controller.abort(), 10000);
    setReading(true);
    setReadError(false);
    let saved: ExamSession[] = [];
    try {
      saved = localAttempts();
    } catch {
      setReadError(true);
    }
    setAttempts(saved);
    setRead(true);
    try {
      if (user) {
        const options = {
          headers: { "X-LingoLearn-Account": user.sub },
          signal: controller.signal,
        };
        const response = await apiFetch(
          "/api/ielts/attempts?pageSize=50",
          options,
        );
        if (!response.ok) throw Error();
        const data = (await response.json()) as {
          items: ExamSummary[];
          latest: { session: unknown } | null;
        };
        const last = data.items.find(
          (item) => item.status === "finished" && item.mode !== "writing",
        );
        if (last) {
          let raw = data.latest?.session;
          if ((raw as ExamSession | undefined)?.id !== last.id) {
            const detail = await apiFetch(
              "/api/ielts/attempts?id=" + encodeURIComponent(last.id),
              options,
            );
            if (!detail.ok) throw Error();
            raw = (await detail.json()).attempt?.session;
          }
          const s = parseSession(JSON.stringify(raw) ?? null);
          if (!s || s.status !== "finished") throw Error();
          saved = [s, ...saved.filter((old) => old.id !== s.id)];
        }
      }
      if (!controller.signal.aborted)
        setAttempts(saved.sort((a, b) => b.completedAt! - a.completedAt!));
    } catch {
      if (request.current === controller) setReadError(true);
    } finally {
      clearTimeout(timer);
      if (request.current === controller) setReading(false);
    }
  }
  const misses = new Map<
    string,
    {
      examId: (typeof EXAM_IDS)[number];
      skill: PrepMistake["skill"];
      questionId: string;
    }
  >();
  for (const attempt of attempts) {
    const examId = EXAM_IDS.find((id) => id === attempt.examId)!;
    for (const skill of sectionIds(attempt.mode)) {
      if (skill === "writing") continue;
      for (const row of sectionResult(skill, attempt.answers, examId).rows) {
        if (!row.correct)
          misses.set(`${examId}:${row.question.id}`, {
            examId,
            skill,
            questionId: row.question.id,
          });
      }
    }
  }
  function addCause(
    row: {
      examId: (typeof EXAM_IDS)[number];
      skill: PrepMistake["skill"];
      questionId: string;
    },
    cause: ErrorCause,
  ) {
    const at = Date.now();
    setNow(new Date(at));
    const old = prep.mistakes.find(
      (m) => m.examId === row.examId && m.questionId === row.questionId,
    );
    if (!old && prep.mistakes.length >= MAX_PREP_MISTAKES) return;
    const next: PrepMistake = {
      ...row,
      cause,
      dueAt: old?.dueAt ?? at,
      checks: old?.checks ?? 0,
      lastCorrect: old?.lastCorrect ?? null,
    };
    change({
      ...prep,
      mistakes: old
        ? prep.mistakes.map((m) => (m === old ? next : m))
        : [...prep.mistakes, next],
    });
  }
  return (
    <div className="ielts-prep">
      {(!home || workspace !== "today") && (
        <div className="prep-topline">
          <p>
            {home ? (
              workspace === "today" ? (
                "IELTS Academic"
              ) : (
                <Button variant="ghost" onClick={() => setWorkspace("today")}>
                  ← {t("ieltsPrep.navtoday")}
                </Button>
              )
            ) : (
              <Link to="/learn" search={{ tab: "today" }}>
                ← {t("ieltsPrep.backLearning")}
              </Link>
            )}
          </p>
          {configured && (
            <span>
              {t("ieltsPrep.targetSummary", { band: prep.goal.toFixed(1) })} ·{" "}
              {day.days > 0
                ? t("ieltsPrep.days", { count: day.days })
                : t("ieltsPrep.dateReached")}
            </span>
          )}
        </div>
      )}
      {!home && (
        <nav className="prep-nav" aria-label={t("ieltsPrep.workspaces")}>
          {(["today", "speaking", "writing", "mistakes"] as const).map(
            (tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={workspace === tab}
                aria-controls={`prep-${tab}`}
                onClick={() => setWorkspace(tab)}
              >
                {t(`ieltsPrep.nav${tab}`)}
                {((tab === "speaking" && speakingRunning) ||
                  (tab === "writing" && writingRunning)) && (
                  <span className="prep-running">
                    {t("ieltsPrep.timerRunning")}
                  </span>
                )}
                {tab === "mistakes" && dueCount > 0 && (
                  <span className="prep-count">{dueCount}</span>
                )}
              </button>
            ),
          )}
        </nav>
      )}
      {(editing || (home && !configured && workspace === "today")) && (
        <form
          className="prep-surface prep-editor"
          id="prep-settings"
          onSubmit={(event) => {
            event.preventDefault();
            if (disabled) return;
            change({
              ...prep,
              goal: profile.goal,
              minimum: profile.minimum,
              examDate: profile.examDate,
              minutes: profile.minutes,
              current: { ...profile.current },
            });
            closeProfile();
            setUpdated(true);
          }}
        >
          <div className="prep-section-heading">
            <h2>{t("ieltsPrep.profile")}</h2>
            {(!home || configured) && (
              <Button variant="ghost" onClick={closeProfile}>
                {t("common.cancel")}
              </Button>
            )}
          </div>
          <fieldset
            disabled={disabled}
            className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <label className="text-sm">
              {t("ieltsPrep.goal")}
              <select
                className="mt-2 min-h-11 w-full rounded-lg border px-3"
                value={profile.goal}
                autoFocus
                onChange={(e) =>
                  setProfile({ ...profile, goal: Number(e.target.value) })
                }
              >
                {BANDS.filter((b) => b >= 4).map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              {t("ieltsPrep.minimum")}
              <select
                className="mt-2 min-h-11 w-full rounded-lg border px-3"
                value={profile.minimum}
                onChange={(e) =>
                  setProfile({ ...profile, minimum: Number(e.target.value) })
                }
              >
                {BANDS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              {t("ieltsPrep.examDate")}
              <input
                className="mt-2 min-h-11 w-full rounded-lg border px-3"
                type="date"
                required
                value={profile.examDate}
                onChange={(e) =>
                  setProfile({ ...profile, examDate: e.target.value })
                }
              />
            </label>
            <label className="text-sm">
              {t("ieltsPrep.minutes")}
              <select
                className="mt-2 min-h-11 w-full rounded-lg border px-3"
                value={profile.minutes}
                onChange={(e) =>
                  setProfile({ ...profile, minutes: Number(e.target.value) })
                }
              >
                {[15, 30, 60, 90, 120, 180].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
          </fieldset>
          <details className="mt-4">
            <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">
              {t("ieltsPrep.current")}
            </summary>
            <fieldset disabled={disabled}>
              <legend className="sr-only">{t("ieltsPrep.current")}</legend>
              <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {SKILLS.map((skill) => (
                  <label key={skill} className="text-sm">
                    {t(`ieltsPrep.${skill}`)}
                    <select
                      className="mt-2 min-h-11 w-full rounded-lg border px-3"
                      value={profile.current[skill] ?? ""}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          current: {
                            ...profile.current,
                            [skill]:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          },
                        })
                      }
                    >
                      <option value="">{t("ieltsPrep.unknown")}</option>
                      {BANDS.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {t("ieltsPrep.currentHint")}
              </p>
            </fieldset>
          </details>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={disabled}>
              {home && !configured
                ? t("ieltsPrep.homeStart")
                : t("ieltsPrep.saveGoal")}
            </Button>
          </div>
        </form>
      )}
      {updated && (
        <p className="prep-notice" role="status">
          {t("ieltsPrep.goalUpdated")}
        </p>
      )}
      <div
        id="prep-today"
        role="region"
        aria-label={t("ieltsPrep.navtoday")}
        tabIndex={-1}
        hidden={workspace !== "today" || (home && !configured)}
      >
        <div
          className="prep-overview"
          style={
            configured ? undefined : { gridTemplateColumns: "minmax(0, 1fr)" }
          }
        >
          <section className="prep-surface prep-today">
            <div className="prep-section-heading">
              <h2>{t("ieltsPrep.today")}</h2>
              <span className="text-sm text-slate-500">
                {configured
                  ? t("ieltsPrep.taskProgress", {
                      done: completed,
                      total: day.tasks.length,
                    })
                  : "IELTS Academic"}
              </span>
            </div>
            {!configured ? (
              <div className="prep-welcome">
                <Button
                  disabled={disabled}
                  onClick={editProfile}
                  aria-expanded={editing}
                  aria-controls="prep-settings"
                >
                  {t("ieltsPrep.setGoal")} <span aria-hidden="true">→</span>
                </Button>
              </div>
            ) : (
              <>
                <div className="prep-daily-summary">
                  <div>
                    <strong>
                      {prep.minutes}
                      <span>{t("common.minutes")}</span>
                    </strong>
                  </div>
                  <div className="prep-next-action">
                    {activeTimer ? (
                      <Button onClick={() => setWorkspace(activeTimer)}>{t(`ieltsPrep.nav${activeTimer}`)} · {t("ieltsPrep.timerRunning")}</Button>
                    ) : resume ? (
                      <Link
                        to="/learn"
                        search={resume}
                        className="prep-primary-link"
                      >
                        {t("learn.resumeDraft")}{" "}
                        <span aria-hidden="true">→</span>
                      </Link>
                    ) : resumeWriting ? (
                      <Button onClick={() => setWorkspace("writing")}>
                        {t("ieltsPrep.resumeWriting")}{" "}
                        <span aria-hidden="true">→</span>
                      </Button>
                    ) : nextTask && day.days > 0 ? (
                      nextTask.skill === "listening" ||
                      nextTask.skill === "reading" ? (
                        <Link
                          className="prep-primary-link"
                          to="/learn"
                          search={practiceLink(nextTask.skill)}
                          onClick={() => setLearningLanguage("en")}
                        >
                          {t("ieltsPrep.startSkill", {
                            skill: t(`ieltsPrep.${nextTask.skill}`),
                          })}
                          <span aria-hidden="true">→</span>
                        </Link>
                      ) : (
                        <Button
                          onClick={() =>
                            setWorkspace(
                              nextTask.skill as "speaking" | "writing",
                            )
                          }
                        >
                          {t("ieltsPrep.startSkill", {
                            skill: t(`ieltsPrep.${nextTask.skill}`),
                          })}
                          <span aria-hidden="true">→</span>
                        </Button>
                      )
                    ) : day.days <= 0 ? (
                      <Button onClick={editProfile}>
                        {t("ieltsPrep.editGoal")}
                      </Button>
                    ) : (
                      <p className="font-semibold text-brand-700">
                        ✓ {t("ieltsPrep.todayComplete")}
                      </p>
                    )}
                    {!activeTimer && (resume || resumeWriting || day.days <= 0) && <p>
                      {resume
                        ? resumeTitle
                        : resumeWriting
                          ? t("ieltsPrep.words", {
                              count: savedWriting.trim().split(/\s+/).length,
                            })
                          : t("ieltsPrep.past")}
                    </p>}
                  </div>
                </div>
                <div
                  className="prep-progress"
                  role="progressbar"
                  aria-label={t("ieltsPrep.today")}
                  aria-valuenow={completed}
                  aria-valuemin={0}
                  aria-valuemax={day.tasks.length}
                >
                  <span
                    style={{
                      width: `${(completed / day.tasks.length) * 100}%`,
                    }}
                  />
                </div>
                <div className="prep-task-list">
                  {day.tasks.map(({ skill, minutes, done }) => {
                    const action = (
                      <>
                        <span>{t(`ieltsPrep.${skill}`)}</span>
                        <span className="prep-task-duration">
                          {minutes} {t("common.minutes")}
                          <span aria-hidden="true">→</span>
                        </span>
                      </>
                    );
                    return (<article
                      className={`prep-task-row ${done ? "is-done" : ""}`}
                      key={skill}
                    >
                      <label className="prep-task-check">
                        <input
                          type="checkbox"
                          checked={done}
                          aria-label={t("ieltsPrep.completeSkill", {
                            skill: t(`ieltsPrep.${skill}`),
                          })}
                          disabled={disabled || day.days <= 0}
                          onChange={() =>
                            change({
                              ...prep,
                              completed: [
                                ...prep.completed.filter(
                                  (r) =>
                                    !(
                                      r.date === day.today && r.skill === skill
                                    ),
                                ),
                                ...(!done ? [{ date: day.today, skill }] : []),
                              ].slice(-732),
                            })
                          }
                        />
                        <span aria-hidden="true">{done ? "✓" : ""}</span>
                      </label>
                      {skill === "listening" || skill === "reading" ? (
                        <Link
                          className="prep-task-action"
                          to="/learn"
                          search={practiceLink(skill)}
                          onClick={() => setLearningLanguage("en")}
                        >
                          {action}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="prep-task-action"
                          onClick={() => setWorkspace(skill)}
                        >
                          {action}
                        </button>
                      )}
                    </article>);
                  })}
                </div>
              </>
            )}
          </section>
          {configured && (
            <aside className="prep-surface prep-goal">
              <div className="prep-section-heading">
                <h2>{t("ieltsPrep.myGoal")}</h2>
                <Button
                  variant="ghost"
                  disabled={disabled}
                  onClick={editProfile}
                  aria-expanded={editing}
                  aria-controls="prep-settings"
                >
                  {t("ieltsPrep.editGoal")}
                </Button>
              </div>
              <div className="prep-goal-score">
                <strong>{prep.goal.toFixed(1)}</strong>
                <span>{t("ieltsPrep.overallTarget")}</span>
              </div>
              <>
                <dl className="prep-goal-facts">
                  <div>
                    <dt>{t("ieltsPrep.minimum")}</dt>
                    <dd>{prep.minimum.toFixed(1)}</dd>
                  </div>
                  <div>
                    <dt>{t("ieltsPrep.examDate")}</dt>
                    <dd>
                      {new Date(prep.examDate + "T00:00:00").toLocaleDateString(
                        locale,
                      )}
                    </dd>
                  </div>
                </dl>
                {!home && (
                  <>
                    <table className="prep-score-table">
                      <caption>{t("ieltsPrep.targets")}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{t("ieltsPrep.skillLabel")}</th>
                          <th scope="col">{t("ieltsPrep.currentShort")}</th>
                          <th scope="col">{t("ieltsPrep.targetShort")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SKILLS.map((skill) => (
                          <tr key={skill}>
                            <th scope="row">{t(`ieltsPrep.${skill}`)}</th>
                            <td>{prep.current[skill]?.toFixed(1) ?? "—"}</td>
                            <td>{day.targets[skill].toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="prep-caption">{t("ieltsPrep.targetNote")}</p>
                    <details className="prep-help">
                      <summary>{t("ieltsPrep.scoreHelp")}</summary>
                      <p>{t("ieltsPrep.allocation")}</p>
                      <p>
                        {t("ieltsPrep.rounding", {
                          band: overallBand(day.targets),
                        })}
                      </p>
                      <p>{t("ieltsPrep.floor")}</p>
                    </details>
                  </>
                )}
              </>
            </aside>
          )}
        </div>
        {home && dueCount > 0 && (
          <Button
            variant="outline"
            className="mt-4 w-full justify-start gap-2"
            aria-label={`${t("ieltsPrep.mistakes")} · ${t("ieltsPrep.mistakeSummary", { due: dueCount, total: prep.mistakes.length })}`}
            onClick={() => setWorkspace("mistakes")}
          >
            {t("ieltsPrep.mistakes")}
            <span className="prep-count">{dueCount}</span>
          </Button>
        )}
        {!home && (
          <div className="prep-resource-row">
            <Link to="/ielts" className="prep-mock-link">
              <span>
                <strong>{t("ieltsPrep.mock")}</strong>
                <small>
                  {t("ieltsPrep.mockShort", {
                    minutes: 120 + sectionsFor(EXAM_IDS[0]).listening.minutes,
                  })}
                </small>
              </span>
              <span aria-hidden="true">↗</span>
            </Link>
            <div>
              <Link
                to="/learn"
                search={{ tab: "review" }}
                onClick={() => setLearningLanguage("en")}
              >
                {t("ieltsPrep.review")} ↗
              </Link>
              <Link
                to="/learn"
                search={{ tab: "courses" }}
                onClick={() => setLearningLanguage("en")}
              >
                {t("ieltsPrep.courses")} ↗
              </Link>
            </div>
          </div>
        )}
      </div>
      <div
        id="prep-mistakes"
        role="region"
        aria-label={t("ieltsPrep.navmistakes")}
        tabIndex={-1}
        hidden={workspace !== "mistakes"}
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-xl font-bold">{t("ieltsPrep.mistakes")}</h2>
          <p className="mt-2 text-sm text-slate-500">
            {t("ieltsPrep.mistakeSummary", {
              due: dueCount,
              total: prep.mistakes.length,
            })}
          </p>
          <button
            className="ielts-button mt-3"
            disabled={reading}
            onClick={() => void readAttempts()}
          >
            {reading ? t("ieltsPrep.importing") : t("ieltsPrep.import")}
          </button>
          {!read && !prep.mistakes.length && (
            <div className="prep-empty">
              <h3>{t("ieltsPrep.noMistakes")}</h3>
              <p>{t("ieltsPrep.mistakeEmptyHint")}</p>
              <Link to="/ielts">{t("ieltsPrep.mock")} ↗</Link>
            </div>
          )}
          <details className="prep-help">
            <summary>{t("ieltsPrep.importHelp")}</summary>
            <p>{t("ieltsPrep.importHint")}</p>
          </details>
          {readError && (
            <p role="alert" className="mt-3 text-sm text-amber-800">
              {t("ieltsPrep.importError")}
            </p>
          )}
          {attempts.map((a) => (
            <div key={a.id} className="mt-3 text-sm">
              {sectionIds(a.mode)
                .filter((s) => s !== "writing")
                .map((skill) => (
                  <p key={skill}>
                    {t("ieltsPrep.latest", {
                      skill: `${EXAM_LABELS[a.examId as (typeof EXAM_IDS)[number]]} · ${t(`ieltsPrep.${skill}`)}`,
                      band:
                        sectionResult(
                          skill,
                          a.answers,
                          a.examId as (typeof EXAM_IDS)[number],
                        ).band ?? "",
                      date: new Date(a.completedAt!).toLocaleDateString(locale),
                    })}
                  </p>
                ))}
            </div>
          ))}
          {attempts.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {t("ieltsPrep.estimateHint")}
            </p>
          )}
          {read && !reading && !attempts.length && (
            <p className="mt-3 text-sm">{t("ieltsPrep.empty")}</p>
          )}
          {attempts.length > 0 && !misses.size && (
            <p className="mt-3 text-sm">{t("ieltsPrep.allCorrect")}</p>
          )}
          {prep.mistakes.length >= MAX_PREP_MISTAKES && (
            <p role="status" className="mt-3 text-sm">
              {t("ieltsPrep.full")}
            </p>
          )}
          {!!misses.size && (
            <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
              {[...misses.values()].map((row) => {
                const saved = prep.mistakes.find(
                  (m) =>
                    m.examId === row.examId && m.questionId === row.questionId,
                );
                return (
                  <label
                    key={`${row.examId}:${row.questionId}`}
                    className="block rounded-xl border p-3 text-sm"
                  >
                    <span>
                      {EXAM_LABELS[row.examId]} · {t(`ieltsPrep.${row.skill}`)}{" "}
                      · {prepQuestion(row)?.number}. {prepQuestion(row)?.prompt}
                    </span>
                    <select
                      className="mt-2 min-h-11 w-full rounded-lg border px-3"
                      value={saved?.cause ?? ""}
                      disabled={
                        disabled ||
                        (!saved && prep.mistakes.length >= MAX_PREP_MISTAKES)
                      }
                      onChange={(e) => {
                        if (e.target.value)
                          addCause(row, e.target.value as ErrorCause);
                      }}
                    >
                      <option value="">{t("ieltsPrep.pickCause")}</option>
                      {CAUSES.map((cause) => (
                        <option key={cause} value={cause}>
                          {t(`ieltsPrep.${cause}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          )}
          <div className="mt-4 space-y-3">
            {[...prep.mistakes]
              .sort((a, b) => a.dueAt - b.dueAt)
              .map((mistake) => (
                <MistakeRecall
                  key={`${mistake.examId}:${mistake.questionId}:${mistake.checks}`}
                  mistake={mistake}
                  now={now.getTime()}
                  disabled={disabled}
                  check={(correct) =>
                    change({
                      ...prep,
                      mistakes: prep.mistakes.map((m) =>
                        m === mistake
                          ? {
                              ...m,
                              checks: Math.min(10000, m.checks + 1),
                              lastCorrect: correct,
                              dueAt: Date.now() + (correct ? 3 : 1) * 86400000,
                            }
                          : m,
                      ),
                    })
                  }
                />
              ))}
          </div>
        </section>
      </div>
      <div
        id="prep-speaking"
        role="region"
        aria-label={t("ieltsPrep.navspeaking")}
        tabIndex={-1}
        hidden={workspace !== "speaking"}
      >
        <SpeakingDesk onRunningChange={setSpeakingRunning} />
      </div>
      <div
        id="prep-writing"
        role="region"
        aria-label={t("ieltsPrep.navwriting")}
        tabIndex={-1}
        hidden={workspace !== "writing"}
      >
        <WritingDesk
          prep={prep}
          change={change}
          disabled={disabled}
          onRunningChange={setWritingRunning}
        />
      </div>
      {!home && workspace !== "today" && (
        <Button
          variant="ghost"
          className="mt-3"
          onClick={() => setWorkspace("today")}
        >
          ← {t("ieltsPrep.backToday")}
        </Button>
      )}
      {!home && (
        <details className="prep-help prep-methods">
          <summary>{t("ieltsPrep.sources")}</summary>
          <p className="mt-2">{t("ieltsPrep.sourceNote")}</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            <a
              className="underline"
              href="https://x.com/Seramikimiki/status/2117319245180829775"
              target="_blank"
              rel="noreferrer"
            >
              Sera · 2026-11-02
            </a>
            <a
              className="underline"
              href="https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail"
              target="_blank"
              rel="noreferrer"
            >
              {t("ieltsPrep.official")}
            </a>
            <a
              className="underline"
              href="https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-speaking"
              target="_blank"
              rel="noreferrer"
            >
              {t("ieltsPrep.speakingFormat")}
            </a>
            <a
              className="underline"
              href="https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-writing"
              target="_blank"
              rel="noreferrer"
            >
              {t("ieltsPrep.writingFormat")}
            </a>
          </div>
          <p className="mt-3">{t("ieltsPrep.limit")}</p>
        </details>
      )}
    </div>
  );
}

function MistakeRecall({
  mistake,
  check,
  now,
  disabled,
}: {
  mistake: PrepMistake;
  check: (correct: boolean) => void;
  now: number;
  disabled: boolean;
}) {
  const { t, locale } = useI18n();
  const [answer, setAnswer] = React.useState("");
  const q = prepQuestion(mistake)!;
  const source = sectionsFor(mistake.examId)[mistake.skill].parts.find(
    (p) => p.id === q.partId,
  );
  const due = mistake.dueAt <= now;
  return (
    <article className="rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="text-sm font-semibold">
        {EXAM_LABELS[mistake.examId]} · {t(`ieltsPrep.${mistake.skill}`)} ·{" "}
        {q.number}. {q.prompt}
      </h3>
      <p className="mt-2 text-xs text-slate-500">
        {t(`ieltsPrep.${mistake.cause}`)} ·{" "}
        {t("ieltsPrep.due", {
          date: new Date(mistake.dueAt).toLocaleString(locale),
        })}
      </p>
      <p className="mt-2 text-sm leading-7">
        {t(`ieltsPrep.${mistake.cause}Fix`)}
      </p>
      {q.groupContent && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
          {q.groupContent}
        </p>
      )}
      {q.type === "map-labelling" && mistake.examId === EXAM_IDS[0] && (
        <AirportMap />
      )}
      {due ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!disabled && answer.trim()) check(isCorrect(q, answer));
          }}
        >
          <label className="text-sm">
            {t("ieltsPrep.answer")} · {q.instruction}
            {q.options.length > 0 && (
              <span className="my-2 block">
                {q.options.map((o) => `${o.value}. ${o.label}`).join(" · ")}
              </span>
            )}
            <input
              className="mt-2 block min-h-11 rounded-lg border px-3"
              maxLength={200}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={disabled}
            />
          </label>
          <button
            className="ielts-button"
            disabled={disabled || !answer.trim()}
          >
            {t("ieltsPrep.retry")}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm">{t("ieltsPrep.notDue")}</p>
      )}
      {mistake.lastCorrect !== null && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer">
            {t(
              mistake.lastCorrect ? "ieltsPrep.correct" : "ieltsPrep.incorrect",
            )}
          </summary>
          <p className="mt-2 font-semibold">{q.answers.join(" / ")}</p>
          <p className="mt-2 leading-7">{q.explanation}</p>
        </details>
      )}
      {source && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer">{t("ielts.viewSources")}</summary>
          {source.audio && (
            <audio controls src={source.audio} className="my-3 w-full" />
          )}
          <p className="mt-3 whitespace-pre-wrap leading-7">{source.content}</p>
        </details>
      )}
      <ExamLearningLink question={`i:${q.id}`} examId={mistake.examId} />
    </article>
  );
}

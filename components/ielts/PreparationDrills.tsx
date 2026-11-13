import * as React from "react";
import { useI18n } from "@/lib/i18n/context";
import {
  EXAM_IDS,
  EXAM_LABELS,
  sectionsFor,
  wordCount,
} from "@/lib/ielts/exam";
import type { IeltsPreparation } from "@/lib/ielts/preparation";
import { ExamWritingTable } from "./ExamWritingTable";
import { Button } from "@/components/ui/Button";

// Original practice prompts (CC BY-SA 4.0), not recalled examination questions.
const SPEAKING_TOPICS = [
  {
    name: "Learning",
    prompts: [
      "What skill are you learning at the moment? Why did you choose it? How do you find time to practise?",
      "Describe something you learned from another person. Say who helped you, what you learned, how you practised, and why the experience mattered to you.",
      "Who should decide what adults learn at work? How might the value of practical skills change in the future? Give reasons and consider another view.",
    ],
  },
  {
    name: "A local place",
    prompts: [
      "Where do you like spending time near your home? Has this changed since you were younger?",
      "Describe a public place you would like to improve. Say where it is, who uses it, what you would change, and how that would help people.",
      "How should a city divide money between public spaces and transport? Who might disagree with your priorities, and why?",
    ],
  },
  {
    name: "Everyday technology",
    prompts: [
      "Which device helps you most in everyday life? When do you prefer to do things without it?",
      "Describe a time when a piece of technology did not work as expected. Say what you were trying to do, what happened, how you responded, and what you learned.",
      "Should public services always offer an option without digital technology? How could societies balance efficiency and accessibility?",
    ],
  },
];

export function SpeakingDesk({
  onRunningChange,
}: {
  onRunningChange?: (running: boolean) => void;
}) {
  const { t } = useI18n();
  const [part, setPart] = React.useState(1),
    [topic, setTopic] = React.useState(0);
  const [phase, setPhase] = React.useState("ready"),
    [remaining, setRemaining] = React.useState(0);
  const [record, setRecord] = React.useState(false),
    [micError, setMicError] = React.useState(false);
  const [audio, setAudio] = React.useState("");
  const [audioExtension, setAudioExtension] = React.useState("webm");
  const mounted = React.useRef(true);
  const recorder = React.useRef<MediaRecorder | null>(null);
  const stream = React.useRef<MediaStream | null>(null);
  const generation = React.useRef(0),
    deadline = React.useRef(0),
    objectUrl = React.useRef("");
  const [starting, setStarting] = React.useState(false);
  const stopCapture = React.useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      if (recorder.current) recorder.current.onstop = null;
      stopCapture();
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, [stopCapture]);
  React.useEffect(() => {
    if (phase !== "preparing" && phase !== "talking") return;
    const tick = () => {
      const seconds = Math.max(
        0,
        Math.ceil((deadline.current - Date.now()) / 1000),
      );
      setRemaining(seconds);
      if (!seconds) {
        stopCapture();
        setPhase(phase === "preparing" ? "ready" : "finished");
      }
    };
    tick();
    const timer = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [phase, stopCapture]);
  function stop() {
    generation.current += 1;
    stopCapture();
    setStarting(false);
    setPhase("ready");
    setRemaining(0);
  }
  async function begin() {
    stop();
    const request = ++generation.current;
    setStarting(true);
    setMicError(false);
    if (record) {
      try {
        if (
          !navigator.mediaDevices?.getUserMedia ||
          typeof MediaRecorder === "undefined"
        )
          throw Error();
        const capture = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (generation.current !== request) {
          capture.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = capture;
        const next = new MediaRecorder(capture),
          chunks: Blob[] = [];
        recorder.current = next;
        next.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data);
        };
        next.onstop = () => {
          if (!mounted.current) return;
          if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
          objectUrl.current = URL.createObjectURL(
            new Blob(chunks, { type: next.mimeType }),
          );
          setAudio(objectUrl.current);
          setAudioExtension(
            next.mimeType.includes("mp4")
              ? "m4a"
              : next.mimeType.includes("ogg")
                ? "ogg"
                : "webm",
          );
        };
        next.start();
      } catch {
        if (generation.current !== request) return;
        stream.current?.getTracks().forEach((track) => track.stop());
        stream.current = null;
        if (generation.current === request) setMicError(true);
      }
    }
    if (generation.current !== request) return;
    const seconds = part === 2 ? 120 : part === 1 ? 45 : 90;
    deadline.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
    setPhase("talking");
    setStarting(false);
  }
  const running = starting || phase === "preparing" || phase === "talking";
  React.useEffect(() => {
    onRunningChange?.(phase === "preparing" || phase === "talking");
  }, [phase, onRunningChange]);
  const displaySeconds =
    phase === "ready" && remaining === 0
      ? part === 2
        ? 120
        : part === 1
          ? 45
          : 90
      : remaining;
  return (
    <section id="ielts-speaking" className="prep-surface prep-desk">
      <div className="prep-section-heading">
        <h2>{t("ieltsPrep.speakingDesk")}</h2>
        <span className="prep-caption">{t("ieltsPrep.speakingMeta")}</span>
      </div>
      <div className="prep-focus-layout">
        <div>
          <div className="prep-select-row">
            <label>
              {t("ieltsPrep.part")}
              <select
                value={part}
                disabled={running}
                onChange={(e) => {
                  stop();
                  setPart(Number(e.target.value));
                }}
              >
                {[1, 2, 3].map((id) => (
                  <option key={id} value={id}>
                    {t(`ieltsPrep.part${id}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("ieltsPrep.topic")}
              <select
                value={topic}
                disabled={running}
                onChange={(e) => {
                  stop();
                  setTopic(Number(e.target.value));
                }}
              >
                {SPEAKING_TOPICS.map((row, i) => (
                  <option key={row.name} value={i}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="prep-prompt">
            <span className="prep-eyebrow">{t("ieltsPrep.promptLabel")}</span>
            <p lang="en">{SPEAKING_TOPICS[topic].prompts[part - 1]}</p>
          </div>
          {audio && (
            <div className="prep-recording">
              <audio controls src={audio} className="w-full" />
              <a href={audio} download={`ielts-speaking.${audioExtension}`}>
                {t("ieltsPrep.download")} ↓
              </a>
            </div>
          )}
        </div>
        <div className="prep-timer-panel">
          <p className="prep-eyebrow">{t(`ieltsPrep.${phase}`)}</p>
          <p className="prep-clock" role="timer">
            {String(Math.floor(displaySeconds / 60)).padStart(2, "0")}:
            {String(displaySeconds % 60).padStart(2, "0")}
          </p>
          <p className="prep-caption">
            {part === 2
              ? t("ieltsPrep.part2Timing")
              : t("ieltsPrep.drillTiming", { seconds: part === 1 ? 45 : 90 })}
          </p>
          <div className="prep-timer-actions">
            {running ? (
              <Button variant="outline" onClick={stop}>
                {t("ieltsPrep.stop")}
              </Button>
            ) : (
              <>
                <Button onClick={() => void begin()}>
                  {t("ieltsPrep.start")} <span aria-hidden="true">→</span>
                </Button>
                {part === 2 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      deadline.current = Date.now() + 60000;
                      setRemaining(60);
                      setPhase("preparing");
                    }}
                  >
                    {t("ieltsPrep.prepare")}
                  </Button>
                )}
              </>
            )}
          </div>
          <label className="prep-record-toggle">
            <input
              type="checkbox"
              checked={record}
              disabled={running}
              onChange={(e) => setRecord(e.target.checked)}
            />
            {t("ieltsPrep.record")}
          </label>
          <p className="prep-caption">{t("ieltsPrep.recordHint")}</p>
          {micError && (
            <p role="alert" className="mt-3 text-sm text-amber-800">
              {t("ieltsPrep.micError")}
            </p>
          )}
        </div>
      </div>
      <details className="prep-help">
        <summary>{t("ieltsPrep.selfReview")}</summary>
        <p>{t("ieltsPrep.speakCheck")}</p>
      </details>
    </section>
  );
}

export function WritingDesk({
  prep,
  change,
  disabled,
  onRunningChange,
}: {
  prep: IeltsPreparation;
  change: (prep: IeltsPreparation) => void;
  disabled: boolean;
  onRunningChange?: (running: boolean) => void;
}) {
  const { t } = useI18n();
  const w = prep.writing;
  const [timerStarted, setTimerStarted] = React.useState(false);
  const [version, setVersion] = React.useState<"draft" | "rewrite">(w.draft || !w.rewrite ? "draft" : "rewrite");
  const task = sectionsFor(w.examId).writing.parts.find(
    (p) => p.id === w.task,
  )!;
  const [deadline, setDeadline] = React.useState<number | null>(null),
    [remaining, setRemaining] = React.useState(0);
  React.useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (!left) setDeadline(null);
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [deadline]);
  React.useEffect(() => {
    onRunningChange?.(deadline !== null);
  }, [deadline, onRunningChange]);
  const displaySeconds = timerStarted
    ? remaining
    : w.task === "task-1"
      ? 1200
      : 2400;
  function update(patch: Partial<IeltsPreparation["writing"]>) {
    change({ ...prep, writing: { ...w, ...patch } });
  }
  function select(patch: Partial<IeltsPreparation["writing"]>) {
    if ((w.draft || w.rewrite) && !window.confirm(t("ieltsPrep.switchWriting")))
      return;
    setDeadline(null);
    setRemaining(0);
    setTimerStarted(false);
    update({ ...patch, draft: "", rewrite: "" });
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob(
        [`${task.title}\n${task.content}\n\n${w.draft}\n\n---\n${w.rewrite}`],
        { type: "text/plain;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `ielts-${w.examId}-${w.task}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section id="ielts-writing" className="prep-surface prep-desk">
      <div className="prep-section-heading">
        <h2>{t("ieltsPrep.writingDesk")}</h2>
        <Button variant="outline" onClick={download}>
          {t("ieltsPrep.exportWriting")} ↓
        </Button>
      </div>
      <div className="prep-select-row prep-writing-controls">
        <label>
          {t("ieltsPrep.paper")}
          <select
            disabled={disabled || deadline !== null}
            value={w.examId}
            onChange={(e) =>
              select({ examId: e.target.value as typeof w.examId })
            }
          >
            {EXAM_IDS.map((id) => (
              <option key={id} value={id}>
                {EXAM_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("ieltsPrep.task")}
          <select
            disabled={disabled || deadline !== null}
            value={w.task}
            onChange={(e) => select({ task: e.target.value as typeof w.task })}
          >
            {["task-1", "task-2"].map((id, i) => (
              <option key={id} value={id}>
                Task {i + 1}
              </option>
            ))}
          </select>
        </label>
        <div className="prep-writing-timer">
          <span className="tabular-nums" role="timer">
            {String(Math.floor(displaySeconds / 60)).padStart(2, "0")}:
            {String(displaySeconds % 60).padStart(2, "0")}
          </span>
          {deadline === null ? (
            <Button
              onClick={() => {
                const seconds = w.task === "task-1" ? 1200 : 2400;
                setTimerStarted(true);
                setRemaining(seconds);
                setDeadline(Date.now() + seconds * 1000);
                document.getElementById(`prep-writing-${version}`)?.focus();
              }}
            >
              {t("ieltsPrep.start")}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setDeadline(null)}>
              {t("ieltsPrep.stop")}
            </Button>
          )}
        </div>
      </div>
      {(w.draft || w.rewrite) && (
        <p className="prep-caption mb-4">{t("ieltsPrep.switchHint")}</p>
      )}
      <div className="prep-writing-layout">
        <details className="prep-writing-prompt" open tabIndex={0}>
          <summary className="prep-eyebrow">
            {t("ieltsPrep.promptLabel")} ·{" "}
            {t("ieltsPrep.writingRequirement", {
              minutes: w.task === "task-1" ? 20 : 40,
              words: task.minWords ?? 250,
            })}
          </summary>
          <p className="whitespace-pre-wrap" lang="en">
            {task.content}
          </p>
          {w.task === "task-1" && <ExamWritingTable examId={w.examId} />}
        </details>
        <div className="prep-writing-editor">
          <div className="prep-version-row">
            <nav aria-label={t("ieltsPrep.writingVersions")}>
              {(["draft", "rewrite"] as const).map((key) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={version === key}
                  onClick={() => setVersion(key)}
                >
                  {t(`ieltsPrep.${key}`)}
                </button>
              ))}
            </nav>
            <span>
              {t("ieltsPrep.words", { count: wordCount(w[version]) })}
            </span>
          </div>
          {(["draft", "rewrite"] as const).map((key) => (
            <div hidden={version !== key} key={key}>
              <label htmlFor={`prep-writing-${key}`} className="sr-only">
                {t(`ieltsPrep.${key}`)}
              </label>
              <textarea
                id={`prep-writing-${key}`}
                lang="en"
                maxLength={16000}
                value={w[key]}
                disabled={disabled}
                placeholder={t(`ieltsPrep.${key}Placeholder`)}
                onChange={(e) => update({ [key]: e.target.value })}
              />
            </div>
          ))}
          <p className="prep-caption mt-3">{t("ieltsPrep.writingSaveHint")}</p>
        </div>
      </div>
      <details className="prep-help">
        <summary>{t("ieltsPrep.selfReview")}</summary>
        <p>{t("ieltsPrep.writingCheck")}</p>
      </details>
    </section>
  );
}

import * as React from "react";
import { useI18n } from "@/lib/i18n/context";
import { examMessages } from "@/lib/exams/messages";

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export function PracticeAudio({
  paperId,
  questionId,
  onPlayed,
  className = "",
}: {
  paperId: string;
  questionId: string;
  onPlayed?: () => void;
  className?: string;
}) {
  const m = examMessages(useI18n().locale);
  const ref = React.useRef<HTMLAudioElement>(null);
  const played = React.useRef(false);
  const callback = React.useRef(onPlayed);
  callback.current = onPlayed;
  const [state, setState] = React.useState<
    "idle" | "loading" | "playing" | "paused" | "ended" | "error"
  >("idle");
  const [duration, setDuration] = React.useState(0);
  const [position, setPosition] = React.useState(0);
  const [rate, setRate] = React.useState(1);
  const restore = React.useRef(0);
  const src = `/api/exams/audio?paperId=${encodeURIComponent(paperId)}&questionId=${encodeURIComponent(questionId)}`;
  React.useEffect(() => {
    const audio = ref.current;
    const exclusive = (event: Event) => {
      if (event.target !== audio && event.target instanceof HTMLMediaElement)
        audio?.pause();
    };
    document.addEventListener("play", exclusive, true);
    return () => {
      audio?.pause();
      document.removeEventListener("play", exclusive, true);
    };
  }, []);
  React.useEffect(() => {
    if (state !== "loading") return;
    const timer = window.setTimeout(() => {
      ref.current?.pause();
      setState("error");
    }, 10000);
    return () => clearTimeout(timer);
  }, [state]);
  async function toggle() {
    const audio = ref.current;
    if (!audio) return;
    if (state === "playing") {
      audio.pause();
      setState("paused");
      return;
    }
    if (state === "error") {
      restore.current = position;
      audio.load();
    }
    if (state === "ended") audio.currentTime = 0;
    audio.playbackRate = rate;
    setState("loading");
    try {
      await audio.play();
    } catch {
      setState("error");
    }
  }
  return (
    <section
      className={`rounded-xl border border-blue-100 bg-blue-50/60 p-4 ${className}`}
      aria-label={m.audioPlayer}
    >
      <audio
        ref={ref}
        preload="metadata"
        src={src}
        onLoadedMetadata={() => {
          const audio = ref.current!;
          setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
          if (restore.current) {
            audio.currentTime = restore.current;
            restore.current = 0;
          }
        }}
        onTimeUpdate={() => setPosition(ref.current?.currentTime ?? 0)}
        onPlaying={() => {
          played.current = true;
          setState("playing");
        }}
        onWaiting={() => setState("loading")}
        onPause={() =>
          setState((s) => (s === "playing" || s === "loading" ? "paused" : s))
        }
        onEnded={() => {
          setState("ended");
          if (played.current) callback.current?.();
        }}
        onError={() => setState("error")}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="ielts-button min-w-28 !border-blue-200"
          disabled={state === "loading"}
          onClick={() => void toggle()}
        >
          {state === "loading"
            ? m.audioLoading
            : state === "playing"
              ? m.audioPause
              : state === "error"
                ? m.retry
                : state === "ended"
                  ? m.audioReplay
                  : m.audioPlay}
        </button>
        <div className="min-w-32 flex-1">
          <label
            className="sr-only"
            htmlFor={`audio-seek-${paperId}-${questionId}`}
          >
            {m.audioPosition}
          </label>
          <input
            id={`audio-seek-${paperId}-${questionId}`}
            type="range"
            className="h-6 w-full accent-blue-700"
            min={0}
            max={duration || 1}
            step={0.1}
            value={Math.min(position, duration || 1)}
            disabled={!duration || state === "error"}
            aria-valuetext={`${clock(position)} / ${clock(duration)}`}
            onChange={(e) => {
              if (ref.current) {
                const next = Number(e.target.value);
                ref.current.currentTime = next;
                setPosition(next);
                if (state === "ended") setState("paused");
              }
            }}
          />
          <p className="text-xs tabular-nums text-slate-600">
            {clock(position)} / {clock(duration)}
          </p>
        </div>
        <label className="text-xs text-slate-600">
          <span className="sr-only">{m.audioSpeed}</span>
          <select
            aria-label={m.audioSpeed}
            className="rounded-lg border border-blue-200 bg-white px-2 py-2"
            value={rate}
            onChange={(e) => {
              const next = Number(e.target.value);
              setRate(next);
              if (ref.current) ref.current.playbackRate = next;
            }}
          >
            {[0.75, 1, 1.25].map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs leading-6 text-slate-500">{m.recordedAudio}</p>
      {state === "error" && (
        <p role="alert" className="mt-2 text-sm leading-6 text-amber-900">
          {m.audioError}
        </p>
      )}
    </section>
  );
}

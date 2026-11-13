import * as React from "react";
import { useI18n } from "@/lib/i18n/context";
export interface TTSPlayerProps {
  text: string;
  lang?: string;
  disabled?: boolean;
  className?: string;
  onAvailabilityChange?: (available: boolean) => void;
  onPlayed?: () => void;
}
/** Device speech only; no script is rendered before review and failures stay visible. */
export default function TTSPlayer({
  text,
  lang = "en-US",
  disabled = false,
  className = "",
  onAvailabilityChange,
  onPlayed,
}: TTSPlayerProps) {
  const { t } = useI18n();
  const [available, setAvailable] = React.useState(false);
  const [state, setState] = React.useState<
    "loading" | "idle" | "playing" | "done" | "error" | "unsupported"
  >("loading");
  const voice = React.useRef<SpeechSynthesisVoice | null>(null);
  const utterance = React.useRef<SpeechSynthesisUtterance | null>(null);
  const watchdog = React.useRef<number>();
  const callbacks = React.useRef({ onAvailabilityChange, onPlayed });
  callbacks.current = { onAvailabilityChange, onPlayed };
  React.useEffect(() => {
    if (
      !("speechSynthesis" in window) ||
      !("SpeechSynthesisUtterance" in window)
    ) {
      setState("unsupported");
      callbacks.current.onAvailabilityChange?.(false);
      return;
    }
    const synth = window.speechSynthesis;
    function findVoice() {
      const voices = synth.getVoices();
      voice.current =
        voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ??
        voices.find((v) => v.lang.split(/[-_]/)[0] === lang.split(/[-_]/)[0]) ??
        null;
      const ok = !!voice.current;
      setAvailable(ok);
      setState(ok ? "idle" : "unsupported");
      callbacks.current.onAvailabilityChange?.(ok);
    }
    findVoice();
    synth.addEventListener("voiceschanged", findVoice);
    const ready = window.setTimeout(findVoice, 1500);
    return () => {
      clearTimeout(ready);
      clearTimeout(watchdog.current);
      utterance.current = null;
      synth.cancel();
      synth.removeEventListener("voiceschanged", findVoice);
    };
  }, [lang]);
  React.useEffect(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    clearTimeout(watchdog.current);
    utterance.current = null;
    setState(voice.current ? "idle" : "unsupported");
  }, [text]);
  function speak() {
    if (!available || disabled || !voice.current) return;
    const synth = window.speechSynthesis;
    utterance.current = null;
    synth.cancel();
    clearTimeout(watchdog.current);
    const next = new SpeechSynthesisUtterance(text);
    utterance.current = next;
    next.lang = lang;
    next.voice = voice.current;
    next.rate = 0.9;
    let started = false;
    next.onstart = () => {
      if (utterance.current !== next) return;
      started = true;
      clearTimeout(watchdog.current);
      setState("playing");
    };
    next.onend = () => {
      if (utterance.current !== next) return;
      clearTimeout(watchdog.current);
      setState(started ? "done" : "error");
      if (started) callbacks.current.onPlayed?.();
    };
    next.onerror = () => {
      if (utterance.current !== next) return;
      clearTimeout(watchdog.current);
      setState("error");
    };
    setState("playing");
    watchdog.current = window.setTimeout(() => {
      if (utterance.current !== next || started) return;
      utterance.current = null;
      synth.cancel();
      setState("error");
    }, 8000);
    synth.speak(next);
  }
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50 p-4 ${className}`}
    >
      {state === "unsupported" ? (
        <p role="status" className="text-sm leading-6 text-amber-800">
          {t("tts.noVoice", { lang })}
        </p>
      ) : (
        <>
          <button
            type="button"
            className="ielts-button"
            disabled={disabled || !available || state === "playing"}
            onClick={speak}
            aria-label={state === "done" ? t("tts.replay") : t("tts.play")}
          >
            {state === "playing"
              ? t("tts.playing")
              : state === "done"
                ? t("tts.replay")
                : t("tts.play")}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            {t("tts.hint")}
          </p>
          {state === "error" && (
            <p role="alert" className="mt-3 text-sm text-amber-800">
              {t("tts.error")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

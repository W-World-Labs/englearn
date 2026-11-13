
import * as React from "react";
import { Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n/context";

/**
 * Browser SpeechRecognition wrapper for the speaking module.
 * Streams interim + final transcripts upward via `onTranscript`.
 * Degrades gracefully when the Web Speech API is unavailable.
 */
export interface AudioRecorderProps {
  /** Fired on every transcript update with the full accumulated transcript. */
  onTranscript: (transcript: string) => void;
  /** Language tag passed to the recognizer. */
  lang?: string;
  disabled?: boolean;
}

// Minimal structural typing for the (non-standard) Web Speech API.
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
  length: number;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function AudioRecorder({
  onTranscript,
  lang = "en-US",
  disabled = false,
}: AudioRecorderProps) {
  const { t } = useI18n();
  const [supported, setSupported] = React.useState(true);
  const [recording, setRecording] = React.useState(false);
  const [interim, setInterim] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const finalRef = React.useRef("");
  const onTranscriptRef = React.useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  React.useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stop = React.useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = React.useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setError(null);
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalRef.current = (finalRef.current + " " + text).trim();
        } else {
          interimText += text;
        }
      }
      setInterim(interimText);
      const combined = (finalRef.current + " " + interimText).trim();
      onTranscriptRef.current(combined);
    };

    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError(t("open.micDenied"));
      } else if (e.error === "no-speech") {
        setError(t("open.noSpeech"));
      } else if (e.error) {
        setError(t("open.recError"));
      }
    };

    recognition.onend = () => {
      setRecording(false);
      setInterim("");
      onTranscriptRef.current(finalRef.current);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, [lang, t]);

  const reset = React.useCallback(() => {
    recognitionRef.current?.abort();
    setRecording(false);
    setInterim("");
    finalRef.current = "";
    onTranscriptRef.current("");
  }, []);

  if (!supported) {
    return (
      <div
        role="status"
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
      >
        {t("open.unsupported")}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={recording ? stop : start}
          disabled={disabled}
          aria-pressed={recording}
          aria-label={recording ? t("open.stop") : t("open.start")}
          className={[
            "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
            recording
              ? "bg-rose-500 text-white shadow-card"
              : "bg-brand-600 text-white shadow-card hover:bg-brand-700 active:scale-95",
          ].join(" ")}
        >
          {recording && (
            <span className="absolute inset-0 animate-ping rounded-full bg-rose-400 opacity-60" />
          )}
          <span className="relative">
            {recording ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.08A7 7 0 0 0 19 11z" />
              </svg>
            )}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
            {recording ? (
              <>
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                {t("open.listening")}
              </>
            ) : (
              t("open.micHint")
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {t("open.transcriptNote")}
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={reset}
          disabled={disabled || recording}
        >
          {t("open.reset")}
        </Button>
      </div>

      {interim && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm italic text-slate-500">
          {interim}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
        >
          {error}
        </div>
      )}
    </div>
  );
}

export default AudioRecorder;


import * as React from "react";
import type { ClientItem, ClientResponse } from "@/lib/types";
import { Badge, Button } from "@/components/ui";
import AudioRecorder from "./AudioRecorder";
import { useI18n } from "@/lib/i18n/context";

/**
 * Shared item-component contract (format === "open").
 * For the speaking module it surfaces an AudioRecorder whose live transcript
 * flows into the editable textarea; otherwise it is a plain writing prompt.
 */
export interface ItemComponentProps {
  item: ClientItem;
  onAnswer: (resp: ClientResponse) => void;
  disabled?: boolean;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export default function OpenResponseItem({
  item,
  onAnswer,
  disabled = false,
}: ItemComponentProps) {
  const { t } = useI18n();
  const [text, setText] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const isSpeaking = item.module === "speaking";

  // Reset local state when the item changes (new question administered).
  React.useEffect(() => {
    setText("");
    setSubmitted(false);
  }, [item.id]);

  const words = countWords(text);
  const canSubmit = !disabled && !submitted && words > 0;

  const handleTranscript = React.useCallback((transcript: string) => {
    setText(transcript);
  }, []);

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitted(true);
    onAnswer({ itemId: item.id, text: text.trim() });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Badge variant="neutral" className="uppercase tracking-wide">
            {isSpeaking ? t("open.speaking") : t("open.writing")}
          </Badge>
          <h2 className="text-xl font-semibold leading-snug tracking-tight text-slate-900">
            {item.prompt}
          </h2>
        </div>
        <Badge variant="brand" className="shrink-0">
          {item.cefr}
        </Badge>
      </div>

      {item.passage && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm leading-relaxed text-slate-700">
          {item.passage}
        </div>
      )}

      {isSpeaking && (
        <AudioRecorder onTranscript={handleTranscript} disabled={disabled || submitted} />
      )}

      <div>
        <label
          htmlFor={`open-${item.id}`}
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          {isSpeaking ? t("open.transcriptLabel") : t("open.yourAnswer")}
        </label>
        <textarea
          id={`open-${item.id}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled || submitted}
          rows={isSpeaking ? 5 : 8}
          placeholder={
            isSpeaking
              ? t("open.speakingPlaceholder")
              : t("open.writingPlaceholder")
          }
          className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70"
        />
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-slate-400">{t("open.wordHint")}</span>
          <span
            className={
              words === 0 ? "font-medium text-slate-400" : "font-medium text-brand-600"
            }
            aria-live="polite"
          >
            {words === 1 ? t("open.word", { n: words }) : t("open.words", { n: words })}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSubmit} disabled={!canSubmit} size="lg">
          {submitted ? t("open.submitted") : t("open.submit")}
        </Button>
        {submitted && (
          <span className="text-sm text-slate-500">{t("open.grading")}</span>
        )}
      </div>
    </div>
  );
}

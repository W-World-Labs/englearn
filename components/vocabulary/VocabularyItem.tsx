
import * as React from "react";
import type { ClientItem, ClientResponse } from "@/lib/types";
import { Card, CardContent, Badge } from "@/components/ui";
import { useI18n } from "@/lib/i18n/context";

export interface ItemComponentProps {
  item: ClientItem;
  onAnswer: (resp: ClientResponse) => void;
  disabled?: boolean;
}

/**
 * Vocabulary yes/no recognition item.
 *
 * Shows the target word prominently and asks the test-taker whether they
 * know it. Some words are pseudowords (fake words) — the honest answer for
 * those is "不认识 (No)". No correctness feedback is shown because the test
 * adapts in the background.
 *
 * Keyboard: press "Y" to answer Yes, "N" to answer No.
 */
export default function VocabularyItem({
  item,
  onAnswer,
  disabled = false,
}: ItemComponentProps) {
  const { t } = useI18n();
  // Track which choice was just pressed purely for a momentary press affordance.
  const [pressed, setPressed] = React.useState<"yes" | "no" | null>(null);

  const submit = React.useCallback(
    (selectedYes: boolean) => {
      if (disabled) return;
      setPressed(selectedYes ? "yes" : "no");
      onAnswer({ itemId: item.id, selectedYes });
    },
    [disabled, item.id, onAnswer]
  );

  // Reset the transient pressed state whenever a new word is shown.
  React.useEffect(() => {
    setPressed(null);
  }, [item.id]);

  // Y / N keyboard shortcuts.
  React.useEffect(() => {
    if (disabled) return;
    function onKey(e: KeyboardEvent) {
      // Ignore when typing in an input/textarea or with modifier keys held.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === "y") {
        e.preventDefault();
        submit(true);
      } else if (key === "n") {
        e.preventDefault();
        submit(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, submit]);

  const instruction = item.prompt?.trim() || t("vocab.ynInstruction");

  return (
    <Card className="overflow-hidden">
      {/* Top meta strip */}
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">
            {t("modules.vocabulary")}
          </span>
          <span className="text-slate-300" aria-hidden="true">
            •
          </span>
          <span className="text-xs text-slate-400">{t("vocab.recognition")}</span>
        </div>
        <Badge variant="neutral" aria-label={`CEFR level ${item.cefr}`}>
          {item.cefr}
        </Badge>
      </div>

      <CardContent className="px-6 pb-7 pt-6">
        {/* Instruction line */}
        <p
          id={`vocab-instruction-${item.id}`}
          className="mb-6 text-center text-sm text-slate-500"
        >
          {instruction}
        </p>

        {/* The word under test */}
        <div className="relative mb-8 flex min-h-[8rem] items-center justify-center rounded-2xl bg-brand-50/60 px-6 py-10">
          <span
            className="pointer-events-none absolute left-5 top-4 select-none text-5xl font-serif leading-none text-brand-200"
            aria-hidden="true"
          >
            &ldquo;
          </span>
          <h2
            lang="en"
            className="break-words text-center text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl"
          >
            {item.word ?? item.prompt}
          </h2>
        </div>

        {/* Answer buttons */}
        <div
          role="group"
          aria-labelledby={`vocab-instruction-${item.id}`}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <button
            type="button"
            disabled={disabled}
            aria-keyshortcuts="Y"
            onClick={() => submit(true)}
            className={cx(
              answerBase,
              "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/70 focus-visible:ring-emerald-400",
              pressed === "yes" && "border-emerald-400 bg-emerald-50"
            )}
          >
            <span className="flex flex-col items-center gap-1">
              <span className="text-lg font-semibold text-emerald-700">
                {t("vocab.knowYes")}
              </span>
              <span className="text-xs font-medium text-slate-500">
                {t("vocab.knowYesSub")}
              </span>
            </span>
            <kbd className={kbdClass}>Y</kbd>
          </button>

          <button
            type="button"
            disabled={disabled}
            aria-keyshortcuts="N"
            onClick={() => submit(false)}
            className={cx(
              answerBase,
              "border-slate-200 hover:border-brand-300 hover:bg-brand-50/70 focus-visible:ring-brand-400",
              pressed === "no" && "border-brand-300 bg-brand-50"
            )}
          >
            <span className="flex flex-col items-center gap-1">
              <span className="text-lg font-semibold text-slate-700">
                {t("vocab.knowNo")}
              </span>
              <span className="text-xs font-medium text-slate-500">
                {t("vocab.knowNoSub")}
              </span>
            </span>
            <kbd className={kbdClass}>N</kbd>
          </button>
        </div>

        <p className="mt-5 text-center text-xs text-slate-400">
          {t("vocab.ynTip")}
        </p>
      </CardContent>
    </Card>
  );
}

const answerBase =
  "group relative flex h-24 items-center justify-center rounded-2xl border-2 bg-white text-center transition-all duration-200 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

const kbdClass =
  "absolute right-3 top-3 hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[0.65rem] font-medium text-slate-400 sm:inline-block";

function cx(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

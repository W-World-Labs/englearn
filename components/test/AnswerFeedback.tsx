import * as React from "react";
import { Button } from "@/components/ui";
import type { ItemFormat } from "@/lib/types";
import { useI18n } from "@/lib/i18n/context";

export interface AnswerFeedbackProps {
  correct: boolean;
  format: ItemFormat;
  aiScore?: number;
  aiFeedback?: string;
  xpEarned?: number;
  attemptLost?: boolean;
  onDismiss?: () => void;
}

export function AnswerFeedback({
  correct,
  format,
  aiScore,
  aiFeedback,
  xpEarned,
  attemptLost = false,
  onDismiss,
}: AnswerFeedbackProps) {
  const { t, tRandom } = useI18n();
  const isOpen = format === "open";
  const message = React.useMemo(
    () => tRandom(correct ? "feedback.correct" : "feedback.wrong"),
    [correct, tRandom],
  );

  if (isOpen) {
    return (
      <div
        role="status"
        className="animate-fade-up rounded-xl border border-brand-200 bg-brand-50/80 px-5 py-4 text-center"
      >
        <p className="text-sm font-semibold text-brand-800">{t("feedback.aiScore")}</p>
        {typeof aiScore === "number" && (
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {Math.round(aiScore * 100)}
            <span className="text-base font-medium text-slate-500"> / 100</span>
          </p>
        )}
        {aiFeedback && (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {aiFeedback}
          </p>
        )}
        {xpEarned != null && (
          <p className="mt-3 text-sm font-semibold text-brand-700">{t("feedback.practiceXp", { xp: xpEarned })}</p>
        )}
      </div>
    );
  }

  return (
    <div
      role="status"
      data-testid="answer-feedback"
      className={[
        "rounded-2xl border px-6 py-6 text-center",
        correct
          ? "border-brand-200 bg-brand-50 text-brand-900"
          : "border-amber-200 bg-amber-50 text-amber-950",
      ].join(" ")}
    >
      <p className="text-lg font-semibold leading-7">
        {message}
      </p>
      {xpEarned != null && (
        <p className="mt-2 text-sm font-semibold opacity-90">{t("feedback.practiceXp", { xp: xpEarned })}</p>
      )}
      {attemptLost && (
        <p className="mt-1 text-xs font-medium opacity-80">
          {t("feedback.loseAttempt")}
        </p>
      )}
      {onDismiss && (
        <Button className="mt-5 w-full sm:w-auto" onClick={onDismiss}>
          {t("common.continue")} →
        </Button>
      )}
    </div>
  );
}
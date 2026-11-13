import * as React from "react";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/lib/client/auth";
import { apiFetch } from "@/lib/client/api";
export function QuestionFeedback({ question }: { question: string }) {
  const auth = useAuth();
  return (
    <Form
      key={question + ":" + (auth.user?.sub ?? "guest")}
      question={question}
    />
  );
}
function Form({ question }: { question: string }) {
  const { t } = useI18n(),
    auth = useAuth();
  const [open, setOpen] = React.useState(false),
    [reason, setReason] = React.useState("explanation"),
    [note, setNote] = React.useState(""),
    [status, setStatus] = React.useState<
      "idle" | "sending" | "saved" | "error"
    >("idle");
  const pending = React.useRef<{
    id: string;
    startedAt: number;
    question: string;
    reason: string;
    note: string;
    status: "finished";
  } | null>(null);
  const active = React.useRef(true);
  React.useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const send = async () => {
    if (!auth.user || !active.current) return;
    setStatus("sending");
    const session = pending.current ?? {
      id: "feedback-" + crypto.randomUUID(),
      startedAt: Date.now(),
      status: "finished" as const,
      question,
      reason,
      note,
    };
    pending.current = session;
    try {
      const r = await apiFetch("/api/learning/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-LingoLearn-Account": auth.user.sub,
        },
        body: JSON.stringify({ session, revision: null }),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw Error();
      if (active.current) setStatus("saved");
    } catch {
      if (active.current) setStatus("error");
    }
  };
  return (
    <div className="mt-4 text-sm" data-testid="question-feedback">
      <button
        className="min-h-11 text-slate-600 underline"
        aria-expanded={open}
        onClick={() => setOpen((x) => !x)}
      >
        {t("feedback.question.cta")}
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4">
          {!auth.user ? (
            <>
              <p>
                {t("feedback.question.signInHint")}
              </p>
              <button
                className="ielts-button mt-3"
                onClick={() =>
                  auth.login(window.location.pathname + window.location.search)
                }
              >
                {t("feedback.question.signIn")}
              </button>
            </>
          ) : status === "saved" ? (
            <p role="status">
              {t("feedback.question.saved")}
            </p>
          ) : (
            <>
              <label className="block">
                {t("feedback.question.issueType")}
                <select
                  className="mt-2 block min-h-11 w-full rounded-lg border px-3"
                  value={reason}
                  disabled={status === "sending" || !!pending.current}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="answer">
                    {t("feedback.question.answerError")}
                  </option>
                  <option value="explanation">
                    {t("feedback.question.unclearExplanation")}
                  </option>
                  <option value="difficulty">
                    {t("feedback.question.difficultyMismatch")}
                  </option>
                </select>
              </label>
              <label className="mt-3 block">
                {t("feedback.question.details")}
                <textarea
                  className="mt-2 block w-full rounded-lg border p-3"
                  maxLength={500}
                  value={note}
                  disabled={status === "sending" || !!pending.current}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <button
                className="ielts-button mt-3"
                disabled={status === "sending"}
                onClick={() => void send()}
              >
                {status === "sending"
                  ? t("feedback.question.saving")
                  : status === "error"
                    ? t("feedback.question.retry")
                    : t("feedback.question.submit")}
              </button>
              {status === "error" && (
                <p role="alert" className="mt-2">
                  {t("feedback.question.saveError")}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

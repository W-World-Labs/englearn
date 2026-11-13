import { useI18n } from "@/lib/i18n/context";
import { examMessages } from "@/lib/exams/messages";
export function ExamSaveStatus({
  status,
  onRetry,
  onLogin,
  onBackup,
  onUseServer,
  onGuest,
  compact = false,
}: {
  status:
    "guest" | "loading" | "pending" | "saving" | "saved" | "error" | "conflict";
  onRetry: () => void;
  onLogin: () => void;
  onBackup: () => void;
  onUseServer: () => void;
  onGuest?: () => void;
  compact?: boolean;
}) {
  const m = examMessages(useI18n().locale);
  const warning = status === "error" || status === "conflict";
  return (
    <div
      data-testid="exam-cloud-status"
      role="status"
      className={`flex flex-wrap items-center gap-2 text-xs leading-5 ${compact && !warning ? "border-0 px-0 py-1" : "border-y border-black/5 px-5 py-2.5"} ${warning ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-600"}`}
    >
      <span className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${status === "saved" ? "bg-emerald-600" : warning ? "bg-amber-600" : "bg-slate-400"}`}
        />
        {m[status]}
      </span>
      {status === "error" && (
        <>
          <button className="underline" onClick={onRetry}>
            {m.retrySync}
          </button>
          <button className="underline" onClick={onLogin}>
            {m.signInAgain}
          </button>
        </>
      )}
      {warning && onGuest && <button className="min-h-11 underline" onClick={onGuest}>{m.freeUse}</button>}
      {warning && (
        <button className="underline" onClick={onBackup}>
          {m.backup}
        </button>
      )}
      {status === "conflict" && (
        <button
          className="underline"
          onClick={() => {
            onBackup();
            onUseServer();
          }}
        >
          {m.loadServer}
        </button>
      )}
    </div>
  );
}

import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/lib/client/auth";
import { vocabularyMessages } from "@/lib/vocabulary/messages";
import { vocabularyDraftFor, type DraftBadge } from "@/lib/exams/drafts";
export function VocabularyEntry({ compact = false }: { compact?: boolean }) {
  const m = vocabularyMessages(useI18n().locale);
  const { user } = useAuth();
  const owner = user ? `user:${user.sub}` : "guest";
  const [draft, setDraft] = React.useState<DraftBadge | null>(null);
  React.useEffect(() => {
    setDraft(vocabularyDraftFor(owner));
  }, [owner]);
  return (
    <Link
      to="/vocabulary"
      className={`${compact ? "" : "mt-6"} catalog-entry rounded-2xl border border-stone-200 bg-white`}
    >
      <div className="min-w-0 flex-1">
        <h2 className="font-medium">{m.entry}</h2>
        {draft && (
          <p
            data-testid="vocabulary-draft"
            className="mt-1 text-sm text-amber-900"
          >
            {draft.label} ·{" "}
            {draft.status === "running" ? m.resume : m.report}
          </p>
        )}
      </div>
      <span aria-hidden="true" className="text-slate-400">→</span>
    </Link>
  );
}

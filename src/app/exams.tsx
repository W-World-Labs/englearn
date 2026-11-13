import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/PageShell";
import { ExamEntryCards } from "@/components/exams/ExamEntryCards";
import { VocabularyEntry } from "@/components/vocabulary/VocabularyEntry";
import { useI18n } from "@/lib/i18n/context";
import { examMessages } from "@/lib/exams/messages";
export const Route = createFileRoute("/exams")({ component: ExamCentre });
function ExamCentre() {
  const m = examMessages(useI18n().locale);
  return (
    <PageShell active="exams" title={m.centre} wide>
      <h1 className="sr-only">{m.centre}</h1>
      <ExamEntryCards />
      <VocabularyEntry />
      <p className="mt-6 max-w-3xl text-xs leading-6 text-slate-500">
        {m.original}
      </p>
    </PageShell>
  );
}

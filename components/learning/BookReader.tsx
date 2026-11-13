import * as React from "react";
import { apiFetch } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n/context";
import { BOOK } from "@/lib/learning/catalog";
import { learningMessages } from "@/lib/learning/messages";
import { examMessages } from "@/lib/exams/messages";

/** Load the public text edition only when opening the library, without a PDF runtime dependency. */
export function BookReader({ page }: { page: number }) {
  const { locale } = useI18n(),
    m = learningMessages(locale),
    e = examMessages(locale);
  const [view, setView] = React.useState<"text" | "pdf">("text");
  const [pages, setPages] = React.useState<string[] | null>(null);
  const [error, setError] = React.useState(false),
    [retry, setRetry] = React.useState(0);
  const content = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let mounted = true;
    setError(false);
    void apiFetch(`/api/library/book?id=${BOOK.id}&format=text`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Book unavailable");
        const data = await response.json();
        if (
          data.book !== BOOK.id ||
          !Array.isArray(data.pages) ||
          data.pages.length !== BOOK.pages ||
          !data.pages.every((p: unknown) => typeof p === "string")
        )
          throw new Error("Invalid book text");
        if (mounted) setPages(data.pages);
      })
      .catch(() => {
        if (mounted) setError(true);
      })
      .finally(() => clearTimeout(timer));
    return () => {
      mounted = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [retry]);
  React.useEffect(() => {
    content.current?.scrollTo(0, 0);
  }, [page]);
  return (
    <>
      <div className="my-4 flex flex-wrap gap-2">
        {(["text", "pdf"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className="ielts-button aria-pressed:bg-blue-50 aria-pressed:text-blue-900"
            aria-pressed={view === mode}
            onClick={() => setView(mode)}
          >
            {mode === "text" ? m.textView : m.pdfView}
          </button>
        ))}
      </div>
      {view === "text" ? (
        <>
          <p className="mb-4 text-xs leading-6 text-slate-600">{m.textHint}</p>
          {pages ? (
            <div
              ref={content}
              role="region"
              aria-label={m.reading}
              tabIndex={0}
              data-testid="book-text"
              className="max-h-[65vh] min-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-amber-50/30 p-4 sm:p-7"
            >
              <p
                className="mb-4 text-xs font-semibold text-slate-500"
                aria-live="polite"
              >
                {m.page} {page} / {BOOK.pages}
              </p>
              <pre
                lang="en"
                className="whitespace-pre-wrap break-words font-serif text-base leading-8 text-slate-900"
              >
                {pages[page - 1] || m.emptyPage}
              </pre>
            </div>
          ) : error ? (
            <div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm">
              <p>{m.bookError}</p>
              <button
                className="ielts-button mt-3"
                onClick={() => setRetry((n) => n + 1)}
              >
                {e.retry}
              </button>
            </div>
          ) : (
            <p role="status" className="p-4 text-sm">
              {e.preparing}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="mb-4 text-xs leading-6 text-slate-600">{m.pdfHint}</p>
          <iframe
            title={m.reading}
            src={`/api/library/book?id=${BOOK.id}#page=${page}`}
            className="h-[65vh] min-h-96 w-full rounded-xl border border-slate-200"
          />
        </>
      )}
    </>
  );
}

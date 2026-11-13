import { useI18n } from "@/lib/i18n/context";
import { examMessages } from "@/lib/exams/messages";
import {
  characterCount,
  practiceOptionLabel,
  type PracticePaper,
  type PracticeQuestion,
} from "@/lib/exams/catalog";

export function PracticeAnswer({
  question: q,
  language,
  value,
  onChange,
  disabled = false,
}: {
  question: PracticeQuestion;
  language: PracticePaper["language"];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const m = examMessages(useI18n().locale);
  if (q.kind === "choice")
    return (
      <fieldset
        className="mt-6 space-y-3 text-[length:var(--practice-font-size,17px)]"
        lang={language}
        disabled={disabled}
      >
        <legend className="sr-only">{m.answer}</legend>
        {q.options!.map((option, i) => {
          const letter = String.fromCharCode(65 + i);
          return (
            <label
              key={letter}
              className={`flex items-start gap-3 rounded-xl border p-4 leading-7 ${disabled ? "" : "cursor-pointer"} ${value === letter ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}
            >
              <input
                type="radio"
                className="mt-1.5 h-4 w-4 shrink-0"
                name={q.id}
                value={letter}
                checked={value === letter}
                onChange={() => onChange(letter)}
              />
              <span>
                <strong className="mr-3">
                  {practiceOptionLabel(language, i)}
                </strong>{" "}
                {option}
              </span>
            </label>
          );
        })}
      </fieldset>
    );
  return (
    <div className="mt-6 min-w-0">
      <label
        htmlFor="practice-answer"
        className="mb-3 block text-sm font-semibold"
      >
        {m.answer}
      </label>
      {q.kind === "writing" ? (
        <textarea
          id="practice-answer"
          lang={language}
          spellCheck={false}
          autoComplete="off"
          disabled={disabled}
          maxLength={10000}
          className="min-h-64 w-full resize-y rounded-xl border border-slate-300 p-4 text-[length:var(--practice-font-size,17px)] leading-8 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id="practice-answer"
          lang={language}
          spellCheck={false}
          autoComplete="off"
          disabled={disabled}
          maxLength={1000}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {q.kind === "writing" && (
        <p className="mt-2 text-xs leading-6 text-slate-500">
          {characterCount(value, language)}{" "}
          {language === "zh-CN" ? m.hanzi : m.characters} · {m.target}:{" "}
          {q.minChars}–{q.maxChars}
        </p>
      )}
    </div>
  );
}

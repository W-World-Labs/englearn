import * as React from "react";
import { useI18n } from "@/lib/i18n/context";
import {
  DEDICATED_LANGUAGE_IDS,
  LEARNING_LANGUAGES,
  isCoursePlayable,
} from "@/lib/i18n/languages";
import { syncActiveCourse } from "@/lib/gamification/store";

export function CoursePicker({
  onCourseChange,
  disabled = false,
  compact = false,
}: {
  onCourseChange?: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { learningLanguage, setLearningLanguage, t, courseName } = useI18n();
  const [query, setQuery] = React.useState("");
  const searchId = React.useId();
  const available = isCoursePlayable(learningLanguage);
  const matches = LEARNING_LANGUAGES.filter((lang) =>
    `${lang.id} ${t(`courses.${lang.id}.name`)} ${t(`courses.${lang.id}.native`)}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  function select(id: string) {
    setLearningLanguage(id);
    syncActiveCourse(id);
    onCourseChange?.();
  }
  function choice(id: string) {
    return (
      <button
        key={id}
        type="button"
        disabled={disabled}
        onClick={() => select(id)}
        aria-pressed={learningLanguage === id}
        data-language={id}
        className={`min-h-12 rounded-xl border px-3 py-2 text-start text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${learningLanguage === id ? "border-brand-500 bg-brand-50 text-brand-900" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"}`}
      >
        <span className="block font-semibold">{t(`courses.${id}.name`)}</span>
        <span className="block text-xs opacity-80">
          {t(`courses.${id}.native`)}
        </span>
        {!isCoursePlayable(id) && (
          <span className="mt-1 block text-xs">{t("course.unavailable")}</span>
        )}
      </button>
    );
  }
  if (compact)
    return (
      <label className="mb-4 flex flex-wrap items-center gap-3 text-sm font-medium">
        {t("course.title")}
        <select
          aria-label={t("course.title")}
          disabled={disabled}
          value={learningLanguage}
          onChange={(e) => select(e.target.value)}
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-3"
        >
          {!DEDICATED_LANGUAGE_IDS.includes(
            learningLanguage as (typeof DEDICATED_LANGUAGE_IDS)[number],
          ) && <option value={learningLanguage}>{courseName()}</option>}
          {DEDICATED_LANGUAGE_IDS.map((id) => (
            <option key={id} value={id}>
              {t(`courses.${id}.name`)} · {t(`courses.${id}.native`)}
            </option>
          ))}
        </select>
      </label>
    );
  return (
    <section
      aria-label={t("course.title")}
      className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-slate-900">{t("course.title")}</h2>
        <p className="text-xs text-slate-600" aria-live="polite">
          {t("course.learning", { name: courseName() })}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {DEDICATED_LANGUAGE_IDS.map(choice)}
      </div>
      <p
        className={`mt-3 text-sm leading-6 ${available ? "text-slate-600" : "text-amber-900"}`}
        data-testid="course-availability"
        role="status"
      >
        {t(available ? "course.availableHint" : "course.unavailableHint", {
          name: courseName(),
        })}
      </p>
      <details className="mt-3 border-t border-slate-100 pt-3">
        <summary className="min-h-11 cursor-pointer content-center text-sm font-medium text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">
          {t("course.browse")}
        </summary>
        <label htmlFor={searchId} className="mt-2 block text-sm text-slate-700">
          {t("course.search")}
        </label>
        <input
          id={searchId}
          type="search"
          disabled={disabled}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <div className="mt-3 grid max-h-72 grid-cols-2 gap-2 overflow-y-auto p-1 sm:grid-cols-3">
          {matches.map((lang) => choice(lang.id))}
        </div>
        {matches.length === 0 && (
          <p role="status" className="mt-2 text-sm text-slate-600">
            {t("course.noMatches")}
          </p>
        )}
      </details>
    </section>
  );
}

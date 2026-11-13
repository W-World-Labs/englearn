import { useI18n } from "@/lib/i18n/context";
import { PICKER_LOCALES } from "@/lib/i18n/ui-locales";
import type { UiLocale } from "@/lib/i18n/types";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Interface language</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as UiLocale)}
        className="min-h-11 max-w-[6.5rem] cursor-pointer rounded-lg border border-slate-200 bg-white py-1.5 pl-2 pr-6 text-xs font-medium text-slate-700 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:max-w-[7.5rem]"
        aria-label="Interface language"
      >
        {PICKER_LOCALES.map((l) => (
          <option key={l.id} value={l.id}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  );
}

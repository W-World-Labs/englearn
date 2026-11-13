import { Link } from "@tanstack/react-router";
import { AuthButton } from "@/components/learn/AuthButton";
import { LanguageSwitcher } from "@/components/learn/LanguageSwitcher";
import { useI18n } from "@/lib/i18n/context";
import { learningMessages } from "@/lib/learning/messages";
import { vocabularyMessages } from "@/lib/vocabulary/messages";

export interface AppHeaderProps {
  title?: string;
  active?:
    | "learn"
    | "home"
    | "test"
    | "history"
    | "guide"
    | "ielts"
    | "exams"
    | "vocabulary";
}

export function AppHeader({ active, title }: AppHeaderProps) {
  const { t, locale } = useI18n();

  return (
    <header className="app-header grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      <Link
        to="/"
        className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xs font-semibold text-white">
          L
        </span>
        <span className="truncate text-base font-semibold tracking-tight text-brand-800">
          {title ?? t("app.name")}
        </span>
      </Link>
      <nav aria-label={t("app.name")} className="app-navigation">
        {(["home", "learn", "vocabulary", "exams", "history"] as const).map(
          (item) => (
            <Link
              key={item}
              to={
                item === "home"
                  ? "/"
                  : item === "learn"
                    ? "/learn"
                    : item === "vocabulary"
                      ? "/vocabulary"
                      : item === "exams"
                        ? "/exams"
                        : "/history"
              }
              search={item === "history" ? { page: 1 } : item === "learn" ? { tab: "courses" } : undefined}
              aria-current={
                active === item || (active === "ielts" && item === "exams")
                  ? "page"
                  : undefined
              }
              className={`app-navigation-item ${active === item || (active === "ielts" && item === "exams") ? "is-active" : ""}`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path
                  d={
                    {
                      home: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
                      learn:
                        "M12 5v16M12 5C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1Z",
                      vocabulary:
                        "M4 5h10M9 3v2M5 8c1 4 4 7 8 9M13 8c-1 4-4 7-8 9M14 21l4-11 4 11M15 18h6",
                      exams: "M9 4h6v3H9ZM7 5H5v16h14V5h-2M8 11h8M8 15h8",
                      history: "M4 20h16M7 16v-4M12 16V5M17 16V9",
                    }[item]
                  }
                />
              </svg>
              <span className="app-navigation-label">{item === "home"
                ? t("ieltsPrep.navtoday")
                : item === "learn"
                  ? learningMessages(locale).name
                  : item === "vocabulary"
                    ? vocabularyMessages(locale).name
                    : t(`nav.${item}`)}</span>
            </Link>
          ),
        )}
      </nav>
      <div className="col-start-2 row-start-1 flex items-center justify-self-end gap-1 sm:gap-2">
        {active !== "home" && <LanguageSwitcher />}
        <AuthButton />
      </div>
    </header>
  );
}

export function AppFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-4 flex items-center justify-between gap-3 py-2 text-xs text-slate-500">
      <p>{t("app.name")}</p>
      <Link
        to="/guide"
        className="inline-flex min-h-11 items-center text-brand-700 hover:underline"
      >
        {t("nav.guide")}
      </Link>
    </footer>
  );
}

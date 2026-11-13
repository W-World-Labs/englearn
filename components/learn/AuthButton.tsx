import { Button } from "@/components/ui";
import { useAuth } from "@/lib/client/auth";
import { useI18n } from "@/lib/i18n/context";

export function AuthButton() {
  const { t } = useI18n();
  const { configured, loading, error, user, refresh, login, logout } = useAuth();

  if (loading) {
    return (
      <span
        className="h-11 w-16 animate-pulse rounded-lg bg-slate-100"
        aria-hidden
      />
    );
  }

  if (error) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="min-h-11 text-amber-900"
        title={t("auth.checkError")}
        aria-label={`${t("auth.checkError")} ${t("auth.retryCheck")}`}
        onClick={() => void refresh()}
      >
        {t("auth.retryCheck")}
      </Button>
    );
  }

  if (!configured) return null;

  if (user) {
    const label = user.name || user.login || user.email || t("auth.signedIn");
    return (
      <div className="flex items-center gap-1">
        <span
          className="hidden max-w-[100px] truncate text-xs font-bold text-slate-600 lg:inline"
          title={label}
        >
          {label}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 font-bold text-slate-500"
          onClick={() => logout()}
        >
          {t("auth.logout")}
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      className="min-h-11 font-bold"
      onClick={() => login()}
    >
      {t("auth.loginSync")}
    </Button>
  );
}

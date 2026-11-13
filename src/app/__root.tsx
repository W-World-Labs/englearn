import {
  Outlet,
  Link,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import * as React from "react";
import { Button } from "@/components/ui";
import { AuthProvider } from "@/lib/client/auth";
import { I18nProvider, useI18n } from "@/lib/i18n/context";
import { isRtlLocale } from "@/lib/i18n/ui-locales";
import appCss from "./globals.css?url";

const RADAR_SDK = (process.env.W_RADAR_SDK_CODE ?? "").trim();
const RADAR_BOOTSTRAP = (process.env.W_RADAR_BOOTSTRAP_URL ?? "").trim();
const RADAR_WORKSPACE = (process.env.W_RADAR_WORKSPACE_ID ?? "").trim();
const RADAR_PROJECT = (process.env.W_RADAR_PROJECT_ID ?? "").trim();
const RADAR_ENABLED = (() => {
  try {
    const url = new URL(RADAR_BOOTSTRAP);
    return url.protocol === "https:" && Boolean(url.hostname) &&
      !url.username && !url.password && Boolean(RADAR_SDK) &&
      Boolean(RADAR_WORKSPACE) && Boolean(RADAR_PROJECT);
  } catch {
    return false;
  }
})();

function DocumentLocale() {
  const { locale, t } = useI18n();
  React.useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtlLocale(locale) ? "rtl" : "ltr";
    document.title = t("app.metaTitle");
  }, [locale, t]);
  React.useEffect(() => {
    // Radar renders in a shadow root; keep its launcher clear of the app tabs.
    const positionFeedback = () => {
      const root = document.getElementById("radar-feedback")?.shadowRoot;
      if (!root) return;
      const style = document.createElement("style");
      style.textContent = ":host{bottom:calc(4.5rem + env(safe-area-inset-bottom))!important;display:var(--englearn-feedback-display,block)!important}";
      root.append(style);
      observer.disconnect();
    };
    const observer = new MutationObserver(positionFeedback);
    observer.observe(document.body, { childList: true });
    positionFeedback();
    return () => observer.disconnect();
  }, []);
  return null;
}

function NotFoundInner() {
  const { t } = useI18n();
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-6xl font-black text-brand-200">404</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">
        {t("common.notFound")}
      </h1>
      <p className="mt-2 text-sm text-slate-500">{t("common.notFoundDesc")}</p>
      <div className="mt-8 flex gap-3">
        <Link to="/">
          <Button>{t("common.backHome")}</Button>
        </Link>
        <Link to="/test">
          <Button variant="outline">{t("common.startTest")}</Button>
        </Link>
      </div>
    </main>
  );
}

function ErrorInner({ reset }: { reset: () => void }) {
  const { t } = useI18n();
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-6xl font-black text-brand-200">!</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">
        {t("common.error")}
      </h1>
      <p className="mt-2 text-sm text-slate-500">{t("common.errorDesc")}</p>
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>{t("common.retry")}</Button>
        <Link to="/">
          <Button variant="outline">{t("common.backHome")}</Button>
        </Link>
      </div>
    </main>
  );
}

export const Route = createRootRoute({
  notFoundComponent: () => (
    <I18nProvider>
      <NotFoundInner />
    </I18nProvider>
  ),
  errorComponent: ({ reset }) => (
    <I18nProvider>
      <ErrorInner reset={reset} />
    </I18nProvider>
  ),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "theme-color", content: "#faf7f1" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      {
        title: "LingoLearn — Any language, any interface",
      },
      {
        name: "description",
        content:
          "Learn any language with the app UI in any language. Adaptive practice, XP, streaks, crowns and leagues.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
    scripts: [
      ...(RADAR_ENABLED ? [{
        src: RADAR_BOOTSTRAP,
        async: true,
        crossOrigin: "anonymous" as const,
        referrerPolicy: "no-referrer" as const,
        "data-client-kind": "paas-platform",
        "data-workspace-id": RADAR_WORKSPACE,
        "data-project-id": RADAR_PROJECT,
        "data-code": RADAR_SDK,
        "data-capture-network": "false",
        "data-capture-global-errors": "false",
        "data-allow-url-query": "false",
      }] : []),
    ],
  }),
  component: RootLayout,
});

function RootLayout() {
  return (
    <I18nProvider>
      <AuthProvider>
        <DocumentLocale />
        <html lang="zh-CN">
          <head>
            <HeadContent />
          </head>
          <body className="font-sans antialiased">
            <Outlet />
            <Scripts />
          </body>
        </html>
      </AuthProvider>
    </I18nProvider>
  );
}

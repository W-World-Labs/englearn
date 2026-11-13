import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button, Card } from "@/components/ui";
import { PageShell } from "@/components/layout/PageShell";
import ResultReport from "@/components/results/ResultReport";
import { ResultsRewards } from "@/components/results/ResultsRewards";
import { useAssessmentResult } from "@/lib/client/useAssessmentResult";
import { claimTestSession } from "@/lib/client/api";
import { getStoredClaimSecret } from "@/lib/client/claim-session";
import { useAuth } from "@/lib/client/auth";
import { parseResultsSearch } from "@/lib/routes/search";
import { historyRoute } from "@/lib/routes/navigation";
import { learningMessages } from "@/lib/learning/messages";
import { useI18n } from "@/lib/i18n/context";

export const Route = createFileRoute("/results")({
  validateSearch: parseResultsSearch,
  component: ResultsPage,
});

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="max-w-md p-10 text-center">{children}</Card>
    </div>
  );
}

function ResultsPage() {
  const { sid } = Route.useSearch();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const auth = useAuth();
  const { status, result } = useAssessmentResult(sid, {
    waitUntilReady: true,
  });
  const [claimState, setClaimState] = React.useState<
    "idle" | "pending" | "claimed" | "failed"
  >("idle");
  const claimSecret = sid ? getStoredClaimSecret(sid) : null;
  const claimable =
    Boolean(auth.user) &&
    Boolean(result && !result.userId) &&
    Boolean(claimSecret);

  React.useEffect(() => {
    if (!sid && status === "missing") {
      void navigate({ to: "/test", replace: true });
    }
  }, [sid, status, navigate]);

  if (!sid || status === "loading" || status === "idle") {
    return (
      <PageShell wide>
        <CenteredCard>
          <p className="text-sm text-slate-500">{t("common.loading")}</p>
        </CenteredCard>
      </PageShell>
    );
  }

  if (status === "forbidden") {
    return (
      <PageShell wide>
        <CenteredCard>
          <h2 className="text-lg font-semibold text-slate-900">
            {t("common.reportForbidden")}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {t("common.reportForbiddenDesc")}
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button onClick={() => void navigate(historyRoute())}>
              {t("common.viewHistory")}
            </Button>
            <Link to="/">
              <Button variant="outline">{t("common.backHome")}</Button>
            </Link>
          </div>
        </CenteredCard>
      </PageShell>
    );
  }

  if (status === "missing" || status === "error") {
    return (
      <PageShell wide>
        <CenteredCard>
          <h2 className="text-lg font-semibold text-slate-900">
            {t("common.reportMissing")}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {t("common.reportMissingDesc")}
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/test">
              <Button>{t("common.startTest")}</Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => void navigate(historyRoute())}
            >
              {t("common.viewHistory")}
            </Button>
          </div>
        </CenteredCard>
      </PageShell>
    );
  }

  if (status !== "ready" || !result) {
    return null;
  }

  return (
    <PageShell wide>
      <div className="mt-6 sm:mt-10">
        <ResultsRewards result={result} />
        <ResultReport result={result} />
        {!auth.user && auth.configured && (
          <p className="mt-8 text-center text-xs leading-6 text-slate-500">
            {t("report.guestNote")}{" "}
            <button
              type="button"
              className="font-semibold text-brand-700 underline"
              onClick={() =>
                auth.login(window.location.pathname + window.location.search)
              }
            >
              {t("auth.login")}
            </button>
          </p>
        )}
        {auth.user && claimable && (
          <p className="mt-8 text-center text-xs leading-6 text-slate-500">
            {claimState === "claimed" ? (
              t("report.claimed")
            ) : (
              <>
                {t("report.claimNote")}{" "}
                <button
                  type="button"
                  disabled={claimState === "pending"}
                  className="font-semibold text-brand-700 underline disabled:opacity-50"
                  onClick={async () => {
                    if (!sid || !claimSecret) return;
                    setClaimState("pending");
                    const ok = await claimTestSession(sid, claimSecret);
                    setClaimState(ok ? "claimed" : "failed");
                  }}
                >
                  {t("report.claim")}
                </button>
                {claimState === "failed" ? ` ${t("report.claimFailed")}` : null}
              </>
            )}
          </p>
        )}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/learn">
            <Button>{learningMessages(locale).homeCta} →</Button>
          </Link>
          <Link to="/test">
            <Button variant="outline">{t("common.startTest")}</Button>
          </Link>
          <Button
            variant="secondary"
            onClick={() => void navigate(historyRoute())}
          >
            {t("common.viewHistory")}
          </Button>
          <Link to="/">
            <Button variant="ghost">{t("common.backHome")}</Button>
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
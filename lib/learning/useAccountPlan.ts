import * as React from "react";
import { apiFetch } from "@/lib/client/api";
import { LEARNING_LANGUAGES, type LearningLanguage } from "./catalog";
import type { AccountLearningPlan } from "./plan";
export type PlanStatus = "idle" | "loading" | "ready" | "error" | "expired";
/** No shared/browser cache: plans never cross an account or language boundary. */
export function useAccountPlan(owner: string | undefined, language: string) {
  const key =
    owner && LEARNING_LANGUAGES.includes(language as LearningLanguage)
      ? JSON.stringify([owner, language])
      : "";
  const [state, setState] = React.useState<{
    key: string;
    status: PlanStatus;
    data: AccountLearningPlan | null;
  }>({ key: "", status: "idle", data: null });
  const [refresh, setRefresh] = React.useState(0);
  const retry = React.useCallback(() => setRefresh((n) => n + 1), []);
  React.useEffect(() => {
    if (!key || !owner) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    let active = true;
    setState({ key, status: "loading", data: null });
    void apiFetch(
      "/api/learning/plan?language=" + encodeURIComponent(language),
      {
        headers: { "X-LingoLearn-Account": owner },
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          if (active) setState({ key, status: "expired", data: null });
          return;
        }
        if (!response.ok) throw Error("Plan unavailable");
        const data = (await response.json()) as AccountLearningPlan;
        if (
          data.version !== 1 ||
          data.plan?.language !== language ||
          data.evidence?.language !== language ||
          !Array.isArray(data.plan.lessons) ||
          !Array.isArray(data.plan.wordIds)
        )
          throw Error("Invalid plan");
        if (active) setState({ key, status: "ready", data });
      })
      .catch(() => {
        if (active) setState({ key, status: "error", data: null });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, owner, language, refresh]);
  React.useEffect(() => {
    if (!key) return;
    // A new assessment in another tab is picked up on return. User retry is bounded to one request.
    const visible = () => {
      if (document.visibilityState === "visible") retry();
    };
    window.addEventListener("focus", retry);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", retry);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [key, retry]);
  return {
    status: (!key
      ? "idle"
      : state.key === key
        ? state.status
        : "loading") as PlanStatus,
    data: key && state.key === key ? state.data : null,
    retry,
  };
}

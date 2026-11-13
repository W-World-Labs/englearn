import * as React from "react";
import {
  fetchAssessmentResultStatus,
  waitForAssessmentResult,
} from "@/lib/client/api";
import type { TestResult } from "@/lib/types";

export type AssessmentResultStatus =
  | "idle"
  | "loading"
  | "ready"
  | "missing"
  | "forbidden"
  | "error";

export function useAssessmentResult(
  sessionId: string | undefined,
  opts?: { waitUntilReady?: boolean }
) {
  const [status, setStatus] = React.useState<AssessmentResultStatus>("idle");
  const [result, setResult] = React.useState<TestResult | null>(null);

  React.useEffect(() => {
    if (!sessionId) {
      setStatus("missing");
      setResult(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setStatus("loading");
      setResult(null);
      try {
        if (opts?.waitUntilReady) {
          const data = await waitForAssessmentResult(sessionId);
          if (cancelled) return;
          if (!data) {
            setStatus("missing");
            return;
          }
          setResult(data);
          setStatus("ready");
          return;
        }

        const outcome = await fetchAssessmentResultStatus(sessionId);
        if (cancelled) return;
        if (outcome.status === "ready") {
          setResult(outcome.result);
          setStatus("ready");
          return;
        }
        setStatus(outcome.status);
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, opts?.waitUntilReady]);

  return { status, result, sessionId };
}
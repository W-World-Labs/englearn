import * as React from "react";
import {
  deleteAssessmentResult,
  fetchHistoryAll,
  fetchHistoryPage,
} from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import type { PaginatedResult } from "@/lib/pagination";
import type { TestResult } from "@/lib/types";

export function useHistoryData(page: number, pageSize: number) {
  const { user, loading: authLoading } = useAuth();
  const [all, setAll] = React.useState<TestResult[]>([]);
  const [paged, setPaged] = React.useState<PaginatedResult<TestResult> | null>(
    null
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);

  const reload = React.useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  React.useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [allRows, pageRows] = await Promise.all([
          fetchHistoryAll(),
          fetchHistoryPage(page, pageSize),
        ]);
        if (cancelled) return;
        setAll(allRows);
        setPaged(pageRows);
      } catch {
        if (!cancelled) setError("load_failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, user?.sub, authLoading, version]);

  const remove = React.useCallback(
    async (sessionId: string) => {
      const ok = await deleteAssessmentResult(sessionId);
      if (ok) reload();
      return ok;
    },
    [reload]
  );

  return {
    all,
    paged,
    loading: loading || authLoading,
    error,
    reload,
    remove,
  };
}
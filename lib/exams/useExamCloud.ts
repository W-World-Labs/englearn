import * as React from "react";
import { apiFetch } from "@/lib/client/api";
import type { SavedAttempt } from "./storage-types";
import type { PaginatedResult } from "@/lib/pagination";

type CloudStatus =
  "guest" | "loading" | "pending" | "saving" | "saved" | "error" | "conflict";
type CloudList<T, S> = PaginatedResult<S> & {
  latest: SavedAttempt<T> | null;
  draft: SavedAttempt<T> | null;
};
type Meta = { revision: number; signature: string };

export function useExamCloud<
  T extends { id: string; status: "running" | "finished" },
  S,
>({
  prefix,
  endpoint,
  account,
  loaded,
  session,
  current,
  commit,
}: {
  prefix: string;
  endpoint: string;
  account: string | null;
  loaded: boolean;
  session: T | null;
  current: React.MutableRefObject<T | null>;
  commit: (session: T) => void;
}) {
  const signedIn = !!account;
  const [status, setStatusState] = React.useState<CloudStatus>(
    signedIn ? "loading" : "guest",
  );
  const statusRef = React.useRef(status);
  const [history, setHistory] = React.useState<CloudList<T, S> | null>(null);
  const [conflict, setConflict] = React.useState<SavedAttempt<T> | null>(null);
  const metadata = React.useRef<Record<string, Meta>>({});
  const busy = React.useRef(false);
  const restoring = React.useRef(false);
  const restoreRequest = React.useRef(0);
  const mounted = React.useRef(true);
  const setStatus = React.useCallback((next: CloudStatus) => {
    statusRef.current = next;
    if (mounted.current) setStatusState(next);
  }, []);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const getMeta = React.useCallback(
    (id: string): Meta | null => {
      if (metadata.current[id]) return metadata.current[id];
      try {
        const meta = JSON.parse(
          localStorage.getItem(`${prefix}:${id}:cloud`) || "null",
        ) as Meta | null;
        if (
          meta &&
          Number.isInteger(meta.revision) &&
          typeof meta.signature === "string"
        )
          return (metadata.current[id] = meta);
      } catch {
        /* In-memory metadata still allows cloud saves when storage is blocked. */
      }
      return null;
    },
    [prefix],
  );

  const remember = React.useCallback(
    (attempt: SavedAttempt<T>, signature = JSON.stringify(attempt.session)) => {
      const meta = { revision: attempt.revision, signature };
      metadata.current[attempt.session.id] = meta;
      try {
        localStorage.setItem(
          `${prefix}:${attempt.session.id}:cloud`,
          JSON.stringify(meta),
        );
      } catch {
        /* Browser save warning is owned by the exam workspace. */
      }
    },
    [prefix],
  );

  const adopt = React.useCallback(
    (attempt: SavedAttempt<T>) => {
      remember(attempt);
      commit(attempt.session);
      setConflict(null);
      setStatus("saved");
    },
    [remember, commit, setStatus],
  );

  const readHistory = React.useCallback(
    async (page = 1, restore = false) => {
      if (!account || !mounted.current) return;
      const request = restore ? ++restoreRequest.current : restoreRequest.current;
      if (restore) {
        restoring.current = true;
        setStatus("loading");
      }
      try {
        const initialId = current.current?.id;
        const initialMeta = initialId ? getMeta(initialId) : null;
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "10",
        });
        if (restore && current.current)
          params.set("draftId", current.current.id);
        const response = await apiFetch(`${endpoint}?${params}`, {
          headers: { "X-LingoLearn-Account": account },
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error("History unavailable");
        const data = (await response.json()) as CloudList<T, S>;
        if (!mounted.current || (restore && request !== restoreRequest.current))
          return;
        setHistory(data);
        if (!restore) return;
        const local = current.current;
        if (local?.id !== initialId) {
          setStatus(
            !local || getMeta(local.id)?.signature === JSON.stringify(local)
              ? "saved"
              : "pending",
          );
          return;
        }
        if (!local) {
          if (data.latest) adopt(data.latest);
          else setStatus("saved");
          return;
        }
        const signature = JSON.stringify(local);
        const meta = getMeta(local.id);
        // A save that was already in flight may finish while this GET waits.
        // Its acknowledgement is newer than the snapshot used to restore.
        if (meta !== initialMeta) {
          setStatus(meta?.signature === signature ? "saved" : "pending");
          return;
        }
        if (
          meta?.signature === signature &&
          local.status === "finished" &&
          data.latest &&
          data.latest.session.id !== local.id
        ) {
          adopt(data.latest);
          return;
        }
        if (!data.draft) {
          delete metadata.current[local.id];
          try {
            localStorage.removeItem(`${prefix}:${local.id}:cloud`);
          } catch {
            /* best effort */
          }
          setStatus("pending");
          return;
        }
        if (
          signature === JSON.stringify(data.draft.session) ||
          meta?.signature === signature
        ) {
          adopt(data.draft);
          return;
        }
        if (meta?.revision === data.draft.revision) {
          setStatus("pending");
          return;
        }
        setConflict(data.draft);
        setStatus("conflict");
      } catch {
        if (
          request === restoreRequest.current &&
          (restore || (!restoring.current && statusRef.current !== "conflict"))
        )
          setStatus("error");
      } finally {
        if (restore && request === restoreRequest.current)
          restoring.current = false;
      }
    },
    [account, current, adopt, getMeta, prefix, endpoint, setStatus],
  );

  React.useEffect(() => {
    if (loaded && signedIn) void readHistory(1, true);
  }, [loaded, signedIn, readHistory]);

  const sync = React.useCallback(async () => {
    const snapshot = current.current;
    if (
      !account ||
      !mounted.current ||
      !loaded ||
      !snapshot ||
      busy.current ||
      restoring.current ||
      ["loading", "error", "conflict"].includes(statusRef.current)
    )
      return;
    const signature = JSON.stringify(snapshot);
    const meta = getMeta(snapshot.id);
    if (meta?.signature === signature) return;
    busy.current = true;
    setStatus("saving");
    try {
      const response = await apiFetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-LingoLearn-Account": account,
        },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          session: snapshot,
          revision: meta?.revision ?? null,
        }),
      });
      const data = (await response.json()) as { attempt?: SavedAttempt<T> };
      if (!mounted.current) return;
      if (response.status === 409 && data.attempt) {
        setConflict(data.attempt);
        setStatus("conflict");
        return;
      }
      if (!response.ok || !data.attempt) throw new Error("Save failed");
      const attempt = data.attempt;
      remember(attempt, signature);
      if (JSON.stringify(current.current) === signature) adopt(attempt);
      else setStatus("pending");
      // Refresh on creation/completion; pagination remains server authoritative.
      if (!meta || snapshot.status === "finished") await readHistory(1);
    } catch {
      setStatus("error");
    } finally {
      busy.current = false;
    }
  }, [
    account,
    loaded,
    endpoint,
    current,
    getMeta,
    remember,
    adopt,
    setStatus,
    readHistory,
  ]);

  const retry = React.useCallback(() => {
    void readHistory(1, true).then(() => sync());
  }, [readHistory, sync]);

  React.useEffect(() => {
    if (!signedIn || !loaded) return;
    const timer = window.setInterval(() => void sync(), 2000);
    const online = () => {
      if (statusRef.current === "error") retry();
    };
    const resume = () => {
      if (document.visibilityState !== "visible" || busy.current || restoring.current)
        return;
      const local = current.current;
      if (
        statusRef.current === "saved" &&
        (!local || getMeta(local.id)?.signature === JSON.stringify(local))
      )
        void readHistory(1, true);
    };
    window.addEventListener("focus", resume);
    window.addEventListener("visibilitychange", resume);
    window.addEventListener("online", online);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("focus", resume);
      window.removeEventListener("visibilitychange", resume);
    };
  }, [signedIn, loaded, sync, retry, current, getMeta, readHistory]);

  React.useEffect(() => {
    if (
      signedIn &&
      session &&
      statusRef.current === "saved" &&
      getMeta(session.id)?.signature !== JSON.stringify(session)
    )
      setStatus("pending");
    if (session?.status === "finished") void sync();
  }, [session, signedIn, sync, getMeta, setStatus]);

  async function flush() {
    if (!signedIn) return true;
    await sync();
    return (
      !restoring.current &&
      !["loading", "error", "conflict", "saving"].includes(statusRef.current) &&
      (!current.current ||
        getMeta(current.current.id)?.signature ===
          JSON.stringify(current.current))
    );
  }

  async function open(id: string) {
    if (!(await flush())) return false;
    if (!account || !mounted.current) return false;
    try {
      const response = await apiFetch(
        `${endpoint}?id=${encodeURIComponent(id)}`,
        {
          headers: { "X-LingoLearn-Account": account },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok) throw new Error("Record unavailable");
      const data = (await response.json()) as { attempt: SavedAttempt<T> };
      if (!mounted.current) return false;
      adopt(data.attempt);
      return true;
    } catch {
      setStatus("error");
      return false;
    }
  }

  return {
    status,
    history,
    conflict,
    open,
    readHistory,
    flush,
    retry,
    useServer: () => {
      if (conflict) adopt(conflict);
    },
  };
}

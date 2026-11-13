import * as React from "react";
import { setProgressAccount, switchProgressAccount } from "@/lib/gamification/store";

export interface AuthProfile {
  sub: string;
  login: string;
  email?: string;
  name?: string;
  picture?: string;
}

export interface AuthState {
  configured: boolean;
  loading: boolean;
  error: boolean;
  user: AuthProfile | null;
  refresh: () => Promise<void>;
  login: (next?: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

async function fetchMe(): Promise<{
  configured: boolean;
  user: AuthProfile | null;
}> {
  const res = await fetch("/api/auth/me", {
    credentials: "include",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error("Unable to verify login");
  const data = (await res.json()) as {
    configured?: boolean;
    user?: AuthProfile | null;
  };
  return {
    configured: data.configured === true,
    user: data.user ?? null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [configured, setConfigured] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [user, setUser] = React.useState<AuthProfile | null>(null);

  const [error, setError] = React.useState(false);
  const authGeneration = React.useRef(0);
  const refresh = React.useCallback(async () => {
    const generation = ++authGeneration.current;
    setLoading(true);
    try {
      const me = await fetchMe();
      if (generation !== authGeneration.current) return;
      if (!(await switchProgressAccount(
        me.user?.sub ?? null,
        () => generation === authGeneration.current,
      ))) return;
      if (generation !== authGeneration.current) return;
      setConfigured(me.configured);
      setUser(me.user);
      setError(false);
    } catch {
      if (generation === authGeneration.current) setError(true);
    } finally {
      if (generation === authGeneration.current) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
    return () => {
      authGeneration.current += 1;
      setProgressAccount(null);
    };
  }, [refresh]);

  const login = React.useCallback((next?: string) => {
    const path =
      typeof window !== "undefined"
        ? (next ?? window.location.pathname + window.location.search)
        : "/";
    window.location.href = `/api/auth/login?next=${encodeURIComponent(path)}`;
  }, []);

  const logout = React.useCallback(async () => {
    authGeneration.current += 1;
    setProgressAccount(user?.sub ?? null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error("Unable to sign out");
      setProgressAccount(null);
      setUser(null);
      window.location.href = "/";
    } catch {
      await refresh();
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [refresh, user?.sub]);

  const value = React.useMemo(
    () => ({ configured, loading, error, user, refresh, login, logout }),
    [configured, loading, error, user, refresh, login, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      <React.Fragment key={user ? `account:${user.sub}` : "guest"}>{children}</React.Fragment>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

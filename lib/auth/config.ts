import { SsoConfig } from "@w-id/sdk";

export const SESSION_COOKIE = "lingolearn_session";
export const OAUTH_STATE_COOKIE = "lingolearn_oauth_state";
export const OAUTH_NEXT_COOKIE = "lingolearn_oauth_next";

export function isAuthConfigured(): boolean {
  const id = (process.env.W_ID_CLIENT_ID ?? "").trim();
  const secret = (process.env.W_ID_CLIENT_SECRET ?? "").trim();
  const jwt = (process.env.JWT_SECRET ?? "").trim();
  return Boolean(id && secret && jwt);
}

export function publicAppOrigin(): string {
  const raw =
    (process.env.ENGLEARN_PUBLIC_URL ?? "").trim() ||
    (process.env.VITE_PUBLIC_URL ?? "").trim();
  if (raw) return raw.replace(/\/+$/, "");
  return "http://localhost:3000";
}

export function resolveRedirectUri(): string {
  const explicit = (process.env.W_ID_REDIRECT_URI ?? "").trim();
  if (explicit) return explicit;
  return `${publicAppOrigin()}/api/auth/callback`;
}

let cached: SsoConfig | null | undefined;

export function getSsoConfig(): SsoConfig | null {
  if (!isAuthConfigured()) return null;
  if (cached !== undefined) return cached;
  try {
    const env = {
      ...process.env,
      W_ID_REDIRECT_URI: resolveRedirectUri(),
    };
    cached = SsoConfig.fromEnv(env);
    return cached;
  } catch {
    cached = null;
    return null;
  }
}
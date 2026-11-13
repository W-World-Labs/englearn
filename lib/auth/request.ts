import { getSsoConfig, isAuthConfigured, SESSION_COOKIE } from "./config";
import { parseCookies } from "./cookies";
import type { TestResult, TestSession } from "@/lib/types";

export interface AuthUser {
  sub: string;
  login: string;
  email?: string;
  name?: string;
  picture?: string;
  isAdmin: boolean;
}

/** Bind account-scoped browser data to the identity verified by that tab. */
export function requestAccountMatches(req: Request, subject: string | null): boolean {
  const expected = req.headers.get("X-LingoLearn-Account");
  return expected === null || expected === (subject ?? "");
}

export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  if (!isAuthConfigured()) return null;
  const cfg = getSsoConfig();
  if (!cfg) return null;

  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;

  const claims = await cfg.verifySessionClaims(token);
  if (!claims) return null;

  const sub = typeof claims.sub === "string" ? claims.sub : "";
  if (!sub) return null;

  return {
    sub,
    login:
      typeof claims.login === "string" && claims.login
        ? claims.login
        : sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
    name: typeof claims.name === "string" ? claims.name : undefined,
    picture: typeof claims.picture === "string" ? claims.picture : undefined,
    isAdmin: claims.is_admin === true,
  };
}

export function canAccessSession(
  session: TestSession,
  user: AuthUser | null
): boolean {
  if (!session.userId) return true;
  return user?.sub === session.userId;
}

export function canAccessResult(
  result: TestResult,
  user: AuthUser | null
): boolean {
  if (!result.userId) return true;
  return user?.sub === result.userId;
}

export function jsonForbidden(): Response {
  return Response.json({ error: "Forbidden" }, { status: 403 });
}

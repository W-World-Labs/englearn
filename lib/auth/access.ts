import { getSession, getResult } from "@/lib/db";
import {
  canAccessResult,
  canAccessSession,
  getAuthUser,
  jsonForbidden,
  requestAccountMatches,
  type AuthUser,
} from "./request";

export async function requireSessionAccess(
  req: Request,
  sessionId: string
): Promise<
  | { ok: true; user: AuthUser | null; session: NonNullable<ReturnType<typeof getSession>> }
  | { ok: false; response: Response }
> {
  const session = getSession(sessionId);
  if (!session) {
    return {
      ok: false,
      response: Response.json({ error: "Session not found" }, { status: 404 }),
    };
  }
  const user = await getAuthUser(req);
  if (!requestAccountMatches(req, user?.sub ?? null)) {
    return { ok: false, response: jsonForbidden() };
  }
  if (!canAccessSession(session, user)) {
    return { ok: false, response: jsonForbidden() };
  }
  return { ok: true, user, session };
}

export async function requireResultAccess(
  req: Request,
  sessionId: string
): Promise<
  | { ok: true; user: AuthUser | null }
  | { ok: false; response: Response }
> {
  const result = getResult(sessionId);
  if (!result) {
    return {
      ok: false,
      response: Response.json({ error: "Result not found" }, { status: 404 }),
    };
  }
  const user = await getAuthUser(req);
  if (!requestAccountMatches(req, user?.sub ?? null)) {
    return { ok: false, response: jsonForbidden() };
  }
  if (!canAccessResult(result, user)) {
    return { ok: false, response: jsonForbidden() };
  }
  return { ok: true, user };
}

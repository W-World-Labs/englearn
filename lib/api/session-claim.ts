import { createHash, timingSafeEqual } from "node:crypto";
import {
  getResult,
  getSession,
  saveResult,
  updateSession,
} from "@/lib/db";
import { getAuthUser, requestAccountMatches } from "@/lib/auth/request";

function claimHashMatches(secret: string, hash: string): boolean {
  const digest = createHash("sha256").update(secret).digest();
  const expected = Buffer.from(hash, "hex");
  return digest.length === expected.length && timingSafeEqual(digest, expected);
}

/**
 * POST /api/session/claim
 * body { sessionId, claimSecret }
 * -> { ok: true, claimed: boolean }
 *
 * Binds a guest session (and its finished result) to the signed-in account.
 * The claim secret was generated on the device that created the session and
 * is held in that browser's localStorage — presenting it proves possession of
 * the creating device, which a bare bearer sessionId cannot. Only the hash is
 * stored server-side. Sessions without a registered claimHash, sessions owned
 * by another account, and mismatched secrets all fail closed.
 */
export async function handleSessionClaimPost(req: Request) {
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json(
      { error: "Sign in to claim a report", code: "unauthenticated" },
      { status: 401 },
    );
  }
  if (!requestAccountMatches(req, user.sub)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { sessionId?: unknown; claimSecret?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const claimSecret =
    typeof body.claimSecret === "string" ? body.claimSecret : "";
  if (!sessionId || !claimSecret) {
    return Response.json(
      { error: "Missing sessionId or claimSecret" },
      { status: 400 },
    );
  }

  const session = getSession(sessionId);
  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.userId === user.sub) {
    return Response.json({ ok: true, claimed: false });
  }
  if (session.userId) {
    return Response.json(
      { error: "Session is owned by another account", code: "claimed" },
      { status: 409 },
    );
  }
  if (!session.claimHash || !claimHashMatches(claimSecret, session.claimHash)) {
    return Response.json(
      { error: "Claim proof failed", code: "invalid_claim" },
      { status: 403 },
    );
  }

  updateSession({ ...session, userId: user.sub });

  const result = getResult(sessionId);
  if (result && !result.userId) {
    saveResult({ ...result, userId: user.sub });
  }

  return Response.json({ ok: true, claimed: true });
}

import { deleteResult, getResult } from "@/lib/db";
import { requireResultAccess } from "@/lib/auth/access";

/**
 * GET /api/result?sessionId=ID
 * -> TestResult
 *
 * Returns the persisted result for a finished session. 404 if the session
 * has not completed (no result was saved) or the id is unknown.
 */
export async function handleResultGet(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return Response.json(
      { error: "Missing sessionId" },
      { status: 400 }
    );
  }

  const access = await requireResultAccess(req, sessionId);
  if (!access.ok) return access.response;

  const result = getResult(sessionId);
  if (!result) {
    return Response.json({ error: "Result not found" }, { status: 404 });
  }

  return Response.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

/** DELETE /api/result?sessionId=ID */
export async function handleResultDelete(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return Response.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const access = await requireResultAccess(req, sessionId);
  if (!access.ok) return access.response;

  if (!deleteResult(sessionId)) {
    return Response.json({ error: "Result not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}

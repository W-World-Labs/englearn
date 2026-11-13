import { requireSessionAccess } from "@/lib/auth/access";
import {
  getPendingClientItem,
  moduleResponseCounts,
} from "@/lib/session-helpers";

/**
 * GET /api/item?sessionId=ID
 * -> { item: ClientItem | null, currentModule, done }
 *
 * Re-fetches the current (most recently administered, not-yet-answered) item
 * for a session — used to resume/rehydrate the runner without re-selecting.
 */
export async function handleItemGet(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return Response.json(
      { error: "Missing sessionId" },
      { status: 400 }
    );
  }

  const access = await requireSessionAccess(req, sessionId);
  if (!access.ok) return access.response;
  const session = access.session;

  if (session.finished) {
    return Response.json({
      item: null,
      currentModule: session.currentModule,
      modules: session.modules,
      moduleCounts: moduleResponseCounts(session),
      done: true,
    });
  }

  const clientItem = getPendingClientItem(session);

  return Response.json({
    item: clientItem,
    currentModule: session.currentModule,
    modules: session.modules,
    moduleCounts: moduleResponseCounts(session),
    done: false,
  });
}

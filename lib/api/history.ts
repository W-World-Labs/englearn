import { getResults } from "@/lib/db";
import { getAuthUser, jsonForbidden, requestAccountMatches } from "@/lib/auth/request";
import { paginateArray, parsePageParams, type PaginatedResult } from "@/lib/pagination";
import type { TestResult } from "@/lib/types";

/**
 * GET /api/history
 * Query: page, pageSize (default 10), all=1 for full list (charts).
 *
 * Logged-in: results for this W-ID user. Guests reopen reports by their saved
 * session links; listing the shared guest store would expose those bearer IDs.
 */
export async function handleHistoryGet(req: Request) {
  const user = await getAuthUser(req);
  if (!requestAccountMatches(req, user?.sub ?? null)) return jsonForbidden();
  const results = user ? getResults({ userId: user.sub }) : [];
  const headers = { "Cache-Control": "private, no-store" };
  const sorted = [...results].sort((a, b) =>
    b.completedAt.localeCompare(a.completedAt)
  );

  const url = new URL(req.url);
  const { page, pageSize, all } = parsePageParams(url.searchParams, {
    page: 1,
    pageSize: 10,
  });

  if (all) {
    return Response.json(sorted, { headers });
  }

  const payload: PaginatedResult<TestResult> = paginateArray(
    sorted,
    page,
    pageSize
  );
  return Response.json(payload, { headers });
}

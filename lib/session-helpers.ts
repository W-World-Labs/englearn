import type { ClientItem, ModuleType, TestSession } from "@/lib/types";
import { getItemById } from "@/lib/items";
import { toClientItem } from "@/lib/api/shared";

/** Count completed responses per module (excludes the in-flight pending item). */
export function moduleResponseCounts(
  session: TestSession
): Record<ModuleType, number> {
  const counts = Object.fromEntries(
    session.modules.map((m) => [m, 0])
  ) as Record<ModuleType, number>;
  const pendingId = getPendingItemId(session);
  for (const r of session.responses) {
    if (r.itemId !== pendingId && session.modules.includes(r.module)) {
      counts[r.module] = (counts[r.module] ?? 0) + 1;
    }
  }
  return counts;
}

/** An unfinished session always ends with its pending item. Older scoring
 * versions placed a draft response on that item before it was submitted. */
export function getPendingItemId(session: TestSession): string | undefined {
  return session.finished ? undefined : session.administeredItemIds.at(-1);
}

export function getPendingClientItem(session: TestSession): ClientItem | null {
  const pendingId = getPendingItemId(session);
  if (!pendingId) return null;
  const item = getItemById(pendingId, session.learningLanguage);
  return item ? toClientItem(item) : null;
}

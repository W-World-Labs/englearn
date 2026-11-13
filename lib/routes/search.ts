import type { ModuleType } from "@/lib/types";

/** URL search params for /results */
export type ResultsSearch = {
  sid?: string;
};

export function parseResultsSearch(
  search: Record<string, unknown>
): ResultsSearch {
  const sid = search.sid;
  return {
    sid: typeof sid === "string" && sid.length > 0 ? sid : undefined,
  };
}

/** URL search params for /test — optional comma-separated modules */
export type TestSearch = {
  modules?: ModuleType[];
};

const ALL_MODULE_IDS = [
  "vocabulary",
  "grammar",
  "reading",
  "listening",
  "speaking",
  "writing",
] as const;

export function parseTestSearch(search: Record<string, unknown>): TestSearch {
  const raw = Array.isArray(search.modules) ? search.modules.join(",") : search.modules;
  if (typeof raw !== "string" || !raw.trim()) return {};
  const picked = raw
    .split(",")
    .map((m) => m.trim())
    .filter((m): m is (typeof ALL_MODULE_IDS)[number] =>
      (ALL_MODULE_IDS as readonly string[]).includes(m)
    );
  return picked.length > 0 ? { modules: [...picked] } : {};
}

/** URL search params for /history */
export type HistorySearch = {
  page: number;
};

export function parseHistorySearch(
  search: Record<string, unknown>
): HistorySearch {
  const raw = search.page;
  const page =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? parseInt(raw, 10)
        : 1;
  return { page: Number.isFinite(page) && page > 0 ? page : 1 };
}
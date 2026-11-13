/**
 * Pure filtering helpers for the practice-history list.
 *
 * The history UI owns pagination and rendering; this module only decides which
 * rounds are visible. Keeping the logic pure means it can be unit-tested
 * without a DOM (the repo deliberately ships no DOM test dependency).
 *
 * Facets are intentionally generic: an item may carry an exam/practice family
 * (`topik` | `hsk` | `jlpt` | `ielts` | `lesson` | `recall` | …), a learning
 * language (`en` | `zh` | `ja` | `ko` | `es`) and a completion status
 * (`finished` | `draft`). Any facet that is missing or unknown simply does not
 * match an active filter — callers never have to guarantee full records.
 */

/** Sentinel facet value meaning "do not restrict on this facet". */
export const HISTORY_FILTER_ALL = "all";

export interface HistoryFilterItem {
  readonly id: string;
  /** Localised text shown to the learner; searched by `query`. */
  readonly label: string;
  /** Optional exam/practice family. */
  readonly family?: string | null;
  /** Optional learning-language id. */
  readonly language?: string | null;
  /** Optional completion status. */
  readonly status?: string | null;
}

export interface HistoryFilterCriteria {
  /** Case-insensitive substring searched over each item's `label`. */
  readonly query?: string | null;
  /** Exact (case-insensitive) family match; `all`/empty disables the facet. */
  readonly family?: string | null;
  /** Exact (case-insensitive) language match; `all`/empty disables it. */
  readonly language?: string | null;
  /** Exact (case-insensitive) status match; `all`/empty disables it. */
  readonly status?: string | null;
}

export interface HistoryFilterOptions {
  readonly families: string[];
  readonly languages: string[];
  readonly statuses: string[];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalized(value: unknown): string {
  return text(value).trim().toLowerCase();
}

/** A facet is inactive for an absent, blank or `all` value. */
function facet(value: unknown): string | null {
  const next = normalized(value);
  return next === "" || next === HISTORY_FILTER_ALL ? null : next;
}

function sortedUnique(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const next = text(value).trim();
    if (next) seen.add(next);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * Return the items that satisfy every active criterion (logical AND).
 *
 * - No criteria (or only blank/`all` values) returns every item unchanged.
 * - No matches returns an empty array.
 * - Input order is preserved (the history is already sorted newest-first).
 * - Missing/unknown fields are tolerated and never throw.
 */
export function filterHistory<T extends HistoryFilterItem>(
  items: readonly T[],
  criteria: HistoryFilterCriteria = {},
): T[] {
  const query = normalized(criteria.query);
  const family = facet(criteria.family);
  const language = facet(criteria.language);
  const status = facet(criteria.status);
  return items.filter((item) => {
    if (family !== null && normalized(item.family) !== family) return false;
    if (language !== null && normalized(item.language) !== language)
      return false;
    if (status !== null && normalized(item.status) !== status) return false;
    if (query !== "" && !normalized(item.label).includes(query)) return false;
    return true;
  });
}

/** True when at least one criterion would actually narrow the list. */
export function hasActiveHistoryFilters(
  criteria: HistoryFilterCriteria = {},
): boolean {
  return (
    normalized(criteria.query) !== "" ||
    facet(criteria.family) !== null ||
    facet(criteria.language) !== null ||
    facet(criteria.status) !== null
  );
}

/**
 * Distinct non-empty facet values present in the items, sorted for a stable
 * select order. Used to populate the filter controls from real data so we
 * never offer an empty option.
 */
export function historyFilterOptions(
  items: readonly HistoryFilterItem[],
): HistoryFilterOptions {
  return {
    families: sortedUnique(items.map((item) => item.family)),
    languages: sortedUnique(items.map((item) => item.language)),
    statuses: sortedUnique(items.map((item) => item.status)),
  };
}

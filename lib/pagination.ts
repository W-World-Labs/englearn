export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function parsePageParams(
  searchParams: URLSearchParams,
  defaults?: { page?: number; pageSize?: number }
): { page: number; pageSize: number; all: boolean } {
  const all = searchParams.get("all") === "1";
  const page = Math.max(
    1,
    parseInt(searchParams.get("page") ?? String(defaults?.page ?? 1), 10) || 1
  );
  const rawSize = parseInt(
    searchParams.get("pageSize") ?? String(defaults?.pageSize ?? 10),
    10
  );
  const pageSize = all
    ? 10_000
    : Math.min(50, Math.max(1, rawSize || defaults?.pageSize || 10));
  return { page, pageSize, all };
}

export function paginateArray<T>(
  items: T[],
  page: number,
  pageSize: number
): PaginatedResult<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export function paginateSlice<T>(
  items: readonly T[],
  page: number,
  pageSize: number
): PaginatedResult<T> {
  return paginateArray([...items], page, pageSize);
}
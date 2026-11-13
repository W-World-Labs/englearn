import * as React from "react";
import { paginateSlice, type PaginatedResult } from "@/lib/pagination";

export function usePaginatedSlice<T>(
  items: readonly T[],
  pageSize: number,
  initialPage = 1
): PaginatedResult<T> & {
  page: number;
  setPage: (page: number) => void;
} {
  const [page, setPage] = React.useState(initialPage);

  const result = React.useMemo(
    () => paginateSlice(items, page, pageSize),
    [items, page, pageSize]
  );

  React.useEffect(() => {
    if (page > result.totalPages) setPage(result.totalPages);
  }, [page, result.totalPages]);

  React.useEffect(() => {
    setPage(1);
  }, [items.length, pageSize]);

  return { ...result, page: result.page, setPage };
}
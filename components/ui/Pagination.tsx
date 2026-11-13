import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/context";

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function pageNumbers(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  className = "",
}: PaginationProps) {
  const { t } = useI18n();
  if (totalPages <= 1 && total <= pageSize) return null;

  const nums = pageNumbers(page, totalPages);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
      aria-label={t("pagination.label")}
    >
      <p className="text-xs font-medium text-slate-500">
        {t("pagination.range", { from, to, total })}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={t("pagination.prev")}
        >
          {t("pagination.prev")}
        </Button>
        {nums.map((n, i) => {
          const prev = nums[i - 1];
          const gap = prev !== undefined && n - prev > 1;
          return (
            <span key={n} className="flex items-center gap-1">
              {gap && (
                <span className="px-1 text-slate-300" aria-hidden>
                  …
                </span>
              )}
              <Button
                type="button"
                variant={n === page ? "primary" : "outline"}
                size="sm"
                className="min-w-[2.25rem]"
                onClick={() => onPageChange(n)}
                aria-current={n === page ? "page" : undefined}
              >
                {n}
              </Button>
            </span>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={t("pagination.next")}
        >
          {t("pagination.next")}
        </Button>
      </div>
    </nav>
  );
}
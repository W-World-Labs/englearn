import * as React from "react";

function cx(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

export interface ProgressBarProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Current value. */
  value: number;
  /** Maximum value (defaults to 100). */
  max?: number;
  /** Show a numeric label inside / beside the bar. */
  showLabel?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  showLabel = false,
  className,
  ...props
}: ProgressBarProps) {
  const safeMax = max <= 0 ? 1 : max;
  const pct = Math.min(100, Math.max(0, (value / safeMax) * 100));

  return (
    <div
      className={cx("w-full", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.round(value)}
      {...props}
    >
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-gradient transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-right text-xs font-medium text-slate-500">
          {Math.round(pct)}%
        </div>
      )}
    </div>
  );
}

export default ProgressBar;

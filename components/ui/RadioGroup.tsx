
import * as React from "react";

function cx(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

export interface RadioOption {
  /** Stable value for the option. */
  value: string;
  /** Display label. */
  label: React.ReactNode;
}

export interface RadioGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Available options. Either RadioOption[] or a plain string[]. */
  options: Array<RadioOption | string>;
  /** Currently selected value (controlled). null/undefined = nothing selected. */
  value?: string | null;
  /** Fired with the newly selected value. */
  onChange: (value: string) => void;
  /** Accessible group name; auto-generated if omitted. */
  name?: string;
  disabled?: boolean;
  className?: string;
}


/**
 * A controlled single-select option list used by the MCQ modules.
 */
export function RadioGroup({
  options,
  value,
  onChange,
  name,
  disabled = false,
  className,
  ...rest
}: RadioGroupProps) {
  const reactId = React.useId();
  const groupName = React.useMemo(
    () => name ?? `radio-group-${reactId}`,
    [name, reactId]
  );

  const normalized: RadioOption[] = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );

  return (
    <div
      {...rest}
      role="radiogroup"
      aria-disabled={disabled || undefined}
      className={cx("flex flex-col gap-3", className)}
    >
      {normalized.map((opt, idx) => {
        const selected = value != null && value === opt.value;
        const id = `${groupName}-${idx}`;
        return (
          <label
            key={opt.value}
            htmlFor={id}
            className={cx(
              "group flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600",
              selected
                ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                : "border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/40",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            <span
              className={cx(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                selected
                  ? "border-brand-600"
                  : "border-slate-300 group-hover:border-brand-400"
              )}
            >
              <span
                className={cx(
                  "h-2.5 w-2.5 rounded-full bg-brand-600 transition-transform",
                  selected ? "scale-100" : "scale-0"
                )}
              />
            </span>
            <input
              id={id}
              type="radio"
              name={groupName}
              className="sr-only"
              value={opt.value}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(opt.value)}
            />
            <span className="text-sm text-slate-800">{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export default RadioGroup;

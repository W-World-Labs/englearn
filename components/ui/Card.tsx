import * as React from "react";

function cx(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** When true, applies a subtle hover lift effect. */
  interactive?: boolean;
}

export function Card({ className, interactive, ...props }: CardProps) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-stone-200/80 bg-white shadow-card",
        interactive &&
          "transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("px-5 pt-5 pb-2 sm:px-6 sm:pt-6", className)} {...props} />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cx(
        "text-lg font-semibold tracking-tight text-slate-900",
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cx("text-sm text-slate-500", className)} {...props} />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("px-5 py-4 sm:px-6", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx("px-5 pb-5 pt-2 flex flex-wrap items-center gap-3 sm:px-6 sm:pb-6", className)}
      {...props}
    />
  );
}

export default Card;

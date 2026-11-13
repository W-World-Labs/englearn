import type { ReactNode } from "react";
import {
  AppFooter,
  AppHeader,
  type AppHeaderProps,
} from "@/components/layout/AppHeader";

export interface PageShellProps extends AppHeaderProps {
  children: ReactNode;
  /** Wider marketing / dashboard layout */
  wide?: boolean;
  className?: string;
}

export function PageShell({
  children,
  active,
  title,
  wide = false,
  className = "",
}: PageShellProps) {
  return (
    <main
      className={[
        "app-shell relative mx-auto flex min-h-screen flex-col pt-1.5 sm:pt-2",
        wide ? "max-w-6xl" : "max-w-4xl",
        className,
      ].join(" ")}
    >
      <AppHeader active={active} title={title} />
      {children}
      {active !== "home" && <AppFooter />}
    </main>
  );
}

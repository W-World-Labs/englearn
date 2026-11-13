import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { WorkbenchPanel } from "@/components/learning/WorkbenchPanel";
import { LESSONS } from "@/lib/learning/catalog";
import { createJournal } from "@/lib/learning/session";
import { I18nProvider } from "@/lib/i18n/context";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
    ...rest
  }: {
    children?: ReactNode;
    to?: string;
    search?: Record<string, unknown>;
    [key: string]: unknown;
  }) => (
    <a
      href={`${to}${
        search
          ? `?${Object.entries(search)
              .map(([k, v]) => `${k}=${v}`)
              .join("&")}`
          : ""
      }`}
      {...rest}
    >
      {children}
    </a>
  ),
}));

function page(node: ReactNode) {
  return renderToStaticMarkup(<I18nProvider>{node}</I18nProvider>);
}

it("shows an active daily plan with its next task and resume control", () => {
  const lesson = LESSONS.find((l) => l.language === "en")!,
    s = createJournal();
  s.workbench = {
    version: 1,
    preferences: {},
    rounds: [],
    draft: null,
    days: [
      {
        id: "d1",
        language: "en",
        startedAt: 1,
        minutes: 5,
        purpose: "exam",
        tasks: [
          { kind: "lesson", target: lesson.id, items: [], minutes: 1 },
        ],
      },
    ],
    difficulty: [],
    words: [],
  };
  const html = page(
    <WorkbenchPanel
      tab="today"
      session={s}
      commit={() => {}}
      plan={null}
      explanationLocale="zh"
    />,
  );
  expect(html).toContain('data-testid="daily-plan"');
  expect(html).toContain("0/1");
  expect(html).toContain(lesson.title.zh);
  expect(html).toContain("继续今日学习");
});

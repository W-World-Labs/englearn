import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ImprovementPlan } from "@/components/results/ImprovementPlan";
import type { ResultAnalysis } from "@/lib/product/analysis";
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

const analysis: ResultAnalysis = {
  overallCEFR: "B1",
  insights: [],
  strengths: [],
  focusAreas: [],
  nextLevel: "B2",
  studyPlan: [
    { module: "grammar", priority: "high", score: 40, cefr: "A2", tips: [] },
    { module: "vocabulary", priority: "medium", score: 55, cefr: "B1", tips: [] },
    { module: "listening", priority: "medium", score: 50, cefr: "B1", tips: [] },
    { module: "speaking", priority: "medium", score: 45, cefr: "A2", tips: [] },
  ],
};

function linkFor(module: string) {
  return html
    .split("<a")
    .find((t) => t.includes(`data-module="${module}"`));
}

const html = renderToStaticMarkup(
  <I18nProvider>
    <ImprovementPlan analysis={analysis} language="zh" />
  </I18nProvider>,
);

it("links weak modules to a learn surface, not only a retest", () => {
  expect(linkFor("grammar")).toContain("tab=courses");
  expect(linkFor("vocabulary")).toContain('href="/vocabulary"');
  expect(linkFor("listening")).toContain("tab=reading&amp;activity=listening");
  // No dedicated speaking practice surface — retest only, no dead-end link.
  expect(linkFor("speaking")).toBeUndefined();
});

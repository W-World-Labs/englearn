import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { RecallPanel } from "@/components/learning/RecallPanel";
import { STUDY_CARDS } from "@/lib/learning/cards";
import { createJournal } from "@/lib/learning/session";
import {
  finishReview,
  rateReview,
  startReview,
} from "@/lib/learning/review";
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

const enWords = STUDY_CARDS.filter(
  (c) => c.language === "en" && c.source === "vocabulary",
)
  .slice(0, 3)
  .map((c) => c.id.slice(2))
  .join(",");

it("offers seeded vocabulary-check words as a startable recall round", () => {
  const html = page(
    <RecallPanel
      session={createJournal()}
      commit={() => {}}
      explanationLocale="zh"
      wordIds={enWords}
    />,
  );
  expect(html).toContain('data-testid="recall-seeded"');
  expect(html).toContain("(3)");
  expect(html).not.toContain("暂时没有知识卡");
  // The export path stays one click away, pre-filled with the same words.
  expect(html).toContain(`tab=materials&amp;words=${enWords}`);
});

it("shows pool counts on the filter buttons so due cards are discoverable", () => {
  const past = Date.now() - 3 * 86400000,
    first = STUDY_CARDS.find((c) => c.language === "en")!;
  let s = startReview(createJournal(past), [first.id], "r1", past);
  s = finishReview(rateReview(s, 2), past);
  const html = page(
    <RecallPanel
      session={s}
      commit={() => {}}
      explanationLocale="zh"
    />,
  );
  expect(html).toContain("推荐巩固 (1)");
  expect(html).toContain("到期知识卡 (1)");
  expect(html).not.toContain("不熟与错题 (");
});

it("falls back to the normal recommended pool when seeds miss the course", () => {
  const zh = STUDY_CARDS.find(
    (c) => c.language === "zh" && c.source === "vocabulary",
  )!;
  const html = page(
    <RecallPanel
      session={createJournal()}
      commit={() => {}}
      explanationLocale="zh"
      wordIds={`${zh.id.slice(2)},bogus`}
    />,
  );
  expect(html).not.toContain('data-testid="recall-seeded"');
  expect(html).toContain("暂时没有知识卡");
  // Empty state offers a way out instead of a dead end.
  expect(html).toContain("tab=courses");
});

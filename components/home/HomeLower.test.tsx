import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { HomeLower, HomeVocabularyFallback } from "@/components/home/HomeLower";
import { DEFAULT_PROGRESS } from "@/lib/gamification/types";
import { I18nProvider } from "@/lib/i18n/context";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/lib/client/auth", () => ({
  useAuth: () => ({ user: null }),
}));

function page(node: ReactNode) {
  return renderToStaticMarkup(<I18nProvider>{node}</I18nProvider>);
}

const progress = { ...DEFAULT_PROGRESS, streak: 2, dailyXpToday: 10 };

it("keeps the weekly total and the goal picker without a course", () => {
  const html = page(
    <HomeLower available={false} progress={progress} onGoalChange={() => {}} />,
  );
  expect(html).toContain('data-course="universal"');
  expect(html).toContain("本周练习量");
  expect(html).toContain("每日目标");
  expect(html).toContain("20 XP");
  expect(html).not.toContain('data-testid="home-modules"');
});

it("offers vocabulary when the selected language has no course", () => {
  const hidden = page(<HomeVocabularyFallback available />);
  const shown = page(<HomeVocabularyFallback available={false} />);
  expect(hidden).toBe("");
  expect(shown).toContain('data-testid="home-vocabulary"');
});

it("keeps the skill path when the course has a bank", () => {
  const html = page(
    <HomeLower available progress={progress} onGoalChange={() => {}} />,
  );
  expect(html).toContain('data-testid="home-modules"');
  expect(html).toContain('data-testid="home-retention"');
  expect(html).toContain("词汇");
  expect(html).not.toContain('data-testid="home-vocabulary"');
});

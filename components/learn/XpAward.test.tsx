import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { XpAward } from "@/components/learn/XpAward";
import { DEFAULT_PROGRESS } from "@/lib/gamification/types";
import { I18nProvider } from "@/lib/i18n/context";

function page(node: ReactNode) {
  return renderToStaticMarkup(<I18nProvider>{node}</I18nProvider>);
}

it("shows the awarded XP and how much of today's goal remains", () => {
  const html = page(
    <XpAward
      amount={12}
      progress={{ ...DEFAULT_PROGRESS, dailyXpToday: 32, dailyGoalXp: 50, streak: 1 }}
    />,
  );
  expect(html).toContain("+12 XP");
  expect(html).toContain("离今日目标还差 18 XP");
  expect(html).not.toContain("今日目标已达成");
});

it("switches to the done line once the award meets the goal", () => {
  const html = page(
    <XpAward
      amount={20}
      progress={{ ...DEFAULT_PROGRESS, dailyXpToday: 50, dailyGoalXp: 50, streak: 4 }}
    />,
  );
  expect(html).toContain("+20 XP");
  expect(html).toContain("今日目标已达成！明天继续加油～");
  expect(html).toContain("已连续学习 4 天，太棒了！");
  expect(html).not.toContain("离今日目标还差");
});

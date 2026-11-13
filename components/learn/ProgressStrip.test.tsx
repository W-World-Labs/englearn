import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DailyGoalStatus, ProgressStripView } from "@/components/learn/ProgressStrip";
import { DEFAULT_PROGRESS } from "@/lib/gamification/types";
import { I18nProvider } from "@/lib/i18n/context";

function page(node: ReactNode) {
  return renderToStaticMarkup(<I18nProvider>{node}</I18nProvider>);
}

it("shows how much XP remains when today's goal is open", () => {
  const html = page(
    <DailyGoalStatus
      progress={{ ...DEFAULT_PROGRESS, dailyXpToday: 20, dailyGoalXp: 50, streak: 1 }}
    />,
  );
  expect(html).toContain("离今日目标还差 30 XP");
  expect(html).not.toContain("今日目标已达成");
  expect(html).not.toContain("streak-status");
});

it("celebrates a met goal and a streak of at least two days", () => {
  const html = page(
    <DailyGoalStatus
      progress={{ ...DEFAULT_PROGRESS, dailyXpToday: 50, dailyGoalXp: 50, streak: 3 }}
    />,
  );
  expect(html).toContain("今日目标已达成！明天继续加油～");
  expect(html).toContain("已连续学习 3 天，太棒了！");
  expect(html).not.toContain("离今日目标还差");
});

it("keeps the XP numbers when a page shows the goal lines elsewhere", () => {
  const html = page(
    <ProgressStripView
      progress={{ ...DEFAULT_PROGRESS, dailyXpToday: 20, dailyGoalXp: 50, streak: 4 }}
      showGoalStatus={false}
    />,
  );
  expect(html).toContain(">20<span");
  expect(html).toContain("/ 50");
  expect(html).not.toContain("daily-goal-status");
  expect(html).not.toContain("streak-status");
});

it("includes the goal lines on the shared strip", () => {
  const html = page(
    <ProgressStripView
      progress={{ ...DEFAULT_PROGRESS, dailyXpToday: 20, dailyGoalXp: 50, streak: 4 }}
    />,
  );
  expect(html).toContain("离今日目标还差 30 XP");
  expect(html).toContain("已连续学习 4 天，太棒了！");
});

it("treats XP above the goal as done and hides a one-day streak line", () => {
  const html = page(
    <DailyGoalStatus
      progress={{ ...DEFAULT_PROGRESS, dailyXpToday: 80, dailyGoalXp: 50, streak: 1 }}
    />,
  );
  expect(html).toContain("今日目标已达成");
  expect(html).not.toContain("data-testid=\"streak-status\"");
});

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PracticeHistory } from "@/components/learning/PracticeHistory";
import { STUDY_CARDS } from "@/lib/learning/cards";
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

it("lists in-flight lesson, activity and recall drafts with resume links", () => {
  const lesson = LESSONS.find((l) => l.language === "en")!,
    card = STUDY_CARDS.find((c) => c.language === "en")!,
    s = createJournal();
  s.draft = { lessonId: lesson.id, startedAt: 3000, answers: [0] };
  s.reviewDraft = {
    id: "r1",
    startedAt: 2000,
    cards: [card.id],
    ratings: [],
  };
  s.workbench = {
    version: 1,
    preferences: {},
    rounds: [],
    days: [],
    difficulty: [],
    words: [],
    draft: {
      id: "a1",
      kind: "practice",
      target: lesson.id,
      items: ["q1", "q2"],
      answers: [0],
      startedAt: 1000,
    },
  };
  const html = page(
    <PracticeHistory session={s} explanationLocale="zh" />,
  );
  expect(html.match(/history-draft/g)).toHaveLength(3);
  expect(html).toContain("进行中");
  expect(html).toContain("继续练习");
  expect(html).toContain("1/4");
  expect(html).toContain(`lesson=${lesson.id}`);
  expect(html).toContain("tab=review");
  expect(html).toContain(
    `tab=today&amp;concept=${lesson.id}&amp;activity=practice`,
  );
});

it("hides drafts belonging to another learning language", () => {
  const zh = LESSONS.find((l) => l.language === "zh")!,
    s = createJournal();
  s.draft = { lessonId: zh.id, startedAt: 3000, answers: [] };
  const html = page(
    <PracticeHistory session={s} explanationLocale="zh" />,
  );
  expect(html).not.toContain("history-draft");
  expect(html).toContain("完成一节课后");
});

it("shows completed daily activities with scores and answers while keeping other languages out", async () => {
  const { startActivity, answerActivity, finishActivity, activityQuestion, workbench } = await import("@/lib/learning/workbench");
  let s = createJournal();
  for (const language of ["en", "zh"] as const) {
    const lesson = LESSONS.find(l => l.language === language)!;
    s = startActivity(s, "practice", lesson.id, `daily-${language}`, 1000);
    while (workbench(s).draft!.answers.length < workbench(s).draft!.items.length) {
      const draft = workbench(s).draft!;
      const q = activityQuestion(draft.items[draft.answers.length])!;
      s = answerActivity(s, draft.answers.length ? q.answer : (q.answer + 1) % q.choices.length);
    }
    s = finishActivity(s, 2000);
  }
  const html = page(<PracticeHistory session={s} explanationLocale="zh" />);
  expect(html.match(/data-testid="activity-round"/g)).toHaveLength(1);
  expect(html).toContain("1/2");
  const en = s.workbench!.rounds.find(r => r.id === "daily-en")!;
  expect(html).toContain(activityQuestion(en.items[0])!.prompt);
  expect(html).toContain(activityQuestion(en.items[0])!.choices[en.answers[0]]);
  expect(html).not.toContain("完成一节课后");
  expect(html).toContain("tab=profile");
});

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PersonalPlan } from "@/components/learning/PersonalPlan";
import { STUDY_CARDS } from "@/lib/learning/cards";
import type { LearningPlan } from "@/lib/learning/plan";
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
vi.mock("@/lib/client/auth", () => ({
  useAuth: () => ({ user: null }),
}));

const plan: LearningPlan = {
  language: "en",
  stage: "foundation",
  basis: "practice",
  adjustment: null,
  grammarDiagnostic: false,
  vocabularyDiagnostic: false,
  lessons: [],
  reviewCount: 0,
  resumeRecall: false,
  vocabularyStage: "foundation",
  wordIds: STUDY_CARDS.filter(
    (c) => c.language === "en" && c.source === "vocabulary",
  )
    .slice(0, 2)
    .map((c) => c.id.slice(2)),
};

it("routes recommended words into a seeded recall round, not an export", () => {
  const html = renderToStaticMarkup(
    <I18nProvider>
      <PersonalPlan
        plan={plan}
        status="ready"
        retry={() => {}}
        explanationLocale="zh"
      />
    </I18nProvider>,
  );
  expect(html).toContain('data-testid="plan-words"');
  const tag = html
    .split("<a")
    .find((t) => t.includes('data-testid="plan-words"'))!;
  expect(tag).toContain("tab=review");
  expect(tag).toContain(plan.wordIds[0]);
});

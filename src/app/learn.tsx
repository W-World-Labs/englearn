import type { ActivityKind } from "@/lib/learning/workbench";
import { parsePreparationWorkspace, type PreparationWorkspace } from "@/lib/ielts/preparation";
import { createFileRoute } from "@tanstack/react-router";
import {
  LearningPage,
  type LearningTab,
} from "@/components/learning/LearningPage";
export const Route = createFileRoute("/learn")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    lesson?: string;
    tab?: LearningTab;
    words?: string;
    concept?: string;
    activity?: ActivityKind;
    workspace?: PreparationWorkspace;
  } => ({
    workspace: parsePreparationWorkspace(search.workspace),
    concept:
      typeof search.concept === "string" && search.concept.length <= 100
        ? search.concept
        : undefined,
    activity: ["practice", "retest", "reading", "listening"].includes(
      search.activity as string,
    )
      ? (search.activity as ActivityKind)
      : undefined,
    words:
      typeof search.words === "string" && search.words.length <= 4000
        ? search.words
        : undefined,
    lesson: typeof search.lesson === "string" ? search.lesson : undefined,
    tab: [
      "ielts",
      "today",
      "profile",
      "reading",
      "week",
      "courses",
      "review",
      "history",
      "library",
      "materials",
    ].includes(search.tab as string)
      ? (search.tab as LearningTab)
      : undefined,
  }),
  component: () => {
    const search = Route.useSearch();
    return (
      <LearningPage
        concept={search.concept}
        activity={search.activity}
        lessonId={search.lesson}
        wordIds={search.words}
        tab={search.tab}
      />
    );
  },
});

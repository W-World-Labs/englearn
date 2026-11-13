import { createFileRoute } from "@tanstack/react-router";
import { LearningPage } from "@/components/learning/LearningPage";
import { useI18n } from "@/lib/i18n/context";
import { parsePreparationWorkspace, type PreparationWorkspace } from "@/lib/ielts/preparation";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { workspace?: PreparationWorkspace } => ({ workspace: parsePreparationWorkspace(search.workspace) }),
  component: HomePage,
});

function HomePage() {
  const { learningLanguage } = useI18n();
  return (
    <LearningPage home tab={learningLanguage === "en" ? "ielts" : "today"} />
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { VocabularyTest } from "@/components/vocabulary/VocabularyTest";
export const Route = createFileRoute("/vocabulary")({
  component: VocabularyTest,
});

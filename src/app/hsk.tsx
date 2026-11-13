import { createFileRoute } from "@tanstack/react-router";
import { LanguageExam } from "@/components/exams/LanguageExam";
export const Route = createFileRoute("/hsk")({
  component: () => <LanguageExam family="hsk" />,
});

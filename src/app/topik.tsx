import { createFileRoute } from "@tanstack/react-router";
import { LanguageExam } from "@/components/exams/LanguageExam";
export const Route = createFileRoute("/topik")({
  component: () => <LanguageExam family="topik" />,
});

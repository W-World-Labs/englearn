import { createFileRoute } from "@tanstack/react-router";
import { LanguageExam } from "@/components/exams/LanguageExam";
export const Route = createFileRoute("/jlpt")({
  component: () => <LanguageExam family="jlpt" />,
});

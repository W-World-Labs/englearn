import { createFileRoute } from "@tanstack/react-router";
import { IeltsExam } from "@/components/ielts/IeltsExam";

export const Route = createFileRoute("/ielts")({ component: IeltsExam });

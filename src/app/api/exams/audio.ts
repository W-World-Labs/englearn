import { createFileRoute } from "@tanstack/react-router";
import { handlePracticeAudio } from "@/lib/api/exams-audio";
export const Route = createFileRoute("/api/exams/audio")({
  server: {
    handlers: {
      GET: ({ request }) => handlePracticeAudio(request),
      HEAD: ({ request }) => handlePracticeAudio(request),
    },
  },
});

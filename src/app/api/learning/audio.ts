import { createFileRoute } from "@tanstack/react-router";
import { handleLearningAudio } from "@/lib/api/learning-audio";
export const Route = createFileRoute("/api/learning/audio")({
  server: {
    handlers: {
      GET: ({ request }) => handleLearningAudio(request),
      HEAD: ({ request }) => handleLearningAudio(request),
    },
  },
});

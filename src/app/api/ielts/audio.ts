import { createFileRoute } from "@tanstack/react-router";
import { handleIeltsAudio } from "@/lib/api/ielts-audio";
export const Route = createFileRoute("/api/ielts/audio")({
  server: {
    handlers: {
      GET: ({ request }) => handleIeltsAudio(request),
      HEAD: ({ request }) => handleIeltsAudio(request),
    },
  },
});

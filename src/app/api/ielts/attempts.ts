import { createFileRoute } from "@tanstack/react-router";
import { handleIeltsGet, handleIeltsPost } from "@/lib/api/ielts";

export const Route = createFileRoute("/api/ielts/attempts")({
  server: {
    handlers: {
      GET: ({ request }) => handleIeltsGet(request),
      POST: ({ request }) => handleIeltsPost(request),
    },
  },
});

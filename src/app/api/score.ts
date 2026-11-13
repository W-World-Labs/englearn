import { createFileRoute } from "@tanstack/react-router";
import { handleScorePost } from "@/lib/api/score";

export const Route = createFileRoute("/api/score")({
  server: {
    handlers: {
      POST: ({ request }) => handleScorePost(request),
    },
  },
});
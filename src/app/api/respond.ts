import { createFileRoute } from "@tanstack/react-router";
import { handleRespondPost } from "@/lib/api/respond";

export const Route = createFileRoute("/api/respond")({
  server: {
    handlers: {
      POST: ({ request }) => handleRespondPost(request),
    },
  },
});
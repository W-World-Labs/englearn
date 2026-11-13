import { createFileRoute } from "@tanstack/react-router";
import { handleSessionClaimPost } from "@/lib/api/session-claim";

export const Route = createFileRoute("/api/session/claim")({
  server: {
    handlers: {
      POST: ({ request }) => handleSessionClaimPost(request),
    },
  },
});

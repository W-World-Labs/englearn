import { createFileRoute } from "@tanstack/react-router";
import { GET, POST } from "@/lib/api/learning-feedback";
export const Route = createFileRoute("/api/learning/feedback")({
  server: {
    handlers: {
      GET: ({ request }) => GET(request),
      POST: ({ request }) => POST(request),
    },
  },
});

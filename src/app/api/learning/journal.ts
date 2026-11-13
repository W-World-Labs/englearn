import { createFileRoute } from "@tanstack/react-router";
import { GET, POST } from "@/lib/api/learning";
export const Route = createFileRoute("/api/learning/journal")({
  server: {
    handlers: {
      GET: ({ request }) => GET(request),
      POST: ({ request }) => POST(request),
    },
  },
});

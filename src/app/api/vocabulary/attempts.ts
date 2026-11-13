import { createFileRoute } from "@tanstack/react-router";
import { GET, POST } from "@/lib/api/vocabulary";
export const Route = createFileRoute("/api/vocabulary/attempts")({
  server: {
    handlers: {
      GET: ({ request }) => GET(request),
      POST: ({ request }) => POST(request),
    },
  },
});

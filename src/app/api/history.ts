import { createFileRoute } from "@tanstack/react-router";
import { handleHistoryGet } from "@/lib/api/history";

export const Route = createFileRoute("/api/history")({
  server: {
    handlers: {
      GET: ({ request }) => handleHistoryGet(request),
    },
  },
});
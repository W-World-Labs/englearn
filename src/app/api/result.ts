import { createFileRoute } from "@tanstack/react-router";
import { handleResultDelete, handleResultGet } from "@/lib/api/result";

export const Route = createFileRoute("/api/result")({
  server: {
    handlers: {
      GET: ({ request }) => handleResultGet(request),
      DELETE: ({ request }) => handleResultDelete(request),
    },
  },
});
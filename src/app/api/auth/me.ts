import { createFileRoute } from "@tanstack/react-router";
import { handleAuthMe } from "@/lib/api/auth";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuthMe(request),
    },
  },
});
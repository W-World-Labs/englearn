import { createFileRoute } from "@tanstack/react-router";
import { handleAuthCallback } from "@/lib/api/auth";

export const Route = createFileRoute("/api/auth/callback")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuthCallback(request),
    },
  },
});
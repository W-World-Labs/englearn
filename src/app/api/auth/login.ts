import { createFileRoute } from "@tanstack/react-router";
import { handleAuthLogin } from "@/lib/api/auth";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuthLogin(request),
    },
  },
});
import { createFileRoute } from "@tanstack/react-router";
import { handleAuthLogout } from "@/lib/api/auth";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: () => handleAuthLogout(),
    },
  },
});
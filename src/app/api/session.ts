import { createFileRoute } from "@tanstack/react-router";
import {
  handleSessionDelete,
  handleSessionGet,
  handleSessionPost,
} from "@/lib/api/session";

export const Route = createFileRoute("/api/session")({
  server: {
    handlers: {
      GET: ({ request }) => handleSessionGet(request),
      POST: ({ request }) => handleSessionPost(request),
      DELETE: ({ request }) => handleSessionDelete(request),
    },
  },
});
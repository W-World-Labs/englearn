import { createFileRoute } from "@tanstack/react-router";
import {
  handleProgressGet,
  handleProgressPut,
  handleProgressSync,
} from "@/lib/api/progress";

export const Route = createFileRoute("/api/progress")({
  server: {
    handlers: {
      GET: ({ request }) => handleProgressGet(request),
      PUT: ({ request }) => handleProgressPut(request),
      POST: ({ request }) => handleProgressSync(request),
    },
  },
});
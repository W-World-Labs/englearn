import { createFileRoute } from "@tanstack/react-router";
import { examHandlers } from "@/lib/api/exams";
export const Route = createFileRoute("/api/exams/$family/attempts")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        examHandlers(params.family)?.GET(request) ??
        Response.json({ error: "Unknown exam" }, { status: 404 }),
      POST: ({ request, params }) =>
        examHandlers(params.family)?.POST(request) ??
        Response.json({ error: "Unknown exam" }, { status: 404 }),
    },
  },
});

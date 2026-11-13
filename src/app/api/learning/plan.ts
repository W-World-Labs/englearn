import { createFileRoute } from "@tanstack/react-router";
import { GET } from "@/lib/api/learning-plan";
export const Route = createFileRoute("/api/learning/plan")({
  server: { handlers: { GET: ({ request }) => GET(request) } },
});

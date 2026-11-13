import { createFileRoute } from "@tanstack/react-router";
import { handleItemGet } from "@/lib/api/item";

export const Route = createFileRoute("/api/item")({
  server: {
    handlers: {
      GET: ({ request }) => handleItemGet(request),
    },
  },
});
import { createFileRoute } from "@tanstack/react-router";
import { handleLibraryBook } from "@/lib/api/library";
export const Route = createFileRoute("/api/library/book")({
  server: {
    handlers: {
      GET: ({ request }) => handleLibraryBook(request),
      HEAD: ({ request }) => handleLibraryBook(request),
    },
  },
});

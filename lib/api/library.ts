import path from "node:path";
import { BOOK } from "@/lib/learning/catalog";
import { streamPublicFile } from "./public-file";
export function handleLibraryBook(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("id") !== BOOK.id)
    return new Response("Book not found", { status: 404 });
  const format = params.get("format") ?? "pdf";
  if (format !== "pdf" && format !== "text")
    return new Response("Unknown book format", { status: 400 });
  const file =
    format === "text" ? "brehes-grammar-anatomy-pages.json" : BOOK.file;
  const response = streamPublicFile(
    request,
    path.join(process.cwd(), "public", "library", file),
    format === "text" ? "application/json; charset=utf-8" : "application/pdf",
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Content-Disposition", `inline; filename="${file}"`);
  return response;
}

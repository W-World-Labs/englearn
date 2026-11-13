import path from "node:path";
import { streamPublicFile } from "./public-file";

/** Nitro's static handler does not serve byte ranges; media needs them to seek. */
export function handleIeltsAudio(request: Request): Response {
  const params = new URL(request.url).searchParams;
  const part = params.get("part");
  const set = params.get("set") ?? "01";
  if (!part || !/^[1-4]$/.test(part) || (set !== "01" && set !== "02"))
    return new Response("Audio not found", { status: 404 });
  // Public exists both in the repository and in the standalone .output directory.
  const file = path.join(
    process.cwd(),
    "public",
    "ielts-assets",
    set === "02" ? `practice-02-part-${part}.mp3` : `section-${part}.mp3`,
  );
  return streamPublicFile(request, file);
}

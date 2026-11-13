import path from "node:path";
import { gradedText } from "@/lib/learning/workbench-content";
import { streamPublicFile } from "./public-file";
export function handleLearningAudio(request: Request): Response {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !gradedText(id))
    return new Response("Audio not found", { status: 404 });
  return streamPublicFile(
    request,
    path.join(process.cwd(), "public", "learning-audio", id + ".mp3"),
  );
}

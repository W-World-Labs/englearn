import path from "node:path";
import manifest from "@/data/exams/audio.json";
import { streamPublicFile } from "./public-file";
export function handlePracticeAudio(request: Request): Response {
  const query = new URL(request.url).searchParams;
  const clip = manifest.clips.find(
    (clip) =>
      clip.paperId === query.get("paperId") &&
      clip.questionId === query.get("questionId"),
  );
  if (!clip) return new Response("Audio not found", { status: 404 });
  return streamPublicFile(
    request,
    path.join(process.cwd(), "public", "exam-assets", "audio", clip.file),
  );
}

import { expect, it, vi } from "vitest";
import fs from "node:fs";
import { createHash } from "node:crypto";
import manifest from "@/data/exams/audio.json";
import { PAPERS } from "@/lib/exams/catalog";
import { handlePracticeAudio } from "./exams-audio";
const request = (
  paperId = "hsk-1-01-v1",
  questionId = "l1",
  method = "GET",
  range?: string,
) =>
  handlePracticeAudio(
    new Request(
      `http://localhost/api/exams/audio?paperId=${encodeURIComponent(paperId)}&questionId=${encodeURIComponent(questionId)}`,
      { method, headers: range ? { Range: range } : {} },
    ),
  );
it("ships complete, hashed recordings matching every original listening script and all three sound checks", () => {
  expect(manifest.clips).toHaveLength(70);
  for (const clip of manifest.clips) {
    const file = fs.readFileSync(`public/exam-assets/audio/${clip.file}`);
    expect(createHash("sha256").update(file).digest("hex")).toBe(clip.sha256);
    expect(clip.duration).toBeGreaterThan(1);
    const head = request(clip.paperId, clip.questionId, "HEAD");
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe(String(file.length));
  }
  for (const paper of PAPERS)
    for (const q of paper.questions.filter((q) => q.script)) {
      const clip = manifest.clips.find(
        (c) => c.paperId === paper.id && c.questionId === q.id,
      );
      expect(clip?.scriptSha256).toBe(
        createHash("sha256").update(q.script!).digest("hex"),
      );
      expect(clip?.voice.startsWith(paper.language)).toBe(true);
    }
});
it("serves exact seek ranges and keeps paths restricted to the bundled manifest", async () => {
  const clip = manifest.clips[0];
  const res = request(clip.paperId, clip.questionId, "GET", "bytes=200-999");
  expect(res.status).toBe(206);
  expect(res.headers.get("accept-ranges")).toBe("bytes");
  expect(Buffer.from(await res.arrayBuffer())).toEqual(
    fs
      .readFileSync(`public/exam-assets/audio/${clip.file}`)
      .subarray(200, 1000),
  );
  for (const [paper, q] of [
    ["../../etc", "passwd"],
    ["hsk-1-01-v1", "r1"],
    ["hsk-1-01-v1", "../../runtime.env"],
    ["future", "l1"],
  ])
    expect(request(paper, q).status).toBe(404);
  expect(
    request(clip.paperId, clip.questionId, "GET", "bytes=999999999-"),
  ).toHaveProperty("status", 416);
});
it("reports an unavailable recording instead of pretending playback succeeded", () => {
  const read = vi.spyOn(fs, "statSync").mockImplementation(() => {
    throw new Error("Unavailable volume");
  });
  try {
    expect(request().status).toBe(503);
  } finally {
    read.mockRestore();
  }
});
it("serves an empty response for a zero-byte asset instead of crashing", async () => {
  const read = vi.spyOn(fs, "statSync").mockImplementation(
    () => ({ size: 0 }) as fs.Stats,
  );
  try {
    const res = request();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe("0");
    expect(Buffer.from(await res.arrayBuffer())).toHaveLength(0);
    expect(request(undefined, undefined, "HEAD").status).toBe(200);
    expect(request(undefined, undefined, "GET", "bytes=0-").status).toBe(416);
  } finally {
    read.mockRestore();
  }
});

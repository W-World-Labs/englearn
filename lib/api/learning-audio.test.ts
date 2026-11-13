import { expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { handleLearningAudio } from "./learning-audio";
import manifest from "@/data/learning/audio-v1.json";
import { GRADED_TEXTS } from "@/lib/learning/workbench-content";
const request = (id: string, method = "GET", range?: string) =>
  new Request(
    "http://localhost/api/learning/audio?id=" + encodeURIComponent(id),
    { method, headers: range ? { range } : {} },
  );
it("streams every reading clip exactly, supports replay ranges and validates provenance against the script", { timeout: 20000 }, async () => {
  expect(manifest.clips).toHaveLength(GRADED_TEXTS.length);
  for (const text of GRADED_TEXTS) {
    const clip = manifest.clips.find((c) => c.id === text.id)!;
    const expected = fs.readFileSync(
      path.join(process.cwd(), "public/learning-audio", clip.file),
    );
    expect(createHash("sha256").update(expected).digest("hex")).toBe(
      clip.sha256,
    );
    expect(
      createHash("sha256")
        .update(text.sentences.map((s) => s.text).join(" "))
        .digest("hex"),
    ).toBe(clip.scriptSha256);
    const head = handleLearningAudio(request(text.id, "HEAD"));
    expect(head.status).toBe(200);
    expect(head.headers.get("Content-Length")).toBe(String(expected.length));
    expect((await head.arrayBuffer()).byteLength).toBe(0);
    const full = handleLearningAudio(request(text.id));
    expect(full.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(Buffer.from(await full.arrayBuffer())).toEqual(expected);
    const range = handleLearningAudio(request(text.id, "GET", "bytes=500-999"));
    expect(range.status).toBe(206);
    expect(Buffer.from(await range.arrayBuffer())).toEqual(
      expected.subarray(500, 1000),
    );
    const suffix = handleLearningAudio(request(text.id, "GET", "bytes=-100"));
    expect(Buffer.from(await suffix.arrayBuffer())).toEqual(
      expected.subarray(-100),
    );
    expect(
      handleLearningAudio(request(text.id, "GET", "bytes=999999999-")).status,
    ).toBe(416);
    expect(clip.duration).toBeGreaterThan(3);
  }
  for (const id of ["", "../../../etc/passwd", "unknown"])
    expect(handleLearningAudio(request(id)).status).toBe(404);
});

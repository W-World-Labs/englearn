import { expect, it } from "vitest";
import fs from "node:fs";
import { handleIeltsAudio } from "./ielts-audio";
const bytes = fs.readFileSync("public/ielts-assets/section-1.mp3");
function response(range?: string, part = "1", method = "GET") {
  return handleIeltsAudio(
    new Request(`http://localhost/api/ielts/audio?part=${part}`, {
      method,
      headers: range ? { Range: range } : {},
    }),
  );
}
it("streams exact byte ranges and suffixes so the browser can seek to the exam clock", async () => {
  for (const [range, start, end] of [
    ["bytes=1000-1999", 1000, 1999],
    ["bytes=-100", bytes.length - 100, bytes.length - 1],
    [`bytes=${bytes.length - 100}-`, bytes.length - 100, bytes.length - 1],
  ] as const) {
    const res = response(range);
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(
      `bytes ${start}-${end}/${bytes.length}`,
    );
    expect(Buffer.from(await res.arrayBuffer())).toEqual(
      bytes.subarray(start, end + 1),
    );
  }
});
it("rejects invalid ranges and arbitrary asset paths", () => {
  for (const range of [
    "bytes=900000000-",
    "bytes=20-10",
    "bytes=-0",
    "bytes=0-2,4-5",
    "bytes=-",
  ])
    expect(response(range).status).toBe(416);
  expect(response(undefined, "../../secrets").status).toBe(404);
});
it("advertises seek support and length on HEAD without reading a body", async () => {
  const res = response(undefined, "1", "HEAD");
  expect(res.status).toBe(200);
  expect(res.headers.get("accept-ranges")).toBe("bytes");
  expect(res.headers.get("content-length")).toBe(String(bytes.length));
  expect(await res.text()).toBe("");
});
it("serves the Practice 02 set and rejects unknown sets", async () => {
  const two = handleIeltsAudio(
    new Request("http://localhost/api/ielts/audio?part=2&set=02"),
  );
  expect(two.status).toBe(200);
  const expected = fs.readFileSync(
    "public/ielts-assets/practice-02-part-2.mp3",
  );
  expect(two.headers.get("content-length")).toBe(String(expected.length));
  expect(Buffer.from(await two.arrayBuffer()).subarray(0, 3).toString()).toBe(
    "ID3",
  );
  for (const url of [
    "http://localhost/api/ielts/audio?part=1&set=03",
    "http://localhost/api/ielts/audio?part=9&set=02",
    "http://localhost/api/ielts/audio?part=1&set=",
  ])
    expect(handleIeltsAudio(new Request(url)).status).toBe(404);
});

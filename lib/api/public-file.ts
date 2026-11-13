import fs from "node:fs";
import { Readable } from "node:stream";

/** Stream an allowlisted public asset with byte ranges. Never pass a user-supplied path. */
export function streamPublicFile(
  request: Request,
  file: string,
  contentType = "audio/mpeg",
): Response {
  let size: number;
  try {
    size = fs.statSync(file).size;
  } catch {
    return new Response("This file is temporarily unavailable", {
      status: 503,
    });
  }
  const headers = new Headers({
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
  });
  let start = 0,
    end = size - 1,
    status = 200;
  const range = request.method === "HEAD" ? null : request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2]))
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    if (match[1]) {
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    } else {
      start = Math.max(0, size - Number(match[2]));
    }
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      start > end ||
      end >= size
    )
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    status = 206;
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }
  headers.set("Content-Length", String(end - start + 1));
  return new Response(
    // An empty asset (size 0 -> end -1) has no byte range to stream;
    // createReadStream would throw ERR_OUT_OF_RANGE synchronously.
    request.method === "HEAD" || size === 0
      ? null
      : (Readable.toWeb(
          fs.createReadStream(file, { start, end }),
        ) as ReadableStream<Uint8Array>),
    { status, headers },
  );
}

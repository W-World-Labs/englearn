import { expect, it } from "vitest";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { BOOK } from "@/lib/learning/catalog";
import { handleLibraryBook } from "./library";
const url = `http://localhost/api/library/book?id=${BOOK.id}`;
it("serves the unchanged licensed book with a verifiable digest and attribution", async () => {
  const response = handleLibraryBook(new Request(url));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("application/pdf");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  const data = Buffer.from(await response.arrayBuffer());
  expect(data.subarray(0, 5).toString()).toBe("%PDF-");
  expect(createHash("sha256").update(data).digest("hex")).toBe(BOOK.sha256);
  const attribution = fs.readFileSync("public/library/ATTRIBUTION.txt", "utf8");
  expect(attribution).toContain(BOOK.sha256);
  expect(attribution).toContain("CC BY-SA 4.0");
});
it("supports PDF viewer byte requests, suffixes and HEAD without loading a whole body", async () => {
  const head = handleLibraryBook(new Request(url, { method: "HEAD" }));
  expect((await head.arrayBuffer()).byteLength).toBe(0);
  const size = Number(head.headers.get("content-length"));
  expect(size).toBe(2237132);
  const range = handleLibraryBook(
    new Request(url, { headers: { Range: "bytes=0-15" } }),
  );
  expect(range.status).toBe(206);
  expect(range.headers.get("content-range")).toBe(`bytes 0-15/${size}`);
  expect((await range.arrayBuffer()).byteLength).toBe(16);
  const suffix = handleLibraryBook(
    new Request(url, { headers: { Range: "bytes=-12" } }),
  );
  expect((await suffix.arrayBuffer()).byteLength).toBe(12);
  for (const Range of [
    "bytes=9999999-",
    "bytes=20-10",
    "bytes=0-2,5-7",
    "bytes=-",
  ])
    expect(
      handleLibraryBook(new Request(url, { headers: { Range } })).status,
    ).toBe(416);
});
it("never resolves a supplied filesystem path or copyrighted book identifier", () => {
  for (const id of ["../package.json", "/etc/passwd", "grammar-in-use", ""])
    expect(
      handleLibraryBook(
        new Request(
          `http://localhost/api/library/book?id=${encodeURIComponent(id)}`,
        ),
      ).status,
    ).toBe(404);
});

it("retains PDF page boundaries and source/change notices in the accessible text edition", async () => {
  const response = handleLibraryBook(new Request(url + "&format=text"));
  expect(response.headers.get("content-type")).toContain("application/json");
  const raw = await response.text();
  expect(raw).toBe(
    fs.readFileSync("public/library/brehes-grammar-anatomy-pages.json", "utf8"),
  );
  const data = JSON.parse(raw);
  expect(data.book).toBe(BOOK.id);
  expect(data.author).toBe(BOOK.author);
  expect(data.license).toBe("CC-BY-SA-4.0");
  expect(data.changes).toContain("Typography and graphics are not reproduced");
  expect(data.pages).toHaveLength(BOOK.pages);
  expect(data.pages.every((p: unknown) => typeof p === "string")).toBe(true);
  expect(data.pages[26]).toContain("Mr. Morton");
  expect(
    handleLibraryBook(new Request(url + "&format=../../other")).status,
  ).toBe(400);
});

import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { TestSession, TestResult } from "./types";

let directory: string;
let db: typeof import("./db");
const session: TestSession = { id: "new-session", createdAt: "2026-09-22T00:00:00Z", modules: ["grammar"], currentModule: "grammar", administeredItemIds: [], responses: [], ability: {}, finished: false };
const result: TestResult = { sessionId: session.id, completedAt: session.createdAt, overallCEFR: "B1", modules: [] };
beforeAll(async () => {
  directory = fs.mkdtempSync(path.join(process.cwd(), "data/.test-records-"));
  vi.stubEnv("ENGLEARN_DATA_DIR", directory);
  db = await import("./db");
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const entry of fs.readdirSync(directory)) fs.rmSync(path.join(directory, entry), { recursive: true });
});
afterAll(() => { fs.rmSync(directory, { recursive: true, force: true }); vi.unstubAllEnvs(); });

for (const file of ["sessions.json", "results.json"]) {
  it.each(["{}", "null", "7", "", "{truncated"])(`quarantines ${file} with corrupt content %j before starting a fresh store`, raw => {
    const full = path.join(directory, file);
    fs.writeFileSync(full, raw);
    if (file === "sessions.json") db.createSession(session); else db.saveResult(result);
    const quarantines = fs.readdirSync(directory).filter(name => name.startsWith(`${file}.corrupt-`));
    expect(quarantines).toHaveLength(1);
    expect(fs.readFileSync(path.join(directory, quarantines[0]), "utf8")).toBe(raw);
    expect(JSON.parse(fs.readFileSync(full, "utf8"))).toEqual([file === "sessions.json" ? session : result]);
  });

  it(`does not overwrite ${file} when preserving corruption fails`, () => {
    const full = path.join(directory, file);
    fs.writeFileSync(full, "{recoverable bytes");
    const rename = fs.renameSync.bind(fs);
    vi.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (String(to).includes(".corrupt-")) throw new Error("quarantine unavailable");
      rename(from, to);
    });
    expect(() => file === "sessions.json" ? db.createSession(session) : db.saveResult(result)).toThrow("quarantine unavailable");
    expect(fs.readFileSync(full, "utf8")).toBe("{recoverable bytes");
    expect(fs.readdirSync(directory)).toEqual([file]);
  });
}

it("strict reads preserve corrupt results in place and only missing files mean an empty store", () => {
  expect(db.getResults({ strict: true })).toEqual([]);
  const file = path.join(directory, "results.json");
  fs.writeFileSync(file, "{}");
  expect(() => db.getResults({ strict: true })).toThrow();
  expect(fs.readFileSync(file, "utf8")).toBe("{}");
});

it("never replaces an earlier quarantine when corruption happens twice in the same millisecond", () => {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const file = path.join(directory, "sessions.json");
  for (const raw of ["{first", "{second"]) {
    fs.writeFileSync(file, raw);
    db.createSession(session);
  }
  const recovered = fs.readdirSync(directory).filter(name => name.includes(".corrupt-")).map(name => fs.readFileSync(path.join(directory, name), "utf8"));
  expect(recovered.sort()).toEqual(["{first", "{second"]);
});

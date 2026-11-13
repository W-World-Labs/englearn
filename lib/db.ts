import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { TestSession, TestResult } from "@/lib/types";

const DATA_DIR =
  process.env.ENGLEARN_DATA_DIR || path.join(process.cwd(), "data");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const RESULTS_FILE = path.join(DATA_DIR, "results.json");

function ensureFile(file: string): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "[]", "utf-8");
  }
}

function readArray<T>(file: string, strict = false): T[] {
  if (!strict) ensureFile(file);
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf-8").trim();
  } catch (error) {
    if (strict && (error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed))
      throw new Error("Invalid stored records");
    return parsed as T[];
  } catch (error) {
    if (strict) throw error;
    // Preserve corrupt data instead of letting the next write silently
    // truncate the file: rename it aside and start from an empty list.
    // Preservation must succeed before a caller can write a fresh store.
    // Include a unique suffix so repeated failures cannot replace an earlier
    // quarantine created in the same millisecond.
    fs.renameSync(file, `${file}.corrupt-${Date.now()}-${randomUUID()}`);
    return [];
  }
}

/** Atomic rewrite: tmp file + rename, so a crash never leaves a torn file. */
function writeArray<T>(file: string, data: T[]): void {
  ensureFile(file);
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

export function createSession(s: TestSession): void {
  const sessions = readArray<TestSession>(SESSIONS_FILE);
  const idx = sessions.findIndex((x) => x.id === s.id);
  if (idx >= 0) {
    sessions[idx] = s;
  } else {
    sessions.push(s);
  }
  writeArray(SESSIONS_FILE, sessions);
}

export function getSession(id: string): TestSession | null {
  const sessions = readArray<TestSession>(SESSIONS_FILE);
  return sessions.find((x) => x.id === id) ?? null;
}

export function updateSession(s: TestSession): void {
  const sessions = readArray<TestSession>(SESSIONS_FILE);
  const idx = sessions.findIndex((x) => x.id === s.id);
  if (idx >= 0) {
    sessions[idx] = s;
  } else {
    sessions.push(s);
  }
  writeArray(SESSIONS_FILE, sessions);
}

export function saveResult(r: TestResult): void {
  const results = readArray<TestResult>(RESULTS_FILE);
  const idx = results.findIndex((x) => x.sessionId === r.sessionId);
  if (idx >= 0) {
    results[idx] = r;
  } else {
    results.push(r);
  }
  writeArray(RESULTS_FILE, results);
}

export function getResults(opts?: {
  userId?: string | null;
  strict?: boolean;
}): TestResult[] {
  const all = readArray<TestResult>(RESULTS_FILE, opts?.strict);
  if (opts?.userId) {
    return all.filter((r) => r.userId === opts.userId);
  }
  if (opts && "userId" in opts && opts.userId === null) {
    return all.filter((r) => !r.userId);
  }
  return all;
}

export function getResult(sessionId: string): TestResult | null {
  const results = readArray<TestResult>(RESULTS_FILE);
  return results.find((x) => x.sessionId === sessionId) ?? null;
}

export function deleteSession(id: string): boolean {
  const sessions = readArray<TestSession>(SESSIONS_FILE);
  const next = sessions.filter((x) => x.id !== id);
  if (next.length === sessions.length) return false;
  writeArray(SESSIONS_FILE, next);
  return true;
}

export function deleteResult(sessionId: string): boolean {
  const results = readArray<TestResult>(RESULTS_FILE);
  const next = results.filter((x) => x.sessionId !== sessionId);
  if (next.length === results.length) return false;
  writeArray(RESULTS_FILE, next);
  return true;
}

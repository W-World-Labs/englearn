import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { AttemptSession, SavedAttempt } from "./storage-types";

export function validAttemptId(id: string): boolean {
  return /^[a-zA-Z0-9-]{1,100}$/.test(id);
}

/** All callers share the registered single Node writer and atomic, owner-scoped files. */
export function createAttemptStore<T extends AttemptSession>({
  namespace,
  parse,
  reconcile,
  update,
}: {
  namespace: string;
  parse: (raw: string | null) => T | null;
  reconcile: (session: T, now: number) => T;
  update: (previous: T, incoming: T) => T | null;
}) {
  function directory(userId: string) {
    return path.join(
      process.env.ENGLEARN_DATA_DIR || path.join(process.cwd(), "data"),
      namespace,
      createHash("sha256").update(userId).digest("hex"),
    );
  }
  function get(userId: string, id: string): SavedAttempt<T> | null {
    if (!validAttemptId(id)) return null;
    let raw: string;
    try {
      raw = fs.readFileSync(path.join(directory(userId), `${id}.json`), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    const saved = JSON.parse(raw) as SavedAttempt<T>;
    const session = parse(JSON.stringify(saved.session));
    if (
      !session ||
      !Number.isInteger(saved.revision) ||
      saved.revision < 1 ||
      !Number.isFinite(saved.updatedAt)
    )
      throw new Error("Invalid stored exam record");
    return { ...saved, session };
  }
  function list(userId: string) {
    let files: string[];
    try {
      files = fs.readdirSync(directory(userId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    return files
      .filter((file) => file.endsWith(".json"))
      .map((file) => get(userId, file.slice(0, -5))!)
      .filter(Boolean)
      .map((saved) => ({
        ...saved,
        session: reconcile(saved.session, Date.now()),
      }))
      .sort((a, b) => b.session.startedAt - a.session.startedAt);
  }
  function save(
    userId: string,
    incoming: T,
    revision: number | null,
  ): { ok: boolean; attempt: SavedAttempt<T> } {
    const existing = get(userId, incoming.id);
    if (
      existing &&
      JSON.stringify(existing.session) === JSON.stringify(incoming)
    )
      return { ok: true, attempt: existing };
    if (
      (existing?.revision ?? null) !== revision ||
      existing?.session.status === "finished"
    ) {
      if (existing) return { ok: false, attempt: existing };
      throw new Error("Attempt revision without an existing record");
    }
    if (existing) {
      const next = update(existing.session, incoming);
      if (!next) return { ok: false, attempt: existing };
      incoming = next;
    }
    const attempt = {
      session: reconcile(incoming, Date.now()),
      revision: (existing?.revision ?? 0) + 1,
      updatedAt: Date.now(),
    };
    const folder = directory(userId);
    fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
    const temporary = path.join(folder, `${randomUUID()}.tmp`);
    try {
      fs.writeFileSync(temporary, JSON.stringify(attempt), {
        encoding: "utf8",
        mode: 0o600,
        flag: "wx",
      });
      fs.renameSync(temporary, path.join(folder, `${incoming.id}.json`));
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
    return { ok: true, attempt };
  }
  return { get, list, save };
}

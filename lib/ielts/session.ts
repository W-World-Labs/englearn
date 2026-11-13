import {
  EXAM_ID,
  isExamId,
  sectionsFor,
  sectionIds,
  sectionSeconds,
  type ExamId,
  type ExamMode,
} from "./exam";

export interface Highlight {
  start: number;
  end: number;
}
export interface ExamSession {
  examId: string;
  id: string;
  mode: ExamMode;
  startedAt: number;
  deadline: number;
  sectionIndex: number;
  partIndex: number;
  status: "running" | "finished";
  completedAt?: number;
  answers: Record<string, string>;
  flags: string[];
  notes: Record<string, string>;
  highlights: Record<string, Highlight[]>;
}

export interface SavedExam {
  session: ExamSession;
  revision: number;
  updatedAt: number;
}

export interface ExamSummary {
  id: string;
  examId: string;
  mode: ExamMode;
  status: ExamSession["status"];
  startedAt: number;
  completedAt?: number;
  updatedAt: number;
  revision: number;
}

export function createSession(
  mode: ExamMode,
  now: number,
  id: string,
  examId: ExamId = EXAM_ID,
): ExamSession {
  return {
    examId,
    id,
    mode,
    startedAt: now,
    deadline: now + sectionSeconds(sectionIds(mode)[0], examId) * 1000,
    sectionIndex: 0,
    partIndex: 0,
    status: "running",
    answers: {},
    flags: [],
    notes: {},
    highlights: {},
  };
}

export function finishSection(session: ExamSession, now: number): ExamSession {
  if (session.status === "finished") return session;
  const ids = sectionIds(session.mode);
  const next = session.sectionIndex + 1;
  if (next >= ids.length)
    return { ...session, status: "finished", completedAt: now };
  return {
    ...session,
    sectionIndex: next,
    partIndex: 0,
    deadline:
      now +
      sectionSeconds(ids[next], isExamId(session.examId) ? session.examId : EXAM_ID) *
        1000,
  };
}

/** A wall-clock deadline keeps running across refreshes and background tabs. */
export function reconcileSession(
  session: ExamSession,
  now: number,
): ExamSession {
  let current = session;
  while (current.status === "running" && now >= current.deadline) {
    current = finishSection(current, current.deadline);
  }
  return current;
}

export function storageKey(owner: string, examId: ExamId = EXAM_ID): string {
  return `lingolearn:ielts:${encodeURIComponent(owner)}:${examId}`;
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function strings(
  value: unknown,
  limit: number,
): value is Record<string, string> {
  return (
    record(value) &&
    Object.keys(value).length <= 100 &&
    Object.values(value).every(
      (v) => typeof v === "string" && v.length <= limit,
    )
  );
}

/** Treat persisted data as untrusted; an old or damaged draft must not crash the exam. */
export function parseSession(raw: string | null): ExamSession | null {
  if (!raw || raw.length > 500000) return null;
  try {
    const s: unknown = JSON.parse(raw);
    if (
      !record(s) ||
      !isExamId(s.examId) ||
      typeof s.id !== "string" ||
      s.id.length > 100 ||
      !["full", "listening", "reading", "writing"].includes(String(s.mode))
    )
      return null;
    const ids = sectionIds(s.mode as ExamMode);
    if (
      !Number.isInteger(s.sectionIndex) ||
      Number(s.sectionIndex) < 0 ||
      Number(s.sectionIndex) >= ids.length
    )
      return null;
    const section = sectionsFor(s.examId as ExamId)[ids[Number(s.sectionIndex)]];
    if (
      !Number.isInteger(s.partIndex) ||
      Number(s.partIndex) < 0 ||
      Number(s.partIndex) >= section.parts.length
    )
      return null;
    if (s.status !== "running" && s.status !== "finished") return null;
    if (
      typeof s.startedAt !== "number" ||
      !Number.isFinite(s.startedAt) ||
      typeof s.deadline !== "number" ||
      !Number.isFinite(s.deadline) ||
      s.deadline < s.startedAt
    )
      return null;
    if (
      s.status === "finished" &&
      (typeof s.completedAt !== "number" || !Number.isFinite(s.completedAt))
    )
      return null;
    if (!strings(s.answers, 30000) || !strings(s.notes, 10000)) return null;
    if (
      !Array.isArray(s.flags) ||
      s.flags.length > 100 ||
      !s.flags.every((f) => typeof f === "string")
    )
      return null;
    if (
      !record(s.highlights) ||
      Object.keys(s.highlights).length > 10 ||
      !Object.values(s.highlights).every(
        (v) =>
          Array.isArray(v) &&
          v.length <= 200 &&
          v.every(
            (h) =>
              record(h) &&
              Number.isInteger(h.start) &&
              Number.isInteger(h.end) &&
              Number(h.start) >= 0 &&
              Number(h.end) > Number(h.start) &&
              Number(h.end) <= 50000,
          ),
      )
    )
      return null;
    return s as unknown as ExamSession;
  } catch {
    return null;
  }
}

export function mergeHighlight(
  ranges: Highlight[],
  added: Highlight,
): Highlight[] {
  const sorted = [...ranges, added].sort((a, b) => a.start - b.start);
  const merged: Highlight[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end)
      last.end = Math.max(last.end, range.end);
    else merged.push({ start: range.start, end: range.end });
  }
  return merged.slice(0, 200);
}

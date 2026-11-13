import {
  getPaper,
  practiceSections,
  type PracticeMode,
  type ExamFamily,
} from "./catalog";
import type { AttemptSession, SavedAttempt } from "./storage-types";
export interface PracticeSession extends AttemptSession {
  paperId: string;
  mode: PracticeMode;
  deadline: number;
  sectionIndex: number;
  questionIndex: number;
  answers: Record<string, string>;
  flags: string[];
}
export interface PracticeSummary extends AttemptSession {
  paperId: string;
  mode: PracticeMode;
  revision: number;
  updatedAt: number;
}
export function practiceStorageKey(owner: string, family: ExamFamily) {
  return `lingolearn:exams:${family}:${encodeURIComponent(owner)}`;
}
export function createPractice(
  paperId: string,
  mode: PracticeMode,
  now: number,
  id: string,
): PracticeSession {
  const paper = getPaper(paperId);
  const sections = paper && practiceSections(paper, mode);
  if (!sections?.length)
    throw new Error("Unknown paper or unavailable section");
  return {
    id,
    paperId,
    mode,
    startedAt: now,
    deadline: now + sections[0].minutes * 60000,
    sectionIndex: 0,
    questionIndex: 0,
    answers: {},
    flags: [],
    status: "running",
  };
}
export function finishPracticeSection(
  s: PracticeSession,
  now: number,
): PracticeSession {
  if (s.status === "finished") return s;
  const sections = practiceSections(getPaper(s.paperId)!, s.mode);
  if (s.sectionIndex + 1 >= sections.length)
    return { ...s, status: "finished", completedAt: now };
  return {
    ...s,
    sectionIndex: s.sectionIndex + 1,
    questionIndex: 0,
    deadline: now + sections[s.sectionIndex + 1].minutes * 60000,
  };
}
export function reconcilePractice(s: PracticeSession, now: number) {
  let current = s;
  while (current.status === "running" && now >= current.deadline)
    current = finishPracticeSection(current, current.deadline);
  return current;
}
export function parsePractice(raw: string | null): PracticeSession | null {
  if (!raw || raw.length > 500000) return null;
  try {
    const s = JSON.parse(raw) as PracticeSession;
    if (
      !s ||
      typeof s !== "object" ||
      typeof s.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,100}$/.test(s.id) ||
      ![
        "all",
        "listening",
        "reading",
        "writing",
        "vocabulary",
        "grammar_reading",
        "language_reading",
      ].includes(s.mode)
    )
      return null;
    const paper = getPaper(s.paperId);
    if (!paper) return null;
    const sections = practiceSections(paper, s.mode);
    if (
      !Number.isInteger(s.sectionIndex) ||
      s.sectionIndex < 0 ||
      s.sectionIndex >= sections.length
    )
      return null;
    const questions = paper.questions.filter(
      (q) => q.section === sections[s.sectionIndex].id,
    );
    if (
      !Number.isInteger(s.questionIndex) ||
      s.questionIndex < 0 ||
      s.questionIndex >= questions.length
    )
      return null;
    if (
      !["running", "finished"].includes(s.status) ||
      !Number.isFinite(s.startedAt) ||
      !Number.isFinite(s.deadline) ||
      s.deadline < s.startedAt
    )
      return null;
    if (
      s.status === "finished" &&
      (s.sectionIndex !== sections.length - 1 ||
        !Number.isFinite(s.completedAt) ||
        s.completedAt! < s.startedAt)
    )
      return null;
    const allowed = new Map(
      paper.questions
        .filter((q) => sections.some((section) => section.id === q.section))
        .map((q) => [q.id, q]),
    );
    if (
      !s.answers ||
      typeof s.answers !== "object" ||
      Array.isArray(s.answers) ||
      Object.keys(s.answers).length > allowed.size
    )
      return null;
    for (const [id, answer] of Object.entries(s.answers)) {
      const q = allowed.get(id);
      if (!q || typeof answer !== "string" || answer.length > 10000)
        return null;
      if (
        q.kind === "choice" &&
        answer &&
        !q.options?.some((_, i) => answer === String.fromCharCode(65 + i))
      )
        return null;
    }
    if (
      !Array.isArray(s.flags) ||
      s.flags.length > allowed.size ||
      s.flags.some((id) => typeof id !== "string" || !allowed.has(id))
    )
      return null;
    // Pick only the contract fields. Client-supplied grades/owners are never persisted.
    return {
      id: s.id,
      paperId: s.paperId,
      mode: s.mode,
      startedAt: s.startedAt,
      deadline: s.deadline,
      sectionIndex: s.sectionIndex,
      questionIndex: s.questionIndex,
      status: s.status,
      ...(s.status === "finished" ? { completedAt: s.completedAt } : {}),
      answers: s.answers,
      flags: [...new Set(s.flags)],
    };
  } catch {
    return null;
  }
}
export function practiceSummary(
  saved: SavedAttempt<PracticeSession>,
): PracticeSummary {
  const { session: s, revision, updatedAt } = saved;
  return {
    id: s.id,
    paperId: s.paperId,
    mode: s.mode,
    status: s.status,
    startedAt: s.startedAt,
    ...(s.completedAt ? { completedAt: s.completedAt } : {}),
    revision,
    updatedAt,
  };
}

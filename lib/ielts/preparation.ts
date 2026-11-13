import {
  EXAM_IDS,
  isExamId,
  sectionsFor,
  type ExamId,
  type ExamQuestion,
} from "./exam";

export const SKILLS = ["listening", "reading", "writing", "speaking"] as const;
export type IeltsSkill = (typeof SKILLS)[number];
export type PreparationWorkspace = "today" | "speaking" | "writing" | "mistakes";
export function parsePreparationWorkspace(value: unknown): PreparationWorkspace | undefined {
  return value === "today" || value === "speaking" || value === "writing" || value === "mistakes" ? value : undefined;
}
export type Bands = Record<IeltsSkill, number>;
export const CAUSES = [
  "vocabulary",
  "sound",
  "spelling",
  "location",
  "distractor",
  "evidence",
  "timing",
] as const;
export type ErrorCause = (typeof CAUSES)[number];
export interface PrepMistake {
  examId: ExamId;
  questionId: string;
  skill: "listening" | "reading";
  cause: ErrorCause;
  dueAt: number;
  checks: number;
  lastCorrect: boolean | null;
}
export interface IeltsPreparation {
  version: 1;
  goal: number;
  minimum: number;
  examDate: string;
  minutes: number;
  current: Record<IeltsSkill, number | null>;
  completed: { date: string; skill: IeltsSkill }[];
  mistakes: PrepMistake[];
  writing: {
    task: "task-1" | "task-2";
    examId: ExamId;
    draft: string;
    rewrite: string;
  };
}
export const MAX_PREP_MISTAKES = 160;
const DAY = 86400000;
export function localDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function dateValue(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const at = Date.parse(value + "T00:00:00Z");
  return (
    Number.isFinite(at) && new Date(at).toISOString().slice(0, 10) === value
  );
}
export function createPreparation(now = new Date()): IeltsPreparation {
  const exam = new Date(now);
  exam.setDate(exam.getDate() + 60);
  return {
    version: 1,
    goal: 7,
    minimum: 6,
    examDate: localDate(exam),
    minutes: 60,
    current: { listening: null, reading: null, writing: null, speaking: null },
    completed: [],
    mistakes: [],
    writing: { task: "task-2", examId: EXAM_IDS[0], draft: "", rewrite: "" },
  };
}
const band = (value: unknown): value is number =>
  typeof value === "number" &&
  value >= 0 &&
  value <= 9 &&
  Number.isInteger(value * 2);
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
export function prepQuestion(
  m: Pick<PrepMistake, "examId" | "skill" | "questionId">,
): ExamQuestion | undefined {
  return sectionsFor(m.examId)[m.skill].questions.find(
    (q) => q.id === m.questionId,
  );
}
/** Bounded, normalized extension; legacy journals without it remain valid. */
export function parsePreparation(value: unknown): IeltsPreparation | null {
  if (
    !object(value) ||
    value.version !== 1 ||
    !band(value.goal) ||
    value.goal < 4 ||
    !band(value.minimum) ||
    !dateValue(value.examDate) ||
    ![15, 30, 60, 90, 120, 180].includes(Number(value.minutes)) ||
    typeof value.minutes !== "number" ||
    !object(value.current) ||
    !SKILLS.every(
      (s) =>
        value.current &&
        object(value.current) &&
        (value.current[s] === null || band(value.current[s])),
    ) ||
    !Array.isArray(value.completed) ||
    value.completed.length > 732 ||
    !Array.isArray(value.mistakes) ||
    value.mistakes.length > MAX_PREP_MISTAKES ||
    !object(value.writing)
  )
    return null;
  const completed: IeltsPreparation["completed"] = [];
  for (const row of value.completed) {
    if (
      !object(row) ||
      !dateValue(row.date) ||
      !SKILLS.includes(row.skill as IeltsSkill) ||
      completed.some((r) => r.date === row.date && r.skill === row.skill)
    )
      return null;
    completed.push({ date: row.date, skill: row.skill as IeltsSkill });
  }
  const mistakes: PrepMistake[] = [];
  for (const row of value.mistakes) {
    if (
      !object(row) ||
      !isExamId(row.examId) ||
      !["listening", "reading"].includes(String(row.skill)) ||
      typeof row.questionId !== "string" ||
      !CAUSES.includes(row.cause as ErrorCause) ||
      !Number.isSafeInteger(row.dueAt) ||
      Number(row.dueAt) <= 0 ||
      !Number.isSafeInteger(row.checks) ||
      Number(row.checks) < 0 ||
      Number(row.checks) > 10000 ||
      ![true, false, null].includes(row.lastCorrect as boolean | null)
    )
      return null;
    const m: PrepMistake = {
      examId: row.examId,
      questionId: row.questionId,
      skill: row.skill as PrepMistake["skill"],
      cause: row.cause as ErrorCause,
      dueAt: Number(row.dueAt),
      checks: Number(row.checks),
      lastCorrect: row.lastCorrect as boolean | null,
    };
    if (
      !prepQuestion(m) ||
      mistakes.some(
        (r) => r.examId === m.examId && r.questionId === m.questionId,
      )
    )
      return null;
    mistakes.push(m);
  }
  const w = value.writing;
  if (
    !isExamId(w.examId) ||
    !["task-1", "task-2"].includes(String(w.task)) ||
    typeof w.draft !== "string" ||
    w.draft.length > 16000 ||
    typeof w.rewrite !== "string" ||
    w.rewrite.length > 16000
  )
    return null;
  return {
    version: 1,
    goal: value.goal,
    minimum: value.minimum,
    examDate: value.examDate,
    minutes: value.minutes,
    current: Object.fromEntries(
      SKILLS.map((s) => [
        s,
        (value.current as Record<string, number | null>)[s],
      ]),
    ) as IeltsPreparation["current"],
    completed,
    mistakes,
    writing: {
      examId: w.examId,
      task: w.task as "task-1" | "task-2",
      draft: w.draft,
      rewrite: w.rewrite,
    },
  };
}
/** IELTS rounds the mean to the nearest half band, with quarter bands upwards. */
export function overallBand(scores: Bands): number {
  return Math.round(SKILLS.reduce((n, s) => n + scores[s], 0) / 2) / 2;
}
/** A transparent allocation heuristic, not a prediction of improvement speed. */
export function targetBands(prep: IeltsPreparation): Bands {
  const scores = Object.fromEntries(
    SKILLS.map((s) => [
      s,
      Math.max(prep.minimum, prep.current[s] ?? Math.max(0, prep.goal - 1.5)),
    ]),
  ) as Bands;
  while (overallBand(scores) < prep.goal) {
    const next = SKILLS.filter((s) => scores[s] < 9).sort((a, b) => {
      const cost = (s: IeltsSkill) =>
        (scores[s] - (prep.current[s] ?? prep.goal - 1.5) + 0.5) *
        (s === "listening" || s === "reading" ? 0.8 : 1.2);
      return cost(a) - cost(b);
    })[0];
    if (!next) break;
    scores[next] += 0.5;
  }
  return scores;
}
export function preparationDay(prep: IeltsPreparation, now = new Date()) {
  const today = localDate(now);
  const days = Math.round(
    (Date.parse(prep.examDate) - Date.parse(today)) / DAY,
  );
  const targets = targetBands(prep);
  // Rotate ties across calendar dates; missing evidence remains diagnostic work.
  const rotation = Math.floor(Date.parse(today) / DAY) % 4;
  const skills = [...SKILLS].sort(
    (a, b) =>
      targets[b] -
        (prep.current[b] ?? 0) -
        (targets[a] - (prep.current[a] ?? 0)) ||
      ((SKILLS.indexOf(a) + rotation) % 4) -
        ((SKILLS.indexOf(b) + rotation) % 4),
  );
  const count = prep.minutes >= 60 ? 4 : prep.minutes >= 30 ? 2 : 1;
  const selected = skills.slice(0, count);
  const weights = selected.map(
    (s) => 1 + Math.max(0, targets[s] - (prep.current[s] ?? targets[s] - 1)),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let remaining = prep.minutes;
  const tasks = selected.map((skill, i) => {
    const minutes =
      i === selected.length - 1
        ? remaining
        : Math.floor((prep.minutes * weights[i]) / total);
    remaining -= minutes;
    return {
      skill,
      minutes,
      done: prep.completed.some((r) => r.date === today && r.skill === skill),
    };
  });
  return {
    today,
    days,
    targets,
    tasks,
    stage: days <= 7 ? "rehearsal" : days <= 28 ? "timed" : "foundation",
  };
}

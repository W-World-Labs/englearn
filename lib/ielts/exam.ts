import reading from "@/data/ielts/reading.json";
import listening from "@/data/ielts/listening.json";
import reading02 from "@/data/ielts/reading-02.json";
import listening02 from "@/data/ielts/listening-02.json";

export type SectionId = "listening" | "reading" | "writing";
export type ExamMode = SectionId | "full";

export interface ExamQuestion {
  id: string;
  partId: string;
  number: number;
  type: string;
  prompt: string;
  instruction: string;
  groupId: string;
  groupContent?: string;
  options: { value: string; label: string }[];
  answers: string[];
  wordLimit?: number | null;
  allowNumber?: boolean;
  explanation: string;
}

export interface ExamPart {
  id: string;
  title: string;
  content: string;
  audio?: string;
  map?: boolean;
  minWords?: number;
}

export interface ExamSection {
  id: SectionId;
  minutes: number;
  parts: ExamPart[];
  questions: ExamQuestion[];
}

export const EXAM_ID = "academic-practice-01-v1";
export const EXAM_ID_02 = "academic-practice-02-v1";
export const EXAM_IDS = [EXAM_ID, EXAM_ID_02] as const;
export type ExamId = (typeof EXAM_IDS)[number];
export function isExamId(value: unknown): value is ExamId {
  return value === EXAM_ID || value === EXAM_ID_02;
}
/** Display labels double as history disambiguators; keep stable. */
export const EXAM_LABELS: Record<ExamId, string> = {
  [EXAM_ID]: "Practice 01",
  [EXAM_ID_02]: "Practice 02",
};
// Durations measured from the bundled, unmodified MP3 files.
export const LISTENING_TRACK_SECONDS = [295.568, 232.58, 326.07, 242.4];
// Durations measured from the bundled Practice 02 synthesized MP3 files.
export const LISTENING_TRACK_SECONDS_02 = [317.976, 247.512, 255.504, 301.344];
export const LISTENING_PREVIEW_SECONDS = 30;
export const LISTENING_REVIEW_SECONDS = 120;
function listeningTotal(tracks: readonly number[]): number {
  return (
    tracks.reduce((sum, seconds) => sum + seconds + LISTENING_PREVIEW_SECONDS, 0) +
    LISTENING_REVIEW_SECONDS
  );
}
export const LISTENING_SECONDS = listeningTotal(LISTENING_TRACK_SECONDS);
export const LISTENING_SECONDS_02 = listeningTotal(LISTENING_TRACK_SECONDS_02);
export function tracksFor(examId: ExamId = EXAM_ID): readonly number[] {
  return examId === EXAM_ID_02 ? LISTENING_TRACK_SECONDS_02 : LISTENING_TRACK_SECONDS;
}

export function listeningPosition(elapsed: number, examId: ExamId = EXAM_ID) {
  const tracks = tracksFor(examId);
  let cursor = Math.max(0, elapsed);
  for (
    let partIndex = 0;
    partIndex < tracks.length;
    partIndex++
  ) {
    if (cursor < LISTENING_PREVIEW_SECONDS)
      return {
        partIndex,
        phase: "preview" as const,
        time: 0,
        remaining: Math.ceil(LISTENING_PREVIEW_SECONDS - cursor),
      };
    cursor -= LISTENING_PREVIEW_SECONDS;
    if (cursor < tracks[partIndex])
      return {
        partIndex,
        phase: "playing" as const,
        time: cursor,
        remaining: 0,
      };
    cursor -= tracks[partIndex];
  }
  return {
    partIndex: tracks.length - 1,
    phase: "review" as const,
    time: 0,
    remaining: Math.max(0, Math.ceil(LISTENING_REVIEW_SECONDS - cursor)),
  };
}

export function sectionSeconds(id: SectionId, examId: ExamId = EXAM_ID): number {
  return id === "listening" ? listeningTotal(tracksFor(examId)) : 3600;
}

interface ReadingData {
  passages: { id: string; title: string; content: string }[];
  questions: {
    id: string;
    passageId: string;
    questionNumber: number;
    type: string;
    question: string;
    groupInstruction: string;
    groupId: string;
    groupContent?: string;
    options?: string[];
    correctAnswer: string;
    acceptableAnswers?: string[];
    wordLimit?: number | null;
    explanation: string;
  }[];
}
interface ListeningData {
  parts: ExamPart[];
  questions: ExamQuestion[];
}
interface WritingPart {
  id: string;
  title: string;
  minWords: number;
  content: string;
}

const WRITING_01: WritingPart[] = [
  {
    id: "task-1",
    title: "Writing Task 1",
    minWords: 150,
    content:
      "You should spend about 20 minutes on this task.\n\nThe table below shows the percentage of journeys to work made by four forms of transport in the city of Westbridge in 2000, 2010 and 2020.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.",
  },
  {
    id: "task-2",
    title: "Writing Task 2",
    minWords: 250,
    content:
      "You should spend about 40 minutes on this task.\n\nSome people believe that cities should invest more in public transport, while others think that improving roads for private cars is more important.\n\nDiscuss both views and give your own opinion.\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.",
  },
];

/** Practice 02 writing tasks are original LingoLearn material (CC BY-SA 4.0). */
const WRITING_02: WritingPart[] = [
  {
    id: "task-1",
    title: "Writing Task 1",
    minWords: 150,
    content:
      "You should spend about 20 minutes on this task.\n\nThe line chart below shows the number of printed books and e-books borrowed (in thousands) from public libraries in the city of Marrowgate between 2010 and 2024.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.",
  },
  {
    id: "task-2",
    title: "Writing Task 2",
    minWords: 250,
    content:
      "You should spend about 40 minutes on this task.\n\nSome people think that popular tourist cities should introduce a tourist tax to protect public services and the environment, while others believe that such a tax discourages visitors and harms the local economy.\n\nDiscuss both views and give your own opinion.\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.",
  },
];

function buildSections(
  readingData: ReadingData,
  listeningData: ListeningData,
  writingParts: WritingPart[],
  listeningMinutes: number,
): Record<SectionId, ExamSection> {
  return {
    listening: {
      id: "listening",
      minutes: listeningMinutes,
      ...listeningData,
    },
    reading: {
      id: "reading",
      minutes: 60,
      parts: readingData.passages.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
      })),
      questions: readingData.questions.map((q) => ({
        id: q.id,
        partId: q.passageId,
        number: q.questionNumber,
        type: q.type,
        prompt: q.question,
        instruction: q.groupInstruction,
        groupId: q.groupId,
        groupContent: q.groupContent,
        options: (q.options ?? []).map((o, i) => ({
          value: o,
          label:
            q.type === "multiple-choice"
              ? `${String.fromCharCode(65 + i)}. ${o}`
              : o,
        })),
        answers: [q.correctAnswer, ...(q.acceptableAnswers ?? [])],
        wordLimit: q.wordLimit,
        explanation: q.explanation,
      })),
    },
    writing: {
      id: "writing",
      minutes: 60,
      questions: [],
      parts: writingParts,
    },
  };
}

export const SECTIONS: Record<SectionId, ExamSection> = buildSections(
  reading as ReadingData,
  listening as unknown as ListeningData,
  WRITING_01,
  Math.ceil(LISTENING_SECONDS / 60),
);
export const SECTIONS_02: Record<SectionId, ExamSection> = buildSections(
  reading02 as ReadingData,
  listening02 as unknown as ListeningData,
  WRITING_02,
  Math.ceil(LISTENING_SECONDS_02 / 60),
);
export function sectionsFor(examId: ExamId = EXAM_ID): Record<SectionId, ExamSection> {
  return examId === EXAM_ID_02 ? SECTIONS_02 : SECTIONS;
}

export const TRANSPORT_TABLE = [
  ["Car", 58, 49, 38],
  ["Public transport", 25, 30, 36],
  ["Bicycle", 7, 11, 16],
  ["Walking", 10, 10, 10],
] as const;

/** Original LingoLearn chart data for Practice 02 Task 1 (thousands borrowed). */
export const MARROWGATE_TABLE = [
  ["Printed books", 82, 76, 61, 48, 39],
  ["E-books", 6, 18, 37, 58, 74],
] as const;
export const MARROWGATE_YEARS = [2010, 2014, 2018, 2021, 2024] as const;

export function sectionIds(mode: ExamMode): SectionId[] {
  return mode === "full" ? ["listening", "reading", "writing"] : [mode];
}

export function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/u)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ");
}

export function isCorrect(question: ExamQuestion, answer = ""): boolean {
  const normalized = normalizeAnswer(answer);
  if (!normalized) return false;
  if (question.wordLimit) {
    const words = normalized
      .split(/\s+/)
      .filter((w) => /[\p{L}\p{N}]/u.test(w));
    const numbers = question.allowNumber
      ? words.filter((w) => /^\d+(?:[.,]\d+)*(?:st|nd|rd|th)?$/.test(w)).length
      : 0;
    if (numbers > 1 || words.length - numbers > question.wordLimit)
      return false;
  }
  return question.answers.some(
    (accepted) => normalizeAnswer(accepted) === normalized,
  );
}

// Practice estimates only: operational IELTS thresholds vary by test form.
const READING_BANDS = [
  [39, 9],
  [37, 8.5],
  [35, 8],
  [33, 7.5],
  [30, 7],
  [27, 6.5],
  [23, 6],
  [19, 5.5],
  [15, 5],
  [13, 4.5],
  [10, 4],
  [8, 3.5],
  [6, 3],
  [4, 2.5],
  [3, 2],
  [2, 1.5],
  [1, 1],
  [0, 0],
];
const LISTENING_BANDS = [
  [39, 9],
  [37, 8.5],
  [35, 8],
  [32, 7.5],
  [30, 7],
  [26, 6.5],
  [23, 6],
  [18, 5.5],
  [16, 5],
  [13, 4.5],
  [10, 4],
  [8, 3.5],
  [6, 3],
  [4, 2.5],
  [3, 2],
  [2, 1.5],
  [1, 1],
  [0, 0],
];

export function sectionResult(
  id: SectionId,
  answers: Record<string, string>,
  examId: ExamId = EXAM_ID,
) {
  const questions = sectionsFor(examId)[id].questions;
  const rows = questions.map((question) => ({
    question,
    answer: answers[question.id] ?? "",
    correct: isCorrect(question, answers[question.id]),
  }));
  const correct = rows.filter((r) => r.correct).length;
  const bands = id === "reading" ? READING_BANDS : LISTENING_BANDS;
  return {
    rows,
    correct,
    band:
      id === "writing"
        ? null
        : bands.find(([threshold]) => correct >= threshold)![1],
  };
}

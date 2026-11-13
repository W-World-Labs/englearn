import { createAttemptStore } from "@/lib/exams/attempt-store";
import { createAttemptHandlers } from "@/lib/exams/attempt-api";
import { studyCard } from "@/lib/learning/cards";
import { activityQuestion } from "@/lib/learning/workbench";
import { getPaper } from "@/lib/exams/catalog";
import { SECTIONS, SECTIONS_02 } from "@/lib/ielts/exam";
import { getItemById } from "@/lib/items";
interface QuestionFeedback {
  id: string;
  startedAt: number;
  status: "finished";
  question: string;
  reason: "answer" | "explanation" | "difficulty";
  note: string;
}
export function knownFeedbackQuestion(ref: string) {
  if (ref.length > 200) return false;
  if (studyCard(ref)) return true;
  if (ref.startsWith("x:")) return !!activityQuestion(ref.slice(2));
  if (ref.startsWith("a:")) return !!getItemById(ref.slice(2));
  if (ref.startsWith("e:")) {
    const [paper, id, ...rest] = ref.slice(2).split(":");
    return (
      !rest.length && !!getPaper(paper)?.questions.some((q) => q.id === id)
    );
  }
  if (ref.startsWith("i:"))
    return [SECTIONS, SECTIONS_02].some((sections) =>
      Object.values(sections).some(
        (s) =>
          s.questions.some((q) => q.id === ref.slice(2)) ||
          s.parts.some((p) => p.id === ref.slice(2)),
      ),
    );
  return false;
}
function parse(raw: string | null): QuestionFeedback | null {
  if (!raw || raw.length > 10000) return null;
  try {
    const s = JSON.parse(raw);
    if (
      !s ||
      typeof s.id !== "string" ||
      !/^feedback-[a-zA-Z0-9-]{1,80}$/.test(s.id) ||
      !Number.isSafeInteger(s.startedAt) ||
      s.startedAt <= 0 ||
      s.startedAt > Date.now() + 30000 ||
      s.status !== "finished" ||
      typeof s.question !== "string" ||
      !knownFeedbackQuestion(s.question) ||
      !["answer", "explanation", "difficulty"].includes(s.reason) ||
      typeof s.note !== "string" ||
      s.note.length > 500
    )
      return null;
    return {
      id: s.id,
      startedAt: s.startedAt,
      status: "finished",
      question: s.question,
      reason: s.reason,
      note: s.note.trim(),
    };
  } catch {
    return null;
  }
}
export const feedbackStore = createAttemptStore({
  namespace: "learning-feedback",
  parse,
  reconcile: (s: QuestionFeedback) => s,
  update: (previous, incoming) =>
    JSON.stringify(previous) === JSON.stringify(incoming) ? previous : null,
});
const handlers = createAttemptHandlers({
  ...feedbackStore,
  parse,
  reconcile: (s: QuestionFeedback) => s,
  duration: () => 0,
  maxBodyBytes: 12000,
  summary: ({ session, revision, updatedAt }) => ({
    ...session,
    revision,
    updatedAt,
  }),
});
export const { GET, POST } = handlers;

import { isExamId, sectionsFor, sectionIds } from "@/lib/ielts/exam";
import { parseSession, reconcileSession } from "@/lib/ielts/session";
import { createAttemptStore } from "@/lib/exams/attempt-store";
export { validAttemptId } from "@/lib/exams/attempt-store";

const store = createAttemptStore({
  namespace: "ielts-attempts",
  parse: parseSession,
  reconcile: reconcileSession,
  update(previous, incoming) {
    if (
      incoming.examId !== previous.examId ||
      incoming.mode !== previous.mode ||
      incoming.startedAt !== previous.startedAt ||
      incoming.sectionIndex < previous.sectionIndex
    )
      return null;
    const sections = sectionsFor(
      isExamId(incoming.examId) ? incoming.examId : undefined,
    );
    const lockedIds = sectionIds(previous.mode)
      .slice(0, previous.sectionIndex)
      .flatMap((id) => [
        ...sections[id].questions.map((q) => q.id),
        ...sections[id].parts.map((p) => p.id),
      ]);
    if (lockedIds.some((id) => incoming.answers[id] !== previous.answers[id]))
      return null;
    return incoming.sectionIndex === previous.sectionIndex
      ? { ...incoming, deadline: previous.deadline }
      : incoming;
  },
});
export const getExamAttempt = store.get;
export const listExamAttempts = store.list;
export const saveExamAttempt = store.save;

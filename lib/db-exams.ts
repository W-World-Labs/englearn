import { createAttemptStore } from "./exams/attempt-store";
import { getPaper, practiceSections } from "./exams/catalog";
import { parsePractice, reconcilePractice } from "./exams/session";
export const practiceStore = createAttemptStore({
  namespace: "language-exam-attempts",
  parse: parsePractice,
  reconcile: reconcilePractice,
  update(previous, incoming) {
    if (
      incoming.paperId !== previous.paperId ||
      incoming.mode !== previous.mode ||
      incoming.startedAt !== previous.startedAt ||
      incoming.sectionIndex < previous.sectionIndex
    )
      return null;
    const paper = getPaper(previous.paperId)!;
    const sections = practiceSections(paper, previous.mode);
    // Cloud saves may batch several locally submitted sections after an outage.
    // Previously acknowledged sections stay locked; progression is bounded by
    // the parsed paper and the original remaining-time budget below.
    const locked = sections.slice(0, previous.sectionIndex).map((s) => s.id);
    if (
      paper.questions.some(
        (q) =>
          locked.includes(q.section) &&
          incoming.answers[q.id] !== previous.answers[q.id],
      )
    )
      return null;
    if (incoming.sectionIndex === previous.sectionIndex)
      return { ...incoming, deadline: previous.deadline };
    const latestAllowed =
      Math.min(Date.now(), previous.deadline) +
      sections
        .slice(previous.sectionIndex + 1, incoming.sectionIndex + 1)
        .reduce((sum, s) => sum + s.minutes * 60000, 0);
    return {
      ...incoming,
      deadline: Math.min(incoming.deadline, latestAllowed),
    };
  },
});

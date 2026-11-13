import { createAttemptHandlers } from "@/lib/exams/attempt-api";
import { practiceStore } from "@/lib/db-exams";
import {
  getPaper,
  practiceSections,
  type ExamFamily,
} from "@/lib/exams/catalog";
import {
  parsePractice,
  reconcilePractice,
  practiceSummary,
} from "@/lib/exams/session";
export function examHandlers(family: string) {
  if (family !== "hsk" && family !== "topik" && family !== "jlpt") return null;
  return handlers[family];
}
function forFamily(family: ExamFamily) {
  return createAttemptHandlers({
    get(owner, id) {
      const saved = practiceStore.get(owner, id);
      return saved && getPaper(saved.session.paperId)?.family === family
        ? saved
        : null;
    },
    list: (owner) =>
      practiceStore
        .list(owner)
        .filter((s) => getPaper(s.session.paperId)?.family === family),
    save: practiceStore.save,
    parse(raw) {
      const s = parsePractice(raw);
      return s && getPaper(s.paperId)?.family === family ? s : null;
    },
    reconcile: reconcilePractice,
    duration: (s) =>
      practiceSections(getPaper(s.paperId)!, s.mode).reduce(
        (sum, section) => sum + section.minutes * 60000,
        0,
      ),
    summary: practiceSummary,
  });
}
const handlers = {
  hsk: forFamily("hsk"),
  topik: forFamily("topik"),
  jlpt: forFamily("jlpt"),
};

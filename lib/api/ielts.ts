import {
  getExamAttempt,
  listExamAttempts,
  saveExamAttempt,
} from "@/lib/db-ielts";
import {
  parseSession,
  reconcileSession,
  type ExamSummary,
} from "@/lib/ielts/session";
import { isExamId, sectionIds, sectionSeconds } from "@/lib/ielts/exam";
import { createAttemptHandlers } from "@/lib/exams/attempt-api";
const handlers = createAttemptHandlers({
  get: getExamAttempt,
  list: listExamAttempts,
  save: saveExamAttempt,
  parse: parseSession,
  reconcile: reconcileSession,
  duration: (session) =>
    sectionIds(session.mode).reduce(
      (sum, id) =>
        sum +
        sectionSeconds(id, isExamId(session.examId) ? session.examId : undefined) *
          1000,
      0,
    ),
  summary: ({ session, revision, updatedAt }): ExamSummary => ({
    id: session.id,
    examId: session.examId,
    mode: session.mode,
    status: session.status,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    revision,
    updatedAt,
  }),
});
export const handleIeltsGet = handlers.GET;
export const handleIeltsPost = handlers.POST;

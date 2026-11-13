import { createAttemptStore } from "@/lib/exams/attempt-store";
import { createAttemptHandlers } from "@/lib/exams/attempt-api";
import {
  parseJournal,
  studyProgress,
  updateJournal,
  type StudyJournal,
} from "@/lib/learning/session";
import { MAX_JOURNAL_BYTES } from "@/lib/learning/review";
const reconcile = (s: StudyJournal) => s;
export const learningStore = createAttemptStore({
  namespace: "learning-journals",
  parse: parseJournal,
  reconcile,
  update: updateJournal,
});
const handlers = createAttemptHandlers({
  ...learningStore,
  parse: parseJournal,
  reconcile,
  duration: () => 0,
  maxBodyBytes: MAX_JOURNAL_BYTES,
  summary: ({ session, revision, updatedAt }) => ({
    id: session.id,
    startedAt: session.startedAt,
    status: session.status,
    completedLessons: Object.keys(studyProgress(session)).length,
    revision,
    updatedAt,
  }),
});
export const { GET, POST } = handlers;

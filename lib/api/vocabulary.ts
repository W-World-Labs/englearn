import { createAttemptStore } from "@/lib/exams/attempt-store";
import { createAttemptHandlers } from "@/lib/exams/attempt-api";
import {
  parseVocabulary,
  vocabularySummary,
  type VocabularySession,
} from "@/lib/vocabulary/session";
const reconcile = (s: VocabularySession) => s;
export const vocabularyStore = createAttemptStore({
  namespace: "vocabulary-attempts",
  parse: parseVocabulary,
  reconcile,
  update(previous, incoming) {
    if (
      previous.bank !== incoming.bank ||
      previous.language !== incoming.language ||
      previous.meaningLanguage !== incoming.meaningLanguage ||
      previous.mode !== incoming.mode ||
      previous.startedAt !== incoming.startedAt ||
      JSON.stringify(previous.adaptive) !== JSON.stringify(incoming.adaptive) ||
      JSON.stringify(previous.questions) !==
        JSON.stringify(
          previous.adaptive
            ? incoming.questions.slice(0, previous.questions.length)
            : incoming.questions,
        ) ||
      (previous.adaptive &&
        previous.questions
          .slice(0, -1)
          .some((q) => previous.answers[q.id] !== incoming.answers[q.id]))
    )
      return null;
    return incoming;
  },
});
export const { GET, POST } = createAttemptHandlers({
  ...vocabularyStore,
  parse: parseVocabulary,
  reconcile,
  duration: () => 0,
  summary: vocabularySummary,
});

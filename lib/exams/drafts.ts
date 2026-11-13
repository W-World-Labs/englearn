import { getPaper, type ExamFamily } from "./catalog";
import {
  parsePractice,
  practiceStorageKey,
  reconcilePractice,
} from "./session";
import { EXAM_IDS, EXAM_LABELS, isExamId } from "@/lib/ielts/exam";
import {
  parseSession,
  reconcileSession,
  storageKey as ieltsStorageKey,
} from "@/lib/ielts/session";
import { LANGUAGE_NAMES } from "@/lib/vocabulary/bank";
import {
  parseVocabulary,
  vocabularyStorageKey,
} from "@/lib/vocabulary/session";

/** A saved exam draft worth surfacing as "return to progress". */
export interface DraftBadge {
  /** Paper or set label shown next to the status text. */
  label: string;
  status: "running" | "finished";
}

/** localStorage probe kept here so the UI stays free of key details. */
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Saved TOPIK/HSK/JLPT practice draft, reconciled against the wall clock. */
export function practiceDraft(
  raw: string | null,
  now: number,
): DraftBadge | null {
  const saved = parsePractice(raw);
  if (!saved) return null;
  const current = reconcilePractice(saved, now);
  const label = getPaper(current.paperId)?.label;
  return label ? { label, status: current.status } : null;
}

export function practiceDraftFor(
  owner: string,
  family: ExamFamily,
  now: number,
): DraftBadge | null {
  return practiceDraft(readStored(practiceStorageKey(owner, family)), now);
}

/**
 * Saved IELTS session across both practice sets. A running session wins over
 * a finished one so the badge always points at live progress.
 */
export function ieltsDraft(
  raws: readonly (string | null)[],
  now: number,
): DraftBadge | null {
  let finished: DraftBadge | null = null;
  for (const raw of raws) {
    const saved = parseSession(raw);
    if (!saved) continue;
    const current = reconcileSession(saved, now);
    const label = isExamId(current.examId)
      ? EXAM_LABELS[current.examId]
      : null;
    if (!label) continue;
    if (current.status === "running") return { label, status: "running" };
    finished ??= { label, status: "finished" };
  }
  return finished;
}

export function ieltsDraftFor(owner: string, now: number): DraftBadge | null {
  return ieltsDraft(
    EXAM_IDS.map((id) => readStored(ieltsStorageKey(owner, id))),
    now,
  );
}

/** Saved vocabulary test; it has no clock so the stored status is final. */
export function vocabularyDraft(raw: string | null): DraftBadge | null {
  const saved = parseVocabulary(raw);
  if (!saved) return null;
  return {
    label: LANGUAGE_NAMES[saved.language],
    status: saved.status,
  };
}

export function vocabularyDraftFor(owner: string): DraftBadge | null {
  return vocabularyDraft(readStored(vocabularyStorageKey(owner)));
}

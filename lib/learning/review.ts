import { studyCard, STUDY_CARDS, type StudyCard } from "./cards";
import { lessonById, type LearningLanguage } from "./catalog";
import { supermemo, type SuperMemoItem } from "./supermemo";
import type { StudyJournal } from "./session";

export const DAY = 86400000;
export const MAX_REVIEW_ROUNDS = 1000;
export const MAX_REVIEW_CARDS = 20;
export const MAX_JOURNAL_BYTES = 5000000;
export type RecallRating = 0 | 1 | 2;
export type ReviewFilter = "recommended" | "weak" | "due" | "all";
export interface ReviewDraft {
  id: string;
  startedAt: number;
  cards: string[];
  ratings: RecallRating[];
}
export interface ReviewRound extends ReviewDraft {
  at: number;
}
const validId = (id: unknown): id is string =>
  typeof id === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(id);
export function parseReview(
  value: unknown,
  complete: boolean,
  now = Date.now(),
): ReviewDraft | ReviewRound | null {
  const s = value as ReviewRound;
  if (
    !s ||
    !validId(s.id) ||
    !Number.isSafeInteger(s.startedAt) ||
    s.startedAt <= 0 ||
    s.startedAt > now + 30000 ||
    !Array.isArray(s.cards) ||
    !s.cards.length ||
    s.cards.length > MAX_REVIEW_CARDS ||
    new Set(s.cards).size !== s.cards.length ||
    !Array.isArray(s.ratings) ||
    (complete
      ? s.ratings.length !== s.cards.length
      : s.ratings.length > s.cards.length) ||
    s.ratings.some((r) => ![0, 1, 2].includes(r))
  )
    return null;
  const cards = s.cards.map((id) =>
    typeof id === "string" ? studyCard(id) : undefined,
  );
  if (cards.some((c) => !c || c.language !== cards[0]?.language)) return null;
  if (
    complete &&
    (!Number.isSafeInteger(s.at) || s.at < s.startedAt || s.at > now + 30000)
  )
    return null;
  return {
    id: s.id,
    startedAt: s.startedAt,
    cards: [...s.cards],
    ratings: [...s.ratings],
    ...(complete ? { at: s.at } : {}),
  };
}
export interface CardProgress extends SuperMemoItem {
  lastAt: number;
  dueAt: number;
  rating: RecallRating;
  attempts: number;
}
export function cardProgress(
  s: StudyJournal | null,
): Record<string, CardProgress> {
  const attempts: {
    id: string;
    at: number;
    card: string;
    rating: RecallRating;
  }[] = [];
  for (const event of s?.events ?? []) {
    const lesson = lessonById(event.lessonId)!;
    lesson.questions.forEach((q, index) =>
      attempts.push({
        id: event.id,
        at: event.at,
        card: `g:${lesson.id}:${index}`,
        rating: event.answers[index] === q.answer ? 2 : 0,
      }),
    );
  }
  for (const round of s?.workbench?.rounds ?? []) {
    if (round.kind !== "practice") continue;
    round.items.forEach((id, index) => {
      const card = studyCard("x:" + id);
      if (card)
        attempts.push({
          id: round.id,
          at: round.at,
          card: card.id,
          rating: card.answer.en === card.choices[round.answers[index]] ? 2 : 0,
        });
    });
  }
  for (const round of s?.reviews ?? [])
    round.cards.forEach((id, index) =>
      attempts.push({
        id: round.id,
        at: round.at,
        card: id,
        rating: round.ratings[index],
      }),
    );
  // Stable time ordering: a recall recorded at the same millisecond follows its source lesson.
  attempts.sort((a, b) => a.at - b.at);
  const result: Record<string, CardProgress> = {};
  for (const event of attempts) {
    const previous = result[event.card],
      schedule = !previous || event.at >= previous.dueAt || event.rating === 0;
    const next = schedule
      ? supermemo(
          previous ?? { interval: 0, repetition: 0, efactor: 2.5 },
          event.rating === 0 ? 2 : event.rating === 1 ? 3 : 4,
        )
      : previous;
    const interval = Math.min(365, next.interval);
    result[event.card] = {
      ...next,
      interval,
      efactor: Math.min(3, next.efactor),
      lastAt: event.at,
      dueAt: schedule ? event.at + interval * DAY : previous.dueAt,
      rating: event.rating,
      attempts: (previous?.attempts ?? 0) + 1,
    };
  }
  return result;
}
export function reviewCards(
  s: StudyJournal | null,
  language: LearningLanguage,
  filter: ReviewFilter = "recommended",
  now = Date.now(),
): StudyCard[] {
  const progress = cardProgress(s);
  return STUDY_CARDS.filter((c) => {
    if (c.language !== language) return false;
    const p = progress[c.id];
    return (
      filter === "all" ||
      (filter === "recommended" &&
        !p &&
        !!s?.workbench?.words.includes(c.id)) ||
      (!!p &&
        (filter === "weak"
          ? p.rating === 0
          : filter === "due"
            ? p.dueAt <= now
            : p.rating === 0 || p.dueAt <= now))
    );
  }).sort((a, b) => {
    const x = progress[a.id],
      y = progress[b.id];
    return (
      Number(y?.rating === 0) - Number(x?.rating === 0) ||
      (x?.dueAt ?? Infinity) - (y?.dueAt ?? Infinity) ||
      a.id.localeCompare(b.id)
    );
  });
}
/**
 * Pool sizes for every review filter in one pass over the card bank. Shares
 * reviewCards semantics exactly, so callers can show honest counts without
 * building and sorting each filtered list.
 */
export function reviewCounts(
  s: StudyJournal | null,
  language: LearningLanguage,
  now = Date.now(),
): Record<ReviewFilter, number> {
  const progress = cardProgress(s),
    saved = new Set(s?.workbench?.words ?? []),
    counts: Record<ReviewFilter, number> = {
      recommended: 0,
      weak: 0,
      due: 0,
      all: 0,
    };
  for (const c of STUDY_CARDS) {
    if (c.language !== language) continue;
    const p = progress[c.id];
    counts.all += 1;
    if (p ? p.rating === 0 || p.dueAt <= now : saved.has(c.id))
      counts.recommended += 1;
    if (p?.rating === 0) counts.weak += 1;
    if (p && p.dueAt <= now) counts.due += 1;
  }
  return counts;
}
/**
 * Resolve a `?words=` deep link into study cards for the given course: bare
 * vocabulary-bank ids and full card ids both resolve; unknown ids and other
 * languages drop, so a stale link degrades to the normal recommended pool.
 */
export function seededReviewCards(
  param: string | undefined,
  language: LearningLanguage,
): StudyCard[] {
  const seen = new Set<string>(),
    cards: StudyCard[] = [];
  for (const raw of (param ?? "").split(",")) {
    const id = raw.trim(),
      card = id && (studyCard(id) ?? studyCard(`v:${id}`));
    if (card && card.language === language && !seen.has(card.id)) {
      seen.add(card.id);
      cards.push(card);
    }
  }
  return cards;
}
/** Round-robin across concepts after prioritization; no duplicates in a round. */
export function planReview(cards: StudyCard[], limit: number): string[] {
  const groups = new Map<string, StudyCard[]>();
  for (const card of cards) {
    const key = card.lessonId ?? `v:${card.stage}`;
    const group = groups.get(key) ?? [];
    group.push(card);
    groups.set(key, group);
  }
  const result: string[] = [];
  while (
    result.length < Math.min(MAX_REVIEW_CARDS, Math.max(1, limit)) &&
    [...groups.values()].some((g) => g.length)
  ) {
    for (const group of groups.values()) {
      const card = group.shift();
      if (card) result.push(card.id);
      if (result.length >= Math.min(MAX_REVIEW_CARDS, Math.max(1, limit)))
        break;
    }
  }
  return result;
}
export function startReview(
  s: StudyJournal,
  cards: string[],
  id: string,
  now = Date.now(),
): StudyJournal {
  if (
    (s.reviews?.length ?? 0) >= MAX_REVIEW_ROUNDS ||
    s.reviews?.some((r) => r.id === id) ||
    s.events.some((e) => e.id === id)
  )
    return s;
  const draft = parseReview(
    { id, startedAt: now, cards, ratings: [] },
    false,
    now,
  );
  return draft ? { ...s, reviewDraft: draft, reviews: s.reviews ?? [] } : s;
}
export function rateReview(
  s: StudyJournal,
  rating: RecallRating,
): StudyJournal {
  const draft = s.reviewDraft;
  if (
    !draft ||
    ![0, 1, 2].includes(rating) ||
    draft.ratings.length >= draft.cards.length
  )
    return s;
  return {
    ...s,
    reviewDraft: { ...draft, ratings: [...draft.ratings, rating] },
  };
}
export function finishReview(s: StudyJournal, now = Date.now()): StudyJournal {
  const draft = s.reviewDraft;
  if (
    !draft ||
    draft.ratings.length !== draft.cards.length ||
    (s.reviews?.length ?? 0) >= MAX_REVIEW_ROUNDS ||
    s.reviews?.some((r) => r.id === draft.id)
  )
    return s;
  return {
    ...s,
    reviewDraft: null,
    reviews: [
      ...(s.reviews ?? []),
      { ...draft, at: Math.max(now, draft.startedAt) },
    ],
  };
}
export interface ReviewImport {
  format: "lingolearn-review-results";
  version: 1;
  rounds: ReviewRound[];
  draft?: ReviewDraft | null;
}
export function parseReviewImport(raw: string): ReviewImport | null {
  if (raw.length > MAX_JOURNAL_BYTES) return null;
  try {
    const value = JSON.parse(raw);
    if (
      value?.format !== "lingolearn-review-results" ||
      value.version !== 1 ||
      !Array.isArray(value.rounds) ||
      (!value.rounds.length && !value.draft) ||
      value.rounds.length > MAX_REVIEW_ROUNDS
    )
      return null;
    const rounds = value.rounds.map((r: unknown) =>
      parseReview(r, true),
    ) as (ReviewRound | null)[];
    if (
      rounds.some((r) => !r) ||
      new Set(rounds.map((r) => r!.id)).size !== rounds.length
    )
      return null;
    const draft = value.draft == null ? null : parseReview(value.draft, false);
    if (
      value.draft != null &&
      (!draft || rounds.some((r) => r!.id === draft.id))
    )
      return null;
    return {
      format: "lingolearn-review-results",
      version: 1,
      rounds: rounds as ReviewRound[],
      draft,
    };
  } catch {
    return null;
  }
}
export function mergeReviewImport(
  s: StudyJournal,
  incoming: ReviewImport,
  restoreDraft = false,
): StudyJournal | null {
  const existing = new Map((s.reviews ?? []).map((r) => [r.id, r]));
  let draft = s.reviewDraft;
  const prefix = (old: ReviewDraft, next: ReviewDraft) =>
    old.startedAt === next.startedAt &&
    JSON.stringify(old.cards) === JSON.stringify(next.cards) &&
    JSON.stringify(old.ratings) ===
      JSON.stringify(next.ratings.slice(0, old.ratings.length));
  for (const round of incoming.rounds) {
    if (s.events.some((e) => e.id === round.id)) return null;
    if (draft?.id === round.id) {
      if (!prefix(draft, round)) return null;
      draft = null;
    }
    const saved = existing.get(round.id);
    if (saved && JSON.stringify(saved) !== JSON.stringify(round)) return null;
    existing.set(round.id, round);
  }
  if (existing.size > MAX_REVIEW_ROUNDS) return null;
  if (incoming.draft && restoreDraft) {
    if (s.events.some((e) => e.id === incoming.draft!.id)) return null;
    const completed = existing.get(incoming.draft.id);
    if (completed) {
      if (!prefix(incoming.draft, completed)) return null;
    } else {
      if (draft?.id === incoming.draft.id && !prefix(draft, incoming.draft))
        return null;
      draft = incoming.draft;
    }
  }
  if (existing.size >= MAX_REVIEW_ROUNDS && draft) return null;
  return {
    ...s,
    reviews: [...existing.values()],
    ...(draft !== undefined ? { reviewDraft: draft } : {}),
  };
}

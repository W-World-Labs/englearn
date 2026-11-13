import {
  LESSONS,
  LEARNING_LANGUAGES,
  lessonById,
  type LearningLanguage,
} from "./catalog";
import {
  conceptVariants,
  variantById,
  gradedText,
  GRADED_TEXTS,
  readingWord,
} from "./workbench-content";
import { type StudyJournal } from "./session";
import { DAY, planReview, reviewCards } from "./review";
import { studyCard } from "./cards";
import type { LearningPlan } from "./plan";
export const RETEST_DELAY = 3 * DAY;
export const ACTIVITY_SIZE = 2;
export const MAX_ACTIVITY_ROUNDS = 3000;
export type StudyPurpose = "general" | "travel" | "work" | "exam";
export interface StudyPreference {
  purpose: StudyPurpose;
  minutes: 5 | 15 | 30;
}
export type ActivityKind = "practice" | "retest" | "reading" | "listening";
export interface ActivityDraft {
  id: string;
  kind: ActivityKind;
  target: string;
  items: string[];
  answers: number[];
  startedAt: number;
}
export interface ActivityRound extends ActivityDraft {
  at: number;
}
export interface DailyTask {
  kind: "recall" | "lesson" | ActivityKind;
  target: string;
  items: string[];
  minutes: number;
  resultId?: string;
  at?: number;
  skipped?: true;
}
export interface DailySession {
  id: string;
  language: LearningLanguage;
  startedAt: number;
  minutes: 5 | 15 | 30;
  purpose: StudyPurpose;
  tasks: DailyTask[];
  completedAt?: number;
}
export interface DifficultySignal {
  id: string;
  lessonId: string;
  at: number;
  value: "easy" | "hard";
}
export interface WorkbenchState {
  version: 1;
  preferences: Partial<Record<LearningLanguage, StudyPreference>>;
  rounds: ActivityRound[];
  draft: ActivityDraft | null;
  days: DailySession[];
  difficulty: DifficultySignal[];
  words: string[];
}
export function workbench(s: StudyJournal | null): WorkbenchState {
  return (
    s?.workbench ?? {
      version: 1,
      preferences: {},
      rounds: [],
      draft: null,
      days: [],
      difficulty: [],
      words: [],
    }
  );
}
export function withWorkbench(
  s: StudyJournal,
  changes: Partial<WorkbenchState>,
): StudyJournal {
  return { ...s, workbench: { ...workbench(s), ...changes } };
}
export function preference(
  s: StudyJournal | null,
  language: LearningLanguage,
): StudyPreference {
  return (
    workbench(s).preferences[language] ?? { purpose: "general", minutes: 15 }
  );
}
export function activityQuestion(id: string) {
  return (
    variantById(id) ??
    GRADED_TEXTS.flatMap((t) => t.questions).find((q) => q.id === id)
  );
}
export function activityLanguage(a: Pick<ActivityDraft, "kind" | "target">) {
  return a.kind === "practice" || a.kind === "retest"
    ? lessonById(a.target)?.language
    : gradedText(a.target)?.language;
}
export function scoreActivity(a: ActivityRound) {
  return a.items.reduce(
    (n, id, i) => n + Number(activityQuestion(id)?.answer === a.answers[i]),
    0,
  );
}
export function conceptExposure(
  s: StudyJournal | null,
  lessonId: string,
  before = Date.now(),
) {
  return Math.max(
    0,
    ...(s?.events ?? [])
      .filter((e) => e.lessonId === lessonId && e.at <= before)
      .map((e) => e.at),
    ...workbench(s)
      .rounds.filter(
        (r) => r.kind === "practice" && r.target === lessonId && r.at <= before,
      )
      .map((r) => r.at),
  );
}
// Journal v1 accepts any unseen reserved subset at least three days after practice.
// Keep this historical rule when replaying records made by earlier clients.
function eligibleRetest(
  s: StudyJournal | null,
  lessonId: string,
  now = Date.now(),
) {
  const at = conceptExposure(s, lessonId, now);
  if (!at || now - at < RETEST_DELAY) return [];
  const used = new Set(
    workbench(s)
      .rounds.filter((r) => r.startedAt <= now)
      .flatMap((r) => r.items),
  );
  return conceptVariants(lessonId, "retest")
    .filter((q) => !used.has(q.id))
    .map((q) => q.id);
}
function retestAt(s: StudyJournal | null, target: string, now: number) {
  const exposure = conceptExposure(s, target, now);
  if (!exposure) return null;
  return (
    Math.max(
      exposure,
      ...workbench(s)
        .rounds.filter(
          (r) => r.kind === "retest" && r.target === target && r.at <= now,
        )
        .map((r) => r.at),
    ) + RETEST_DELAY
  );
}
export function freshRetest(
  s: StudyJournal | null,
  target: string,
  now = Date.now(),
) {
  const due = retestAt(s, target, now);
  return due && due <= now ? eligibleRetest(s, target, now) : [];
}
/** Short rounds prefer unseen questions, then latest mistakes, then oldest attempts.
 * Reading and listening share question identity so switching modes does not create fresh evidence. */
export function activityItems(
  s: StudyJournal | null,
  kind: ActivityKind,
  target: string,
  now = Date.now(),
) {
  const pool =
    kind === "retest"
      ? freshRetest(s, target, now)
      : kind === "practice"
        ? conceptVariants(target, "practice").map((q) => q.id)
        : (gradedText(target)?.questions.map((q) => q.id) ?? []);
  const latest = new Map<string, { at: number; correct: boolean }>();
  for (const r of workbench(s).rounds) {
    if (r.target !== target || r.at > now) continue;
    r.items.forEach((id, i) => {
      if (r.at >= (latest.get(id)?.at ?? 0))
        latest.set(id, {
          at: r.at,
          correct: activityQuestion(id)?.answer === r.answers[i],
        });
    });
  }
  return pool
    .sort((a, b) => {
      const x = latest.get(a),
        y = latest.get(b);
      return (
        Number(!!x) - Number(!!y) ||
        Number(x?.correct ?? false) - Number(y?.correct ?? false) ||
        (x?.at ?? 0) - (y?.at ?? 0)
      );
    })
    .slice(0, ACTIVITY_SIZE);
}
export function startActivity(
  s: StudyJournal,
  kind: ActivityKind,
  target: string,
  id: string,
  now = Date.now(),
) {
  const w = workbench(s);
  if (
    w.draft ||
    w.rounds.length >= MAX_ACTIVITY_ROUNDS ||
    w.rounds.some((r) => r.id === id)
  )
    return s;
  // A saved queue owns its item snapshot, even if another activity changed which
  // questions would be selected today. Existing drafts already own their snapshot.
  const language = activityLanguage({ kind, target });
  const day = language && activeDaily(s, language);
  const task = day ? day.tasks[dailyIndex(day)] : undefined;
  const items =
    task?.kind === kind && task.target === target
      ? [...task.items]
      : activityItems(s, kind, target, now);
  if (!items.length) return s;
  if (
    kind === "retest" &&
    items.some((item) => !freshRetest(s, target, now).includes(item))
  )
    return s;
  return withWorkbench(s, {
    draft: { id, kind, target, items, answers: [], startedAt: now },
  });
}
export function answerActivity(s: StudyJournal, answer: number) {
  const draft = workbench(s).draft,
    q = draft && activityQuestion(draft.items[draft.answers.length]);
  if (
    !draft ||
    !q ||
    !Number.isInteger(answer) ||
    answer < 0 ||
    answer >= q.choices.length
  )
    return s;
  return withWorkbench(s, {
    draft: { ...draft, answers: [...draft.answers, answer] },
  });
}
export function finishActivity(s: StudyJournal, now = Date.now()) {
  const w = workbench(s),
    d = w.draft;
  if (
    !d ||
    d.answers.length !== d.items.length ||
    w.rounds.length >= MAX_ACTIVITY_ROUNDS ||
    w.rounds.some((r) => r.id === d.id)
  )
    return s;
  return withWorkbench(s, {
    draft: null,
    rounds: [...w.rounds, { ...d, at: Math.max(now, d.startedAt) }],
  });
}
export interface ConceptProfile {
  id: string;
  status: "unknown" | "learning" | "weak" | "retained";
  correct: number;
  total: number;
  firstCorrect: number;
  firstTotal: number;
  repeatCorrect: number;
  repeatTotal: number;
  delayedCorrect: number;
  delayedTotal: number;
  lastAt: number;
  dueAt: number | null;
  dates: number;
  signal: "easy" | "hard" | null;
}
/** First/repeat identity is calculated against all earlier records, before applying a report window. */
export function conceptAttempts(
  s: StudyJournal | null,
  lessonId: string,
  now = Date.now(),
) {
  const l = lessonById(lessonId)!;
  const w = workbench(s);
  const attempts = [
    ...(s?.events ?? [])
      .filter((e) => e.lessonId === l.id)
      .flatMap((e) =>
        l.questions.map((q, i) => ({
          id: `g:${l.id}:${i}`,
          at: e.at,
          correct: e.answers[i] === q.answer,
          delayed: false,
        })),
      ),
    ...w.rounds
      .filter(
        (r) => r.target === l.id && ["practice", "retest"].includes(r.kind),
      )
      .flatMap((r) =>
        r.items.map((id, i) => ({
          id,
          at: r.at,
          correct: r.answers[i] === activityQuestion(id)!.answer,
          delayed: r.kind === "retest",
        })),
      ),
  ]
    .filter((a) => a.at <= now)
    .sort((a, b) => a.at - b.at);
  const seen = new Set<string>();
  return attempts.map((a) => {
    const first = !seen.has(a.id);
    seen.add(a.id);
    return { ...a, first };
  });
}
export function conceptProfiles(
  s: StudyJournal | null,
  language: LearningLanguage,
  now = Date.now(),
): ConceptProfile[] {
  const w = workbench(s);
  return LESSONS.filter((l) => l.language === language).map((l) => {
    const attempts = conceptAttempts(s, l.id, now);
    const p: ConceptProfile = {
      id: l.id,
      status: "unknown",
      correct: 0,
      total: 0,
      firstCorrect: 0,
      firstTotal: 0,
      repeatCorrect: 0,
      repeatTotal: 0,
      delayedCorrect: 0,
      delayedTotal: 0,
      lastAt: attempts.at(-1)?.at ?? 0,
      dueAt: null,
      dates: 0,
      signal:
        w.difficulty
          .filter(
            (d) => d.lessonId === l.id && d.at <= now && d.at >= now - 90 * DAY,
          )
          .at(-1)?.value ?? null,
    };
    const dates = new Set<number>();
    for (const a of attempts) {
      const first = a.first;
      if (a.at < now - 90 * DAY) continue;
      dates.add(Math.floor(a.at / DAY));
      p.correct += Number(a.correct);
      p.total++;
      if (first) {
        p.firstTotal++;
        p.firstCorrect += Number(a.correct);
      } else {
        p.repeatTotal++;
        p.repeatCorrect += Number(a.correct);
      }
      if (a.delayed && first) {
        p.delayedTotal++;
        p.delayedCorrect += Number(a.correct);
      }
    }
    p.dates = dates.size;
    const due = retestAt(s, l.id, now);
    const used = new Set(
      w.rounds.filter((r) => r.at <= now).flatMap((r) => r.items),
    );
    if (due && conceptVariants(l.id, "retest").some((q) => !used.has(q.id)))
      p.dueAt = due;
    p.status = !p.total
      ? "unknown"
      : p.correct / p.total < 0.6
        ? "weak"
        : p.delayedTotal >= 2 &&
            p.delayedCorrect === p.delayedTotal &&
            p.firstTotal >= 4 &&
            p.dates >= 2
          ? "retained"
          : "learning";
    return p;
  });
}
export function activeDaily(
  s: StudyJournal | null,
  language: LearningLanguage,
) {
  return (
    workbench(s)
      .days.filter((d) => d.language === language && !d.completedAt)
      .at(-1) ?? null
  );
}
export function dailyIndex(d: DailySession) {
  return d.tasks.findIndex((t) => !t.at);
}
export function lastStudyAt(
  s: StudyJournal | null,
  language: LearningLanguage,
) {
  return Math.max(
    0,
    ...(s?.events ?? [])
      .filter((e) => lessonById(e.lessonId)?.language === language)
      .map((e) => e.at),
    ...workbench(s)
      .rounds.filter((r) => activityLanguage(r) === language)
      .map((r) => r.at),
    ...(s?.reviews ?? [])
      .filter((r) => studyCard(r.cards[0])?.language === language)
      .map((r) => r.at),
  );
}
export function createDaily(
  s: StudyJournal,
  plan: LearningPlan,
  minutes: 5 | 15 | 30,
  purpose: StudyPurpose,
  id: string,
  now = Date.now(),
) {
  const w = workbench(s),
    language = plan.language;
  if (
    activeDaily(s, language) ||
    w.days.length >= 500 ||
    w.days.some((d) => d.id === id)
  )
    return s;
  const tasks: DailyTask[] = [];
  let remaining = minutes;
  const add = (
    kind: DailyTask["kind"],
    target: string,
    items: string[],
    cost: number,
  ) => {
    if (
      remaining < cost ||
      tasks.some((t) => t.kind === kind && t.target === target)
    )
      return false;
    tasks.push({ kind, target, items, minutes: cost });
    remaining -= cost;
    return true;
  };
  const cards = planReview(
    reviewCards(s, language, "recommended", now),
    minutes === 5 ? 3 : minutes === 15 ? 6 : 12,
  );
  if (cards.length)
    add("recall", language, cards, Math.max(1, Math.ceil(cards.length / 3)));
  const profiles = conceptProfiles(s, language, now);
  for (const p of profiles
    .filter((p) => p.dueAt && p.dueAt <= now)
    .sort((a, b) => a.dueAt! - b.dueAt!)) {
    const items = activityItems(s, "retest", p.id, now);
    if (items.length) add("retest", p.id, items, 2);
    if (remaining <= 3) break;
  }
  // Preferences change the next queue, never the underlying score. Hard concepts get an explanation;
  // easy concepts are deprioritized so other concepts can be tried at the evidence-backed stage.
  const candidates = [
    ...new Set([
      ...profiles.filter((p) => p.signal === "hard").map((p) => p.id),
      ...plan.lessons.map((p) => p.id),
      ...LESSONS.filter(
        (l) => l.language === language && l.stage === plan.stage,
      ).map((l) => l.id),
    ]),
  ];
  const rank = (id: string) => {
    const p = profiles.find((p) => p.id === id)!;
    return p.signal === "hard" ? -1 : p.signal === "easy" ? 1 : 0;
  };
  const suggested = candidates.sort((a, b) => rank(a) - rank(b));
  const texts = GRADED_TEXTS.filter(
    (t) => t.language === language && t.stage === plan.stage,
  ).sort(
    (a, b) =>
      Number(w.rounds.some((r) => r.target === a.id)) -
      Number(w.rounds.some((r) => r.target === b.id)),
  );
  const addText = () => {
    const t = texts[0];
    if (t)
      add(
        purpose === "travel" ? "listening" : "reading",
        t.id,
        activityItems(
          s,
          purpose === "travel" ? "listening" : "reading",
          t.id,
          now,
        ),
        4,
      );
  };
  // Conversation and work/study prioritize comprehension. Exam preparation reserves time for concepts.
  if (purpose === "travel" || purpose === "work") addText();
  let taught = 0;
  for (const target of suggested) {
    if (
      remaining < 3 ||
      taught >= (purpose === "exam" ? 4 : minutes === 5 ? 1 : 2)
    )
      break;
    add("lesson", target, [], 1);
    add("practice", target, activityItems(s, "practice", target, now), 2);
    taught++;
  }
  addText();
  if (!tasks.length) {
    const l = LESSONS.find(
      (l) => l.language === language && l.stage === plan.stage,
    )!;
    add("lesson", l.id, [], 1);
    add("practice", l.id, activityItems(s, "practice", l.id, now), 2);
  }
  return withWorkbench(s, {
    preferences: { ...w.preferences, [language]: { minutes, purpose } },
    days: [
      ...w.days,
      { id, language, startedAt: now, minutes, purpose, tasks },
    ],
  });
}
export function completeDailyTask(
  s: StudyJournal,
  language: LearningLanguage,
  resultId?: string,
  now = Date.now(),
) {
  const d = activeDaily(s, language);
  if (!d) return s;
  const i = dailyIndex(d);
  if (i < 0) return s;
  const task = d.tasks[i];
  if (task.kind === "recall") {
    const r = s.reviews?.find((r) => r.id === resultId);
    if (
      !r ||
      r.startedAt < d.startedAt ||
      JSON.stringify(r.cards) !== JSON.stringify(task.items)
    )
      return s;
  } else if (task.kind !== "lesson") {
    const r = workbench(s).rounds.find((r) => r.id === resultId);
    if (
      !r ||
      r.startedAt < d.startedAt ||
      r.kind !== task.kind ||
      r.target !== task.target ||
      JSON.stringify(r.items) !== JSON.stringify(task.items)
    )
      return s;
  }
  const tasks = d.tasks.map((t, n) =>
    n === i
      ? {
          ...t,
          at: Math.max(now, d.startedAt),
          ...(resultId ? { resultId } : {}),
        }
      : t,
  );
  return withWorkbench(s, {
    days: workbench(s).days.map((old) =>
      old.id === d.id
        ? {
            ...d,
            tasks,
            ...(tasks.every((t) => t.at)
              ? { completedAt: Math.max(now, d.startedAt) }
              : {}),
          }
        : old,
    ),
  });
}
export function weeklyReport(
  s: StudyJournal | null,
  language: LearningLanguage,
  now = Date.now(),
) {
  const w = workbench(s),
    start = now - 7 * DAY;
  const current = conceptProfiles(s, language, now),
    previous = conceptProfiles(s, language, start);
  const rounds = w.rounds.filter(
    (r) => activityLanguage(r) === language && r.at >= start && r.at <= now,
  );
  const delayed = rounds.filter((r) => r.kind === "retest");
  const days = w.days.filter(
    (d) =>
      d.language === language && d.startedAt >= start && d.startedAt <= now,
  );
  const answers = LESSONS.filter((l) => l.language === language)
    .flatMap((l) => conceptAttempts(s, l.id, now))
    .filter((a) => a.at >= start);
  const first = answers.filter((a) => a.first),
    repeated = answers.filter((a) => !a.first);
  return {
    started: days.length,
    completed: w.days.filter(
      (d) =>
        d.language === language &&
        d.completedAt &&
        d.completedAt >= start &&
        d.completedAt <= now &&
        d.tasks.every((t) => !t.skipped),
    ).length,
    skipped: w.days
      .filter((d) => d.language === language)
      .flatMap((d) => d.tasks)
      .filter((t) => t.skipped && t.at! >= start && t.at! <= now).length,
    firstCorrect: first.filter((a) => a.correct).length,
    firstTotal: first.length,
    repeatCorrect: repeated.filter((a) => a.correct).length,
    repeatTotal: repeated.length,
    delayedCorrect: delayed.reduce((n, r) => n + scoreActivity(r), 0),
    delayedTotal: delayed.reduce((n, r) => n + r.items.length, 0),
    improved: current
      .filter(
        (p) =>
          previous.find((x) => x.id === p.id)?.status === "weak" &&
          ["learning", "retained"].includes(p.status),
      )
      .map((p) => p.id),
    needsWork: current.filter((p) => p.status === "weak").map((p) => p.id),
    difficulty: w.difficulty.filter(
      (d) =>
        d.at >= start &&
        d.at <= now &&
        lessonById(d.lessonId)?.language === language,
    ).length,
  };
}
const validId = (x: unknown): x is string =>
  typeof x === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(x);
const validTime = (x: unknown, now: number): x is number =>
  Number.isSafeInteger(x) && Number(x) > 0 && Number(x) <= now + 30000;
const purposes = ["general", "travel", "work", "exam"];
function parseActivity(
  value: unknown,
  complete: boolean,
  now: number,
): ActivityRound | ActivityDraft | null {
  const a = value as ActivityRound;
  if (
    !a ||
    !validId(a.id) ||
    !["practice", "retest", "reading", "listening"].includes(a.kind) ||
    !activityLanguage(a) ||
    !validTime(a.startedAt, now) ||
    !Array.isArray(a.items) ||
    !a.items.length ||
    a.items.length > 20 ||
    new Set(a.items).size !== a.items.length ||
    !Array.isArray(a.answers) ||
    a.answers.length > a.items.length ||
    (complete && a.answers.length !== a.items.length)
  )
    return null;
  const eligible =
    a.kind === "practice" || a.kind === "retest"
      ? conceptVariants(
          a.target,
          a.kind === "practice" ? "practice" : "retest",
        ).map((q) => q.id)
      : gradedText(a.target)!.questions.map((q) => q.id);
  if (
    a.items.some((id) => typeof id !== "string" || !eligible.includes(id)) ||
    a.answers.some(
      (n, i) =>
        !Number.isInteger(n) ||
        n < 0 ||
        n >= activityQuestion(a.items[i])!.choices.length,
    )
  )
    return null;
  if (complete && (!validTime(a.at, now) || a.at < a.startedAt)) return null;
  return {
    id: a.id,
    kind: a.kind,
    target: a.target,
    items: [...a.items],
    answers: [...a.answers],
    startedAt: a.startedAt,
    ...(complete ? { at: a.at } : {}),
  };
}
/** Parse and normalize the optional journal extension. History owns evidence; incoming scores are never accepted. */
export function parseWorkbench(
  value: unknown,
  base: StudyJournal,
  now = Date.now(),
): WorkbenchState | null {
  try {
    const w = value as WorkbenchState;
    if (
      !w ||
      w.version !== 1 ||
      !w.preferences ||
      typeof w.preferences !== "object" ||
      Array.isArray(w.preferences) ||
      !Array.isArray(w.rounds) ||
      w.rounds.length > MAX_ACTIVITY_ROUNDS ||
      !Array.isArray(w.days) ||
      w.days.length > 500 ||
      !Array.isArray(w.difficulty) ||
      w.difficulty.length > 2000 ||
      !Array.isArray(w.words) ||
      w.words.length > 500
    )
      return null;
    const prefs: WorkbenchState["preferences"] = {};
    for (const language of LEARNING_LANGUAGES) {
      const p = w.preferences[language];
      if (p === undefined) continue;
      if (
        !p ||
        !purposes.includes(p.purpose) ||
        ![5, 15, 30].includes(p.minutes)
      )
        return null;
      prefs[language] = { purpose: p.purpose, minutes: p.minutes };
    }
    const result: WorkbenchState = {
      version: 1,
      preferences: prefs,
      rounds: [],
      draft: null,
      days: [],
      difficulty: [],
      words: [],
    };
    const ids = new Set([
      ...(base.events ?? []).map((e) => e.id),
      ...(base.reviews ?? []).map((r) => r.id),
      ...(base.reviewDraft ? [base.reviewDraft.id] : []),
    ]);
    let last = 0;
    for (const value of w.rounds) {
      const a = parseActivity(value, true, now) as ActivityRound | null;
      if (!a || ids.has(a.id) || a.at < last) return null;
      if (a.kind === "retest") {
        const available = eligibleRetest(
          { ...base, workbench: result },
          a.target,
          a.startedAt,
        );
        if (a.items.some((id) => !available.includes(id))) return null;
      }
      ids.add(a.id);
      last = a.at;
      result.rounds.push(a);
    }
    if (w.draft !== null) {
      const a = parseActivity(w.draft, false, now) as ActivityDraft | null;
      if (!a || ids.has(a.id) || a.startedAt < last) return null;
      if (
        a.kind === "retest" &&
        a.items.some(
          (id) =>
            !eligibleRetest(
              { ...base, workbench: result },
              a.target,
              a.startedAt,
            ).includes(id),
        )
      )
        return null;
      result.draft = a;
      ids.add(a.id);
    }
    for (const d of w.difficulty) {
      if (
        !d ||
        !validId(d.id) ||
        ids.has(d.id) ||
        !lessonById(d.lessonId) ||
        !validTime(d.at, now) ||
        !["easy", "hard"].includes(d.value)
      )
        return null;
      ids.add(d.id);
      result.difficulty.push({
        id: d.id,
        lessonId: d.lessonId,
        at: d.at,
        value: d.value,
      });
    }
    if (
      new Set(w.words).size !== w.words.length ||
      w.words.some((id) => typeof id !== "string" || !readingWord(id))
    )
      return null;
    result.words = [...w.words];
    const active = new Set<LearningLanguage>();
    for (const d of w.days) {
      if (
        !d ||
        !validId(d.id) ||
        ids.has(d.id) ||
        !LEARNING_LANGUAGES.includes(d.language) ||
        !validTime(d.startedAt, now) ||
        ![5, 15, 30].includes(d.minutes) ||
        !purposes.includes(d.purpose) ||
        !Array.isArray(d.tasks) ||
        !d.tasks.length ||
        d.tasks.length > 30
      )
        return null;
      ids.add(d.id);
      let incomplete = false,
        lastAt = d.startedAt,
        cost = 0;
      const tasks: DailyTask[] = [];
      for (const t of d.tasks) {
        if (
          !t ||
          ![
            "recall",
            "lesson",
            "practice",
            "retest",
            "reading",
            "listening",
          ].includes(t.kind) ||
          !Array.isArray(t.items) ||
          t.items.length > 20 ||
          new Set(t.items).size !== t.items.length ||
          !Number.isInteger(t.minutes) ||
          t.minutes < 1 ||
          t.minutes > 10
        )
          return null;
        cost += t.minutes;
        if (t.kind === "recall") {
          if (
            t.target !== d.language ||
            !t.items.length ||
            t.items.some((id) => studyCard(id)?.language !== d.language)
          )
            return null;
        } else if (t.kind === "lesson") {
          if (lessonById(t.target)?.language !== d.language || t.items.length)
            return null;
        } else {
          if (
            activityLanguage({
              kind: t.kind as ActivityKind,
              target: t.target,
            }) !== d.language ||
            !parseActivity(
              {
                id: "task",
                kind: t.kind,
                target: t.target,
                items: t.items,
                answers: [],
                startedAt: d.startedAt,
              },
              false,
              now,
            )
          )
            return null;
        }
        if (t.at !== undefined) {
          if (incomplete || !validTime(t.at, now) || t.at < lastAt) return null;
          lastAt = t.at;
          if (t.skipped) {
            if (t.skipped !== true || t.resultId !== undefined) return null;
          } else if (t.kind !== "lesson") {
            const r =
              t.kind === "recall"
                ? base.reviews?.find((r) => r.id === t.resultId)
                : result.rounds.find(
                    (r) =>
                      r.id === t.resultId &&
                      r.kind === t.kind &&
                      r.target === t.target,
                  );
            if (
              !r ||
              r.startedAt < d.startedAt ||
              r.at > t.at ||
              JSON.stringify("cards" in r ? r.cards : r.items) !==
                JSON.stringify(t.items)
            )
              return null;
          } else if (t.resultId !== undefined) return null;
        } else {
          incomplete = true;
          if (t.resultId !== undefined || t.skipped !== undefined) return null;
        }
        tasks.push({
          kind: t.kind,
          target: t.target,
          items: [...t.items],
          minutes: t.minutes,
          ...(t.at !== undefined
            ? {
                at: t.at,
                ...(t.resultId ? { resultId: t.resultId } : {}),
                ...(t.skipped ? { skipped: true as const } : {}),
              }
            : {}),
        });
      }
      if (cost > d.minutes) return null;
      if (incomplete) {
        if (d.completedAt !== undefined || active.has(d.language)) return null;
        active.add(d.language);
      } else if (!validTime(d.completedAt, now) || d.completedAt < lastAt)
        return null;
      result.days.push({
        id: d.id,
        language: d.language,
        startedAt: d.startedAt,
        minutes: d.minutes,
        purpose: d.purpose,
        tasks,
        ...(d.completedAt !== undefined ? { completedAt: d.completedAt } : {}),
      });
    }
    return result;
  } catch {
    return null;
  }
}
const immutablePrefix = (old: unknown[], next: unknown[]) =>
  JSON.stringify(old) === JSON.stringify(next.slice(0, old.length));
export function updateWorkbench(
  old: WorkbenchState | undefined,
  next: WorkbenchState | undefined,
) {
  if (!old) return true;
  if (!next) return false;
  if (
    !immutablePrefix(old.rounds, next.rounds) ||
    !immutablePrefix(old.difficulty, next.difficulty) ||
    next.days.length < old.days.length
  )
    return false;
  for (let i = 0; i < old.days.length; i++) {
    const a = old.days[i],
      b = next.days[i];
    if (
      a.id !== b.id ||
      a.language !== b.language ||
      a.startedAt !== b.startedAt ||
      a.minutes !== b.minutes ||
      a.purpose !== b.purpose ||
      a.tasks.length !== b.tasks.length ||
      (a.completedAt && JSON.stringify(a) !== JSON.stringify(b))
    )
      return false;
    if (
      a.tasks.some((t, j) =>
        t.at
          ? JSON.stringify(t) !== JSON.stringify(b.tasks[j])
          : JSON.stringify({
              kind: t.kind,
              target: t.target,
              items: t.items,
              minutes: t.minutes,
            }) !==
            JSON.stringify({
              kind: b.tasks[j].kind,
              target: b.tasks[j].target,
              items: b.tasks[j].items,
              minutes: b.tasks[j].minutes,
            }),
      )
    )
      return false;
  }
  const a = old.draft,
    b =
      next.draft?.id === a?.id
        ? next.draft
        : next.rounds.find((r) => r.id === a?.id);
  if (
    a &&
    b?.id === a.id &&
    (a.kind !== b.kind ||
      a.target !== b.target ||
      a.startedAt !== b.startedAt ||
      JSON.stringify(a.items) !== JSON.stringify(b.items) ||
      !immutablePrefix(a.answers, b.answers))
  )
    return false;
  return true;
}

export function skipDailyTask(
  s: StudyJournal,
  language: LearningLanguage,
  now = Date.now(),
) {
  const d = activeDaily(s, language);
  if (!d) return s;
  const i = dailyIndex(d);
  if (i < 0) return s;
  const tasks = d.tasks.map((t, n) =>
    n === i
      ? { ...t, at: Math.max(now, d.startedAt), skipped: true as const }
      : t,
  );
  return withWorkbench(s, {
    days: workbench(s).days.map((old) =>
      old.id === d.id
        ? {
            ...d,
            tasks,
            ...(tasks.every((t) => t.at)
              ? { completedAt: Math.max(now, d.startedAt) }
              : {}),
          }
        : old,
    ),
  });
}

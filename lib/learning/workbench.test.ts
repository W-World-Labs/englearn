import { expect, it } from "vitest";
import { createJournal, parseJournal, updateJournal } from "./session";
import { arrangeLearning, learningEvidence } from "./plan";
import { LESSONS, LEARNING_LANGUAGES } from "./catalog";
import { GRADED_TEXTS, VARIANTS } from "./workbench-content";
import { DAY } from "./review";
import {
  activityItems,
  activityQuestion,
  answerActivity,
  completeDailyTask,
  conceptProfiles,
  createDaily,
  finishActivity,
  freshRetest,
  parseWorkbench,
  skipDailyTask,
  startActivity,
  weeklyReport,
  withWorkbench,
  workbench,
} from "./workbench";
const now = Date.now();
function round(
  s: ReturnType<typeof createJournal>,
  kind: "practice" | "retest" | "reading" | "listening",
  target: string,
  id: string,
  at: number,
  correct = true,
) {
  let next = startActivity(s, kind, target, id, at);
  while (
    workbench(next).draft &&
    workbench(next).draft!.answers.length < workbench(next).draft!.items.length
  ) {
    const d = workbench(next).draft!,
      q = activityQuestion(d.items[d.answers.length])!;
    next = answerActivity(
      next,
      correct ? q.answer : (q.answer + 1) % q.choices.length,
    );
  }
  return finishActivity(next, at + 100);
}
it("provides separate original practice/retest pools for every concept and reading stages for all five languages", () => {
  expect(VARIANTS).toHaveLength(1440);
  expect(new Set(VARIANTS.map((q) => q.id)).size).toBe(1440);
  for (const l of LESSONS) {
    for (const purpose of ["practice", "retest"])
      expect(
        VARIANTS.filter((q) => q.lessonId === l.id && q.purpose === purpose),
      ).toHaveLength(6);
    for (const q of VARIANTS.filter((q) => q.lessonId === l.id)) {
      expect(new Set(q.choices).size).toBe(q.choices.length);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.choices.length);
      expect(l.questions.map((q) => q.prompt)).not.toContain(q.prompt);
    }
  }
  for (const language of LEARNING_LANGUAGES)
    expect(
      new Set(
        GRADED_TEXTS.filter((t) => t.language === language).map((t) => t.stage),
      ).size,
    ).toBe(3);
  expect(
    GRADED_TEXTS.every((t) =>
      t.sentences.every(
        (s) => s.explanation.en && !s.explanation.en.includes("appears below"),
      ),
    ),
  ).toBe(true);
});
it("reserves unseen retests until three days after practice and never reuses them as fresh evidence", () => {
  let s = createJournal(now - 10 * DAY);
  expect(freshRetest(s, "en-be", now)).toEqual([]);
  s = round(s, "practice", "en-be", "first", now - 5 * DAY);
  expect(freshRetest(s, "en-be", now - 4 * DAY)).toEqual([]);
  expect(freshRetest(s, "en-be", now)).toHaveLength(6);
  expect(
    startActivity(s, "retest", "en-be", "too-early", now - 4 * DAY),
  ).toEqual(s);
  s = round(s, "retest", "en-be", "delayed", now - 1000);
  expect(freshRetest(s, "en-be", now)).toEqual([]);
  expect(parseJournal(JSON.stringify(s))).toEqual(s);
  const p = conceptProfiles(s, "en", now).find((p) => p.id === "en-be")!;
  expect(p.status).toBe("retained");
  expect(p.firstTotal).toBe(4);
  expect(p.delayedTotal).toBe(2);
  s = round(s, "practice", "en-be", "repeat", now - 500);
  const r = conceptProfiles(s, "en", now).find((p) => p.id === "en-be")!;
  expect(r.firstTotal).toBe(6);
  expect(r.repeatTotal).toBe(0);
  expect(
    conceptProfiles(s, "ja", now).every((p) => p.status === "unknown"),
  ).toBe(true);
});
it("builds bounded resumable plans, records skips honestly, and validates completion against saved work", () => {
  for (const language of LEARNING_LANGUAGES)
    for (const minutes of [5, 15, 30] as const) {
      let s = createJournal(now - 10000);
      const p = arrangeLearning(
        learningEvidence(language, [], [], now),
        s,
        now,
      );
      s = createDaily(s, p, minutes, "general", "daily", now - 1000);
      const d = workbench(s).days[0];
      expect(d.tasks.reduce((n, t) => n + t.minutes, 0)).toBeLessThanOrEqual(
        minutes,
      );
      expect(d.tasks.length).toBeGreaterThan(0);
      expect(createDaily(s, p, minutes, "general", "duplicate", now)).toEqual(
        s,
      );
      const first = d.tasks[0];
      expect(first.kind).toBe("lesson");
      s = completeDailyTask(s, language, undefined, now - 900);
      expect(completeDailyTask(s, language, "made-up-round", now)).toEqual(s);
      s = round(s, "practice", first.target, "practice", now - 800);
      s = completeDailyTask(s, language, "practice", now - 500);
      expect(parseJournal(JSON.stringify(s))).toEqual(s);
      while (workbench(s).days[0].tasks.some((t) => !t.at))
        s = skipDailyTask(s, language, now - 100);
      expect(workbench(s).days[0].completedAt).toBeTruthy();
      expect(parseJournal(JSON.stringify(s))).toEqual(s);
    }
});
it("protects history, checked draft prefixes, future dates and delayed eligibility on the server", () => {
  let s = round(
    createJournal(now - 8 * DAY),
    "practice",
    "en-be",
    "first",
    now - 5 * DAY,
  );
  const tampered = structuredClone(s);
  tampered.workbench!.rounds[0].answers[0] = 99;
  expect(parseJournal(JSON.stringify(tampered))).toBeNull();
  const forged = structuredClone(s);
  forged.workbench!.rounds[0].kind = "retest";
  forged.workbench!.rounds[0].items = ["en-be-v3", "en-be-v4"];
  expect(parseJournal(JSON.stringify(forged))).toBeNull();
  expect(updateJournal(s, createJournal(s.startedAt))).toBeNull();
  const amended = structuredClone(s);
  amended.workbench!.rounds[0].answers.reverse();
  expect(updateJournal(s, amended)).toBeNull();
  s = startActivity(s, "practice", "en-be", "draft", now - 1000);
  s = answerActivity(s, 0);
  const rewritten = structuredClone(s);
  rewritten.workbench!.draft!.answers[0] = 1;
  expect(updateJournal(s, rewritten)).toBeNull();
  const future = structuredClone(workbench(s));
  future.draft!.startedAt = now + 60000;
  expect(parseWorkbench(future, s, now)).toBeNull();
});
it("difficulty signals and saved reading words guide practice without manufacturing a mastery score", () => {
  let s = createJournal(now - 10000);
  s = withWorkbench(s, {
    difficulty: [
      { id: "signal", lessonId: "ja-copula", at: now - 1000, value: "hard" },
    ],
    words: [GRADED_TEXTS.find((t) => t.language === "ja")!.words[0].id],
  });
  expect(parseJournal(JSON.stringify(s))).toEqual(s);
  expect(conceptProfiles(s, "ja", now)[0].status).toBe("unknown");
  expect(conceptProfiles(s, "ja", now)[0].signal).toBe("hard");
  const p = arrangeLearning(learningEvidence("ja", [], [], now), s, now);
  s = createDaily(s, p, 5, "general", "daily", now);
  expect(workbench(s).days[0].tasks[0].kind).toBe("recall");
  expect(workbench(s).days[0].tasks[0].items).toContain(workbench(s).words[0]);
  expect(weeklyReport(s, "ja", now).delayedTotal).toBe(0);
  expect(weeklyReport(s, "en", now).difficulty).toBe(0);
});
it("uses new evidence for stage changes, requiring enough fresh items across concepts and dates", () => {
  let s = createJournal(now - 20 * DAY);
  const lessons = LESSONS.filter(
    (l) => l.language === "en" && l.stage === "foundation",
  ).slice(0, 3);
  lessons.forEach((l, i) => {
    s = round(s, "practice", l.id, "p" + i, now - (10 - i) * DAY);
  });
  expect(
    arrangeLearning(learningEvidence("en", [], [], now), s, now).stage,
  ).toBe("foundation");
  lessons.forEach((l, i) => {
    s = round(s, "retest", l.id, "r" + i, now - (3 - i) * DAY);
  });
  expect(
    arrangeLearning(learningEvidence("en", [], [], now), s, now).stage,
  ).toBe("intermediate");
  expect(
    arrangeLearning(
      {
        ...learningEvidence("en", [], [], now),
        grammar: { stage: "foundation", at: now - 1000, items: 8 },
      },
      s,
      now,
    ).stage,
  ).toBe("foundation");
  expect(
    arrangeLearning(learningEvidence("ja", [], [], now), s, now).stage,
  ).toBe("foundation");
});
it("counts first answers before applying the weekly window and does not count skipped plans as completed", () => {
  let s = createJournal(now - 100 * DAY);
  s = round(s, "practice", "en-be", "old", now - 95 * DAY);
  s = round(s, "practice", "en-be", "old-2", now - 94 * DAY);
  s = round(s, "practice", "en-be", "old-3", now - 93 * DAY);
  s = round(s, "practice", "en-be", "repeat-now", now - DAY);
  let r = weeklyReport(s, "en", now);
  expect(r.firstTotal).toBe(0);
  expect(r.firstCorrect).toBe(0);
  expect(r.repeatTotal).toBe(2);
  s = createDaily(
    s,
    arrangeLearning(learningEvidence("en", [], [], now), s, now),
    5,
    "general",
    "skip-day",
    now - 1000,
  );
  while (
    workbench(s)
      .days.at(-1)!
      .tasks.some((t) => !t.at)
  )
    s = skipDailyTask(s, "en", now);
  r = weeklyReport(s, "en", now);
  expect(r.completed).toBe(0);
  expect(r.skipped).toBeGreaterThan(0);
});
it("changes queue priorities for learner feedback and purpose without changing assessment evidence", () => {
  const base = createJournal(now - 10000),
    p = arrangeLearning(learningEvidence("en", [], [], now), base, now);
  const easy = withWorkbench(base, {
    difficulty: [
      { id: "easy", lessonId: p.lessons[0].id, at: now - 1, value: "easy" },
    ],
  });
  expect(
    workbench(createDaily(easy, p, 5, "general", "d")).days[0].tasks[0].target,
  ).not.toBe(p.lessons[0].id);
  const hard = withWorkbench(base, {
    difficulty: [
      { id: "hard", lessonId: p.lessons[2].id, at: now - 1, value: "hard" },
    ],
  });
  expect(
    workbench(createDaily(hard, p, 5, "general", "d")).days[0].tasks[0].target,
  ).toBe(p.lessons[2].id);
  expect(
    workbench(createDaily(base, p, 5, "travel", "d")).days[0].tasks[0].kind,
  ).toBe("listening");
  expect(
    workbench(createDaily(base, p, 5, "work", "d")).days[0].tasks[0].kind,
  ).toBe("reading");
  expect(
    arrangeLearning(learningEvidence("en", [], [], now), hard, now).stage,
  ).toBe("foundation");
});
it("seeds recall from actual variation answers and keeps the unseen retest pool out of study exports", async () => {
  const { reviewCards } = await import("./review"),
    { STUDY_CARDS } = await import("./cards");
  const s = round(
    createJournal(now - 3 * DAY),
    "practice",
    "en-be",
    "variation",
    now - 2 * DAY,
  );
  const cards = reviewCards(s, "en", "recommended", now);
  expect(cards.map((c) => c.id)).toEqual(
    expect.arrayContaining(["x:en-be-v1", "x:en-be-v2"]),
  );
  expect(STUDY_CARDS.some((c) => c.id === "x:en-be-v3")).toBe(false);
  for (const text of GRADED_TEXTS)
    for (const word of text.words)
      expect(text.sentences.some((s) => s.text.includes(word.word))).toBe(true);
});
it("rotates through every practice and comprehension pool in short rounds before repeating", () => {
  for (const l of LESSONS) {
    let s = createJournal(now - DAY);
    for (let i = 0; i < 3; i++) {
      const items = activityItems(s, "practice", l.id, now - 10000 + i * 1000);
      expect(items).toHaveLength(2);
      expect(
        items.some((id) =>
          workbench(s).rounds.some((r) => r.items.includes(id)),
        ),
      ).toBe(false);
      s = round(
        s,
        "practice",
        l.id,
        "practice-" + i,
        now - 10000 + i * 1000,
        i !== 1,
      );
    }
    // Once all six have been answered, mistakes come before previously correct items.
    expect(activityItems(s, "practice", l.id, now)).toEqual(
      workbench(s).rounds[1].items,
    );
    expect(parseJournal(JSON.stringify(s))).toEqual(s);
  }
  for (const t of GRADED_TEXTS) {
    let s = createJournal(now - DAY);
    for (let i = 0; i < 3; i++) {
      s = round(
        s,
        i === 1 ? "listening" : "reading",
        t.id,
        "text-" + i,
        now - 10000 + i * 1000,
      );
      expect(workbench(s).rounds[i].items).toHaveLength(2);
    }
    expect(new Set(workbench(s).rounds.flatMap((r) => r.items)).size).toBe(6);
    expect(activityItems(s, "listening", t.id, now)).toEqual(
      workbench(s).rounds[0].items,
    );
    expect(parseJournal(JSON.stringify(s))).toEqual(s);
  }
});
it("spaces all three reserved batches and reports a real exhausted pool without recycling evidence", () => {
  for (const language of LEARNING_LANGUAGES) {
    const target = LESSONS.find((l) => l.language === language)!.id;
    let s = round(
      createJournal(now - 20 * DAY),
      "practice",
      target,
      "practice",
      now - 16 * DAY,
    );
    for (let i = 0; i < 3; i++) {
      const at = now - (12 - 4 * i) * DAY;
      expect(freshRetest(s, target, at)).toHaveLength(6 - i * 2);
      s = round(s, "retest", target, "retest-" + i, at);
      const result = workbench(s).rounds.at(-1)!;
      expect(result.items).toHaveLength(2);
      expect(freshRetest(s, target, result.at + 3 * DAY - 1)).toEqual([]);
      expect(
        startActivity(s, "retest", target, "early", result.at + DAY),
      ).toEqual(s);
      expect(
        conceptProfiles(s, language, result.at).find((p) => p.id === target)!
          .dueAt,
      ).toBe(i < 2 ? result.at + 3 * DAY : null);
      expect(parseJournal(JSON.stringify(s))).toEqual(s);
    }
    expect(freshRetest(s, target, now)).toEqual([]);
    const p = conceptProfiles(s, language, now).find((p) => p.id === target)!;
    expect(p.delayedTotal).toBe(6);
    expect(p.firstTotal).toBe(8);
    expect(p.repeatTotal).toBe(0);
  }
});
it("preserves saved queue selections and checked drafts when newer questions become available", () => {
  let s = createJournal(now - DAY);
  const plan = arrangeLearning(learningEvidence("en", [], [], now), s, now);
  s = createDaily(s, plan, 5, "general", "saved-day", now - 10000);
  const target = workbench(s).days[0].tasks[0].target;
  s = completeDailyTask(s, "en", undefined, now - 9000);
  const original = [...workbench(s).days[0].tasks[1].items];
  s = round(s, "practice", target, "outside-daily", now - 8000);
  expect(activityItems(s, "practice", target, now)).not.toEqual(original);
  const saved = parseJournal(JSON.stringify(s))!;
  let resumed = startActivity(saved, "practice", target, "resumed", now - 2000);
  expect(workbench(resumed).draft!.items).toEqual(original);
  resumed = answerActivity(resumed, activityQuestion(original[0])!.answer);
  const restored = parseJournal(JSON.stringify(resumed))!;
  expect(workbench(restored).draft!.items).toEqual(original);
  expect(workbench(restored).draft!.answers).toHaveLength(1);
  resumed = finishActivity(
    answerActivity(restored, activityQuestion(original[1])!.answer),
    now - 1000,
  );
  resumed = completeDailyTask(resumed, "en", "resumed", now);
  expect(workbench(resumed).days[0].completedAt).toBeTruthy();
  expect(
    updateJournal(saved, parseJournal(JSON.stringify(resumed))!),
  ).not.toBeNull();
});
it("replays legacy single-item retests without imposing the newer queue interval on saved history", () => {
  let s = round(
    createJournal(now - 10 * DAY),
    "practice",
    "en-be",
    "old-practice",
    now - 8 * DAY,
  );
  s = withWorkbench(s, {
    rounds: [
      ...workbench(s).rounds,
      ...["en-be-v3", "en-be-v4"].map((item, i) => ({
        id: "legacy-retest-" + i,
        kind: "retest" as const,
        target: "en-be",
        items: [item],
        answers: [activityQuestion(item)!.answer],
        startedAt: now - 4 * DAY + i * 1000,
        at: now - 4 * DAY + i * 1000 + 100,
      })),
    ],
  });
  expect(parseJournal(JSON.stringify(s))).toEqual(s);
  expect(freshRetest(s, "en-be", now)).toHaveLength(4);
});

import { expect, it } from "vitest";
import { LESSONS, type LearningLanguage } from "./catalog";
import { createJournal, type StudyJournal } from "./session";
import { DAY } from "./review";
import {
  arrangeLearning,
  learningEvidence,
  type LearningEvidence,
} from "./plan";
import {
  createVocabulary,
  answerVocabulary,
  advanceVocabulary,
} from "@/lib/vocabulary/session";
import type { TestResult } from "@/lib/types";
const now = Date.now(),
  empty = (language: LearningLanguage = "en"): LearningEvidence => ({
    language,
    grammar: null,
    vocabulary: null,
  });
const assessment = (
  language = "en",
  cefr = "B2",
  at = now - DAY,
): TestResult => ({
  sessionId: "assess",
  userId: "owner",
  learningLanguage: language,
  completedAt: new Date(at).toISOString(),
  overallCEFR: "C2",
  modules: [
    {
      module: "grammar",
      cefr: cefr as "B2",
      theta: 1,
      se: 0.4,
      itemsAdministered: 8,
    },
  ],
});
const journal = (): StudyJournal => ({
  ...createJournal(now - 10 * DAY),
  events: [],
});
function record(
  s: StudyJournal,
  lang: LearningLanguage,
  stage: "foundation" | "intermediate" | "advanced",
  scores: number[],
  days = [3, 2, 1],
) {
  const lessons = LESSONS.filter(
    (l) => l.language === lang && l.stage === stage,
  );
  scores.forEach((score, i) =>
    s.events.push({
      id: lang + "-" + stage + "-" + i,
      lessonId: lessons[i].id,
      at: now - days[i] * DAY,
      answers: lessons[i].questions.map((q, n) =>
        n < score ? q.answer : (q.answer + 1) % 3,
      ),
    }),
  );
  s.events.sort((a, b) => a.at - b.at);
}
it("keeps languages and skills separate, with a diagnostic instead of an invented level", () => {
  for (const lang of ["en", "zh", "ja", "ko", "es"] as const) {
    const evidence = learningEvidence(
      lang,
      [
        assessment(lang, "C1"),
        assessment(lang === "en" ? "ja" : "en", "A1", now),
      ],
      [],
      now,
    );
    const p = arrangeLearning(evidence, null, now);
    expect(p.stage).toBe("advanced");
    expect(p.basis).toBe("assessment");
    expect(p.lessons).toHaveLength(3);
    expect(
      p.lessons.every(
        (r) => LESSONS.find((l) => l.id === r.id)?.language === lang,
      ),
    ).toBe(true);
  }
  const p = arrangeLearning(
    learningEvidence("ja", [assessment("en", "C2")], [], now),
    null,
    now,
  );
  expect(p.grammarDiagnostic).toBe(true);
  expect(p.basis).toBe("starter");
  expect(p.stage).toBe("foundation");
  const r = assessment();
  r.modules[0].module = "vocabulary";
  expect(learningEvidence("en", [r], [], now).grammar).toBeNull();
});
it("ignores stale, unknown-language, future and insufficiently supported assessment records", () => {
  const weak = assessment();
  weak.modules[0].se = 1;
  const tiny = assessment();
  tiny.modules[0].itemsAdministered = 3;
  const legacy = { ...assessment(), learningLanguage: undefined };
  expect(
    learningEvidence(
      "en",
      [
        weak,
        tiny,
        legacy,
        assessment("en", "C2", now - 181 * DAY),
        assessment("en", "C2", now + 60000),
      ],
      [],
      now,
    ).grammar,
  ).toBeNull();
  expect(
    arrangeLearning(
      {
        ...empty(),
        grammar: { stage: "advanced", at: now - 181 * DAY, items: 10 },
      },
      null,
      now,
    ).grammarDiagnostic,
  ).toBe(true);
});
it("raises one stage after strong distinct concepts on different days, not repeated same-lesson or same-day practice", () => {
  const s = journal();
  record(s, "en", "foundation", [4, 4, 3]);
  const p = arrangeLearning(empty(), s, now);
  expect(p.stage).toBe("intermediate");
  expect(p.adjustment).toBe("up");
  expect(p.grammarDiagnostic).toBe(false);
  const one = {
    ...s,
    events: s.events.map((e, i) => ({
      ...e,
      lessonId: s.events[0].lessonId,
      answers: s.events[0].answers,
    })),
  };
  expect(arrangeLearning(empty(), one, now).stage).toBe("foundation");
  const oneDay = {
    ...s,
    events: s.events.map((e) => ({ ...e, at: now - DAY })),
  };
  expect(arrangeLearning(empty(), oneDay, now).stage).toBe("foundation");
  const selfRated = {
    ...journal(),
    reviews: [
      {
        id: "self",
        at: now,
        startedAt: now,
        cards: LESSONS.filter(
          (l) => l.language === "en" && l.stage === "foundation",
        )
          .slice(0, 3)
          .map((l) => "g:" + l.id + ":0"),
        ratings: [2, 2, 2] as (0 | 1 | 2)[],
      },
    ],
  };
  expect(arrangeLearning(empty(), selfRated, now).stage).toBe("foundation");
});
it("reports the recent-practice summary behind the practice basis", () => {
  const s = journal();
  record(s, "en", "foundation", [4, 4, 3]);
  expect(arrangeLearning(empty(), s, now).practice).toEqual({
    lessons: 3,
    days: 3,
  });
  const oneDay = {
    ...s,
    events: s.events.map((e) => ({ ...e, at: now - DAY })),
  };
  expect(arrangeLearning(empty(), oneDay, now).practice).toEqual({
    lessons: 3,
    days: 1,
  });
  expect(arrangeLearning(empty(), null, now).practice).toBeUndefined();
  const stale = journal();
  record(stale, "en", "foundation", [4, 4, 4], [95, 96, 97]);
  expect(arrangeLearning(empty(), stale, now).practice).toBeUndefined();
});
it("reports promotion progress toward the next stage from the same rule inputs", () => {
  const s = journal();
  record(s, "en", "foundation", [4, 4]);
  expect(arrangeLearning(empty(), s, now).promotion).toEqual({
    qualifying: 2,
    days: 2,
  });
  const oneDay = {
    ...s,
    events: s.events.map((e) => ({ ...e, at: now - DAY })),
  };
  expect(arrangeLearning(empty(), oneDay, now).promotion).toEqual({
    qualifying: 2,
    days: 1,
  });
  const weak = journal();
  record(weak, "en", "foundation", [1, 4, 4]);
  expect(arrangeLearning(empty(), weak, now).promotion).toEqual({
    qualifying: 2,
    days: 3,
  });
  const promoted = journal();
  record(promoted, "en", "foundation", [4, 4, 3]);
  const up = arrangeLearning(empty(), promoted, now);
  expect(up.stage).toBe("intermediate");
  expect(up.promotion).toEqual({ qualifying: 0, days: 0 });
  expect(
    arrangeLearning(
      { ...empty(), grammar: { stage: "advanced", at: now, items: 10 } },
      null,
      now,
    ).promotion,
  ).toBeUndefined();
  expect(arrangeLearning(empty(), null, now).promotion).toEqual({
    qualifying: 0,
    days: 0,
  });
});
it("uses recent difficulties after an assessment to step back without discarding records", () => {
  const s = journal();
  record(s, "en", "advanced", [1, 0, 1]);
  const evidence = learningEvidence(
    "en",
    [assessment("en", "C1", now - 5 * DAY)],
    [],
    now,
  );
  const snapshot = JSON.stringify(s);
  const p = arrangeLearning(evidence, s, now);
  expect(p.stage).toBe("intermediate");
  expect(p.adjustment).toBe("down");
  expect(JSON.stringify(s)).toBe(snapshot);
  const refreshed = learningEvidence(
    "en",
    [assessment("en", "C1", now)],
    [],
    now,
  );
  expect(arrangeLearning(refreshed, s, now).stage).toBe("advanced");
});
it("prioritizes continuation and weak/due concepts without mixing languages or exceeding three suggestions", () => {
  const s = journal();
  record(s, "en", "foundation", [0, 4, 4]);
  s.draft = { lessonId: "en-be", startedAt: now, answers: [0] };
  const p = arrangeLearning(empty(), s, now);
  expect(p.lessons[0]).toEqual({ id: "en-be", reason: "resume" });
  expect(new Set(p.lessons.map((l) => l.id)).size).toBe(p.lessons.length);
  expect(p.lessons).toHaveLength(3);
  expect(p.reviewCount).toBeGreaterThan(0);
  const ja = arrangeLearning(empty("ja"), s, now);
  expect(ja.lessons.every((l) => l.reason === "new")).toBe(true);
  expect(ja.reviewCount).toBe(0);
});
it("recommends actual missed words separately, and fresh successful recall removes them from the immediate word pack", () => {
  let s = createVocabulary("ko", "en", "quick", now - 2 * DAY, "words");
  while (s.status === "running")
    s = advanceVocabulary(answerVocabulary(s, "unknown"), now - DAY);
  const evidence = learningEvidence("ko", [], [s], now),
    p = arrangeLearning(evidence, null, now);
  expect(p.stage).toBe("foundation");
  expect(p.grammarDiagnostic).toBe(true);
  expect(p.vocabularyDiagnostic).toBe(false);
  expect(p.wordIds.length).toBeGreaterThan(0);
  expect(
    p.wordIds.every((id) => evidence.vocabulary!.missed.includes(id)),
  ).toBe(true);
  const learned = {
    ...journal(),
    reviews: [
      {
        id: "recall",
        at: now,
        startedAt: now,
        cards: ["v:" + p.wordIds[0]],
        ratings: [2] as (0 | 1 | 2)[],
      },
    ],
  };
  expect(arrangeLearning(evidence, learned, now).wordIds).not.toContain(
    p.wordIds[0],
  );
  let strong = createVocabulary("en", "en", "quick", now - 2 * DAY, "strong");
  while (strong.status === "running")
    strong = advanceVocabulary(
      answerVocabulary(strong, strong.questions[strong.index].id),
      now - DAY,
    );
  const high = arrangeLearning(
    learningEvidence("en", [], [strong], now),
    null,
    now,
  );
  expect(high.vocabularyStage).toBe("advanced");
  expect(high.stage).toBe("foundation");
  expect(high.grammarDiagnostic).toBe(true);
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  EXAM_ID,
  EXAM_ID_02,
  EXAM_IDS,
  SECTIONS,
  SECTIONS_02,
  isExamId,
  sectionsFor,
  LISTENING_SECONDS,
  LISTENING_SECONDS_02,
  LISTENING_TRACK_SECONDS,
  LISTENING_TRACK_SECONDS_02,
  isCorrect,
  listeningPosition,
  sectionResult,
  wordCount,
} from "./exam";
import {
  createSession,
  finishSection,
  mergeHighlight,
  parseSession,
  reconcileSession,
  storageKey,
} from "./session";

describe("IELTS paper integrity and grading", () => {
  it.each(["reading", "listening"] as const)(
    "has 40 answerable %s questions",
    (id) => {
      const section = SECTIONS[id];
      expect(section.questions.map((q) => q.number)).toEqual(
        Array.from({ length: 40 }, (_, i) => i + 1),
      );
      expect(new Set(section.questions.map((q) => q.id)).size).toBe(40);
      for (const q of section.questions) {
        expect(section.parts.some((p) => p.id === q.partId)).toBe(true);
        expect(
          isCorrect(q, q.answers[0]),
          `Question ${q.number}: primary answer must meet the instructions`,
        ).toBe(true);
        if (q.options.length)
          expect(q.options.map((o) => o.value)).toContain(q.answers[0]);
        else if (id === "reading")
          expect(
            section.parts.find((p) => p.id === q.partId)!.content.toLowerCase(),
          ).toContain(q.answers[0].toLowerCase());
      }
      const answers = Object.fromEntries(
        section.questions.map((q) => [q.id, q.answers[0]]),
      );
      expect(sectionResult(id, answers).correct).toBe(40);
      expect(sectionResult(id, answers).band).toBe(9);
    },
  );

  it("normalises answers but rejects blanks, wrong spelling and overlong variants", () => {
    const q = SECTIONS.listening.questions[8];
    expect(isCorrect(q, "  BANK   TRANSFER ")).toBe(true);
    expect(isCorrect(q, "a bank transfer")).toBe(false);
    expect(isCorrect(q, "bank tranfer")).toBe(false);
    expect(isCorrect(q, "")).toBe(false);
    expect(isCorrect(SECTIONS.listening.questions[6], "14 November")).toBe(
      true,
    );
  });

  it("keeps listening and academic reading estimates separate and never grades writing", () => {
    const readingAnswers = Object.fromEntries(
      SECTIONS.reading.questions.slice(0, 15).map((q) => [q.id, q.answers[0]]),
    );
    const listeningAnswers = Object.fromEntries(
      SECTIONS.listening.questions
        .slice(0, 15)
        .map((q) => [q.id, q.answers[0]]),
    );
    expect(sectionResult("reading", readingAnswers).band).toBe(5);
    expect(sectionResult("listening", listeningAnswers).band).toBe(4.5);
    expect(
      sectionResult("writing", { "task-1": "A good answer" }).band,
    ).toBeNull();
  });

  it("counts essay words across whitespace and keeps compounds as one word", () => {
    expect(wordCount(" \n ")).toBe(0);
    expect(
      wordCount("Well-designed transport isn't free.\n\nIt costs 20 dollars."),
    ).toBe(8);
    expect(wordCount("one — two")).toBe(2);
  });

  it("ships four actual MP3 recordings and their license", () => {
    for (const part of SECTIONS.listening.parts) {
      const number = new URL(part.audio!, "http://localhost").searchParams.get(
        "part",
      );
      const bytes = readFileSync(`public/ielts-assets/section-${number}.mp3`);
      expect(bytes.length).toBeGreaterThan(100000);
      expect(bytes.subarray(0, 3).toString()).toBe("ID3");
    }
    expect(readFileSync("public/ielts-assets/CC-BY-4.0.txt", "utf8")).toContain(
      "Attribution 4.0",
    );
    expect(
      readFileSync("public/ielts-assets/MIT-reading.txt", "utf8"),
    ).toContain("sifu-ewu");
  });
});

describe("IELTS Practice 02 integrity and grading", () => {
  const sections = SECTIONS_02;
  const now = Date.UTC(2026, 8, 7, 13);
  it.each(["reading", "listening"] as const)(
    "has 40 answerable Practice 02 %s questions",
    (id) => {
      const section = sections[id];
      expect(section.questions.map((q) => q.number)).toEqual(
        Array.from({ length: 40 }, (_, i) => i + 1),
      );
      expect(new Set(section.questions.map((q) => q.id)).size).toBe(40);
      for (const q of section.questions) {
        expect(section.parts.some((p) => p.id === q.partId)).toBe(true);
        expect(
          isCorrect(q, q.answers[0]),
          `Question ${q.number}: primary answer must meet the instructions`,
        ).toBe(true);
        if (q.options.length)
          expect(q.options.map((o) => o.value)).toContain(q.answers[0]);
        else if (id === "reading")
          expect(
            section.parts.find((p) => p.id === q.partId)!.content.toLowerCase(),
          ).toContain(q.answers[0].toLowerCase());
      }
      const answers = Object.fromEntries(
        section.questions.map((q) => [q.id, q.answers[0]]),
      );
      expect(sectionResult(id, answers, EXAM_ID_02).correct).toBe(40);
      expect(sectionResult(id, answers, EXAM_ID_02).band).toBe(9);
    },
  );

  it("ships four synthesized MP3 recordings with measured durations", () => {
    expect(LISTENING_TRACK_SECONDS_02).toHaveLength(4);
    for (const [index, part] of sections.listening.parts.entries()) {
      const params = new URL(part.audio!, "http://localhost").searchParams;
      expect(params.get("set")).toBe("02");
      const bytes = readFileSync(
        `public/ielts-assets/practice-02-part-${params.get("part")}.mp3`,
      );
      expect(bytes.length).toBeGreaterThan(1000000);
      expect(bytes.subarray(0, 3).toString()).toBe("ID3");
      expect(LISTENING_TRACK_SECONDS_02[index]).toBeGreaterThan(200);
    }
    expect(LISTENING_SECONDS_02).toBe(
      LISTENING_TRACK_SECONDS_02.reduce((s, t) => s + t + 30, 0) + 120,
    );
  });

  it("runs the Practice 02 wall clock on its own tracks", () => {
    expect(
      listeningPosition(30 + LISTENING_TRACK_SECONDS_02[0] + 2, EXAM_ID_02),
    ).toMatchObject({ phase: "preview", partIndex: 1, remaining: 28 });
    expect(
      listeningPosition(LISTENING_SECONDS_02 - 90.5, EXAM_ID_02),
    ).toMatchObject({ phase: "review", remaining: 91 });
  });

  it("keeps two original writing tasks with word floors", () => {
    expect(sections.writing.parts.map((p) => p.id)).toEqual([
      "task-1",
      "task-2",
    ]);
    expect(sections.writing.parts.map((p) => p.minWords)).toEqual([150, 250]);
  });

  it("isolates sessions, drafts and results by practice set", () => {
    expect(EXAM_IDS).toEqual([
      "academic-practice-01-v1",
      "academic-practice-02-v1",
    ]);
    expect(isExamId("academic-practice-02-v1")).toBe(true);
    expect(isExamId("nope")).toBe(false);
    const one = createSession("reading", now, "set-1");
    const two = createSession("reading", now, "set-2", EXAM_ID_02);
    expect(one.examId).toBe(EXAM_ID);
    expect(two.examId).toBe(EXAM_ID_02);
    expect(parseSession(JSON.stringify(two))).toEqual(two);
    expect(
      parseSession(
        JSON.stringify({ ...two, examId: "academic-practice-03-v1" }),
      ),
    ).toBeNull();
    expect(storageKey("guest")).not.toBe(storageKey("guest", EXAM_ID_02));
    expect(sectionsFor(EXAM_ID_02)).toBe(SECTIONS_02);
    expect(sectionsFor()).toBe(SECTIONS);
  });
});

describe("exam timing, media and recovery", () => {
  const now = Date.UTC(2026, 8, 7, 13);

  it("does not pause on refresh and finishes exactly at the deadline", () => {
    const session = createSession("reading", now, "reading-test");
    session.answers.q1 = "iii";
    const saved = parseSession(JSON.stringify(session))!;
    expect(reconcileSession(saved, now + 100000).deadline).toBe(now + 3600000);
    expect(reconcileSession(saved, saved.deadline - 1).status).toBe("running");
    const finished = reconcileSession(saved, saved.deadline);
    expect(finished.status).toBe("finished");
    expect(finished.completedAt).toBe(saved.deadline);
    expect(finished.answers.q1).toBe("iii");
    expect(finishSection(finished, saved.deadline + 100)).toBe(finished);
  });

  it("catches up every section after a background tab crosses multiple deadlines", () => {
    const session = createSession("full", now, "full-test");
    const reading = reconcileSession(session, session.deadline + 4000);
    expect(reading.sectionIndex).toBe(1);
    expect(reading.deadline).toBe(session.deadline + 3600000);
    const finished = reconcileSession(session, session.deadline + 7200000);
    expect(finished.status).toBe("finished");
    expect(finished.completedAt).toBe(session.deadline + 7200000);
  });

  it("manual submission starts the next section immediately", () => {
    const session = createSession("full", now, "full-test");
    const reading = finishSection(session, now + 10000);
    expect(reading.sectionIndex).toBe(1);
    expect(reading.partIndex).toBe(0);
    expect(reading.deadline).toBe(now + 10000 + 3600000);
  });

  it("keeps read-ahead, audio position and the final two minutes on one clock", () => {
    expect(listeningPosition(0)).toMatchObject({
      phase: "preview",
      remaining: 30,
    });
    expect(listeningPosition(42)).toMatchObject({
      phase: "playing",
      partIndex: 0,
      time: 12,
    });
    expect(
      listeningPosition(30 + LISTENING_TRACK_SECONDS[0] + 2),
    ).toMatchObject({ phase: "preview", partIndex: 1, remaining: 28 });
    expect(listeningPosition(LISTENING_SECONDS - 120)).toMatchObject({
      phase: "review",
      remaining: 120,
    });
    expect(listeningPosition(LISTENING_SECONDS + 1).remaining).toBe(0);
  });

  it("separates browser drafts by signed-in identity and guest", () => {
    expect(storageKey("user:alice")).not.toBe(storageKey("user:bob"));
    expect(storageKey("user:alice")).not.toBe(storageKey("guest"));
  });

  it("rejects damaged, oversized, stale and structurally invalid drafts", () => {
    expect(parseSession("not json")).toBeNull();
    const session = createSession("reading", now, "draft");
    for (const patch of [
      { sectionIndex: -1 },
      { partIndex: 50 },
      { answers: [] },
      { notes: { a: 42 } },
      { highlights: { a: [{ start: 10, end: 1 }] } },
      { status: "finished" },
      { examId: "old-version" },
      { mode: "unknown" },
      { deadline: null },
    ]) {
      expect(parseSession(JSON.stringify({ ...session, ...patch }))).toBeNull();
    }
    expect(parseSession(" ".repeat(500001))).toBeNull();
    expect(parseSession(JSON.stringify(session))).toEqual(session);
  });

  it("merges highlights without changing earlier saved state", () => {
    const old = [
      { start: 2, end: 8 },
      { start: 12, end: 20 },
    ];
    expect(mergeHighlight(old, { start: 5, end: 14 })).toEqual([
      { start: 2, end: 20 },
    ]);
    expect(old).toEqual([
      { start: 2, end: 8 },
      { start: 12, end: 20 },
    ]);
  });
});

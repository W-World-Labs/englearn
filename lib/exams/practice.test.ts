import { describe, expect, it } from "vitest";
import {
  PAPERS,
  getPaper,
  practiceCorrect,
  characterCount,
  practiceSections,
} from "./catalog";
import {
  createPractice,
  parsePractice,
  reconcilePractice,
  finishPracticeSection,
} from "./session";

describe("TOPIK / HSK / JLPT authored practice content", () => {
  it("has all twenty-six papers, distinct questions, usable audio scripts and graded answer keys", () => {
    expect(PAPERS.map((p) => p.label).sort()).toEqual([
      "HSK 1",
      "HSK 1 · 02",
      "HSK 2",
      "HSK 2 · 02",
      "HSK 3",
      "HSK 3 · 02",
      "HSK 4",
      "HSK 4 · 02",
      "HSK 5",
      "HSK 5 · 02",
      "HSK 6",
      "HSK 6 · 02",
      "JLPT N1",
      "JLPT N1 · 02",
      "JLPT N2",
      "JLPT N2 · 02",
      "JLPT N3",
      "JLPT N3 · 02",
      "JLPT N4",
      "JLPT N4 · 02",
      "JLPT N5",
      "JLPT N5 · 02",
      "TOPIK I",
      "TOPIK I · 02",
      "TOPIK II",
      "TOPIK II · 02",
    ]);
    expect(PAPERS.reduce((sum, p) => sum + p.questions.length, 0)).toBe(430);
    for (const paper of PAPERS) {
      expect(new Set(paper.questions.map((q) => q.id)).size).toBe(
        paper.questions.length,
      );
      expect(
        new Set(
          paper.questions.map(
            (q) =>
              `${q.prompt}|${q.script}|${q.passage}|${JSON.stringify(q.options)}`,
          ),
        ).size,
      ).toBe(paper.questions.length);
      for (const section of paper.sections) {
        expect(section.minutes).toBeGreaterThan(0);
        expect(
          paper.questions.filter((q) => q.section === section.id).length,
        ).toBeGreaterThan(0);
      }
      for (const q of paper.questions) {
        expect(q.explanation.zh.trim()).toBeTruthy();
        expect(q.explanation.en.length).toBeGreaterThan(15);
        if (q.section === "listening") expect(q.script?.trim()).toBeTruthy();
        if (q.kind === "choice")
          expect(
            q.options?.some((_, i) => String.fromCharCode(65 + i) === q.answer),
          ).toBe(true);
        if (q.kind !== "writing") {
          expect(q.answer).toBeTruthy();
          expect(practiceCorrect(q, q.answer)).toBe(true);
        } else {
          expect(practiceCorrect(q, "This is an ungraded response.")).toBe(
            false,
          );
          expect(q.minChars).toBeGreaterThan(0);
        }
      }
    }
  });
  it("keeps writing out of HSK 1/2 and TOPIK I, includes three TOPIK II writing drills", () => {
    for (const id of ["hsk-1-01-v1", "hsk-2-01-v1", "topik-i-01-v1"])
      expect(practiceSections(getPaper(id)!, "writing")).toHaveLength(0);
    expect(
      getPaper("topik-ii-01-v1")!.questions.filter(
        (q) => q.section === "writing",
      ),
    ).toHaveLength(3);
  });
  it("accepts punctuation and provided alternatives while rejecting incorrect order", () => {
    const q = getPaper("hsk-3-01-v1")!.questions.find((q) => q.id === "w1")!;
    expect(practiceCorrect(q, "我 每天 学习 汉语。 ")).toBe(true);
    expect(practiceCorrect(q, "每天我学习汉语")).toBe(true);
    expect(practiceCorrect(q, "汉语我学习每天")).toBe(false);
    expect(practiceCorrect(q, "")).toBe(false);
  });
  it("counts Chinese characters independently of punctuation and Korean characters including spaces", () => {
    expect(characterCount("我喜欢学习汉语。123 abc", "zh-CN")).toBe(7);
    expect(characterCount("한국어 공부\n", "ko-KR")).toBe(6);
  });
});

describe("Timed practice sessions", () => {
  it("advances through elapsed sections and finishes without resetting a resumed clock", () => {
    const s = createPractice("hsk-3-01-v1", "all", 1000, "clock");
    const next = reconcilePractice(s, s.deadline + 1);
    expect(next.sectionIndex).toBe(1);
    expect(next.deadline).toBe(s.deadline + 12 * 60000);
    expect(reconcilePractice(next, next.deadline - 1)).toBe(next);
    const done = reconcilePractice(s, 1000 + 26 * 60000);
    expect(done.status).toBe("finished");
    expect(done.completedAt).toBe(1000 + 26 * 60000);
    expect(parsePractice(JSON.stringify(done))).toEqual(done);
  });
  it("submits a single skill without entering other skills", () => {
    const s = createPractice("topik-ii-01-v1", "writing", 1000, "write");
    expect(finishPracticeSection(s, 2000).status).toBe("finished");
    expect(() =>
      createPractice("hsk-1-01-v1", "writing", 1000, "bad"),
    ).toThrow();
  });
  it("rejects corrupt drafts, unknown questions, wrong families and unsupported answer values", () => {
    const s = createPractice("hsk-3-01-v1", "reading", 1000, "valid");
    for (const patch of [
      { id: "../escape" },
      { id: 123 },
      { paperId: "official-future" },
      { sectionIndex: 4 },
      { questionIndex: -1 },
      { deadline: 0 },
      { flags: ["l1"] },
      { answers: { l1: "A" } },
      { answers: { r1: "Z" } },
      { answers: { r1: 17 } },
      { answers: { r1: "A".repeat(10001) } },
    ])
      expect(parsePractice(JSON.stringify({ ...s, ...patch }))).toBeNull();
    expect(parsePractice("broken")).toBeNull();
    const mixed = createPractice("hsk-3-01-v1", "all", 1000, "early");
    expect(
      parsePractice(
        JSON.stringify({ ...mixed, status: "finished", completedAt: 2000 }),
      ),
    ).toBeNull();
    expect(
      parsePractice(
        JSON.stringify({ ...s, userId: "another-user", score: 999 }),
      )!,
    ).not.toHaveProperty("userId");
  });
});

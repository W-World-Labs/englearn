import { beforeAll, expect, it } from "vitest";
import { loadLocaleMessages } from "@/lib/i18n/messages";
import {
  papersFor,
  getPaper,
  practiceSections,
  practiceOptionLabel,
  practiceAnswerText,
  explanationFor,
} from "./catalog";
import {
  createPractice,
  parsePractice,
  finishPracticeSection,
  reconcilePractice,
} from "./session";
import { examMessages } from "./messages";

beforeAll(() => loadLocaleMessages("ja"));

it("offers five 20-question Japanese papers with original explanations and no unsupported writing tasks", () => {
  const papers = papersFor("jlpt").filter((p) => p.id.endsWith("-01-v1"));
  expect(papers.map((p) => p.level)).toEqual(["N5", "N4", "N3", "N2", "N1"]);
  for (const p of papers) {
    expect(p.questions).toHaveLength(20);
    expect(p.language).toBe("ja-JP");
    expect(practiceSections(p, "writing")).toHaveLength(0);
    expect(p.questions.filter((q) => q.script)).toHaveLength(5);
    expect(p.questions.filter((q) => q.prompt.includes("★"))).toHaveLength(1);
    for (const q of p.questions) {
      expect(q.kind).toBe("choice");
      expect(q.explanation.ja?.trim()).toBeTruthy();
      expect(new Set(q.options).size).toBe(q.options!.length);
    }
  }
});
it("offers N5 through N1 second sets without listening audio dependency", () => {
  const papers = papersFor("jlpt").filter((p) => p.id.endsWith("-02-v1"));
  expect(papers.map((p) => p.level).sort()).toEqual(["N1", "N2", "N3", "N4", "N5"]);
  for (const p of papers) {
    expect(p.questions).toHaveLength(20);
    expect(p.language).toBe("ja-JP");
    expect(practiceSections(p, "writing")).toHaveLength(0);
    expect(practiceSections(p, "listening")).toHaveLength(0);
    expect(p.questions.filter((q) => q.script)).toHaveLength(0);
    expect(p.questions.filter((q) => q.prompt.includes("★"))).toHaveLength(1);
    if (["N3", "N2", "N1"].includes(p.level)) {
      expect(p.sections.map((s) => s.id)).toEqual(
        p.level === "N3"
          ? ["vocabulary", "grammar_reading", "reading"]
          : ["language_reading"],
      );
      for (const q of p.questions) {
        expect(q.explanation.zh.trim().length).toBeGreaterThan(15);
        expect(q.explanation.en.trim().length).toBeGreaterThan(15);
      }
      const firstSet = getPaper(p.id.replace("-02-v1", "-01-v1"));
      expect(firstSet, `Missing historical first set for ${p.id}`).toBeDefined();
      const firstPrompts = new Set(firstSet!.questions.map((q) => q.prompt));
      expect(p.questions.some((q) => firstPrompts.has(q.prompt))).toBe(false);
    }
    for (const q of p.questions) {
      expect(q.kind).toBe("choice");
      expect(q.explanation.ja?.trim()).toBeTruthy();
      expect(new Set(q.options).size).toBe(q.options!.length);
    }
  }
});
it("keeps lower-level vocabulary separate and combines upper-level knowledge/reading before listening", () => {
  for (const n of [3, 4, 5])
    expect(getPaper(`jlpt-n${n}-01-v1`)!.sections.map((s) => s.id)).toEqual([
      "vocabulary",
      "grammar_reading",
      "listening",
    ]);
  for (const n of [1, 2])
    expect(getPaper(`jlpt-n${n}-01-v1`)!.sections.map((s) => s.id)).toEqual([
      "language_reading",
      "listening",
    ]);
  const n5 = createPractice("jlpt-n5-01-v1", "all", 1000, "n5");
  const next = finishPracticeSection(n5, 2000);
  expect(next.sectionIndex).toBe(1);
  expect(next.deadline).toBe(2000 + 12 * 60000);
  const n2 = createPractice("jlpt-n2-01-v1", "all", 1000, "n2");
  expect(reconcilePractice(n2, 1000 + 25 * 60000).sectionIndex).toBe(1);
  expect(reconcilePractice(n2, 1000 + 35 * 60000).status).toBe("finished");
});
it("round-trips new modes while rejecting another section’s answers and preserving old HSK drafts", () => {
  const j = createPractice("jlpt-n3-01-v1", "vocabulary", 1000, "draft");
  expect(parsePractice(JSON.stringify(j))).toEqual(j);
  expect(
    parsePractice(JSON.stringify({ ...j, answers: { g1: "A" } })),
  ).toBeNull();
  expect(parsePractice(JSON.stringify({ ...j, mode: "writing" }))).toBeNull();
  const old = createPractice("hsk-3-01-v1", "reading", 1000, "old");
  expect(parsePractice(JSON.stringify(old))).toEqual(old);
});
it("uses numbered Japanese choices without changing stored choice keys and provides a complete Japanese interface", () => {
  const q = getPaper("jlpt-n5-01-v1")!.questions[0];
  expect(practiceOptionLabel("ja-JP", 0)).toBe("1");
  expect(practiceOptionLabel("zh-CN", 0)).toBe("A");
  expect(practiceAnswerText(q, "A", "ja-JP")).toBe("1 · あめ");
  expect(explanationFor(q.explanation, "ja")).toBe(q.explanation.ja);
  expect(Object.keys(examMessages("ja")).sort()).toEqual(
    Object.keys(examMessages("en")).sort(),
  );
  expect(examMessages("ja").vocabulary).toBe("文字・語彙");
});

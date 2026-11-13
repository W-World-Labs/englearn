import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import grammar from "@/data/learning/grammar-v1.json";
import variants from "@/data/learning/variants-v1.json";
import readings from "@/data/learning/readings-v1.json";
import { STUDY_CARDS } from "./cards";

const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
it("keeps all v0.14 published prompts, options, answers, IDs, texts and word meanings unchanged", () => {
  // Release b628cfc86478: saved answer indexes and exported cards depend on this content.
  // Later lessons are appended after the frozen 72; the same slice pattern
  // applies to variants (first 288 items are the published pool).
  expect(digest({ ...grammar, lessons: grammar.lessons.slice(0, 72) })).toBe(
    "d986fa4bbb1d87cdbcfbf33931e47066395a0e0aa5fa3c0e28abd24bacbfcef9",
  );
  expect(digest({ ...variants, items: variants.items.slice(0, 288) })).toBe(
    "f631d61e1cfa826d4d68705038b9ec1f068ca3d37a4786ea27934fe77ff862a0",
  );
  expect(
    digest({
      ...readings,
      items: readings.items.map((t) => ({
        ...t,
        questions: t.questions.slice(0, 2),
      })),
    }),
  ).toBe("e87931107a6050cea60fa0f495a7c3348296f5b4e085262b0e3f56ae779261f8");
});
it("provides complete, distinct and openly licensed additions without leaking reserved retests into recall", () => {
  expect(variants.license).toBe("CC-BY-SA-4.0");
  expect(readings.license).toBe("CC-BY-SA-4.0");
  const ids = new Set<string>();
  const signatures = new Set<string>();
  for (const q of [
    ...variants.items,
    ...readings.items.flatMap((t) => t.questions),
  ]) {
    expect(ids.has(q.id), q.id).toBe(false);
    ids.add(q.id);
    const signature = JSON.stringify([q.prompt, [...q.choices].sort()]);
    expect(signatures.has(signature), q.id).toBe(false);
    signatures.add(signature);
    expect(q.prompt.trim(), q.id).toBe(q.prompt);
    expect(q.choices, q.id).toHaveLength(3);
    expect(new Set(q.choices).size, q.id).toBe(3);
    expect(
      q.choices.every((c) => c.trim() === c && c.length > 0),
      q.id,
    ).toBe(true);
    expect(
      Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 3,
      q.id,
    ).toBe(true);
  }
  expect(readings.items).toHaveLength(15);
  for (const t of readings.items) expect(t.questions, t.id).toHaveLength(6);
  for (const q of variants.items) {
    expect(
      STUDY_CARDS.some((c) => c.id === "x:" + q.id),
      q.id,
    ).toBe(q.purpose === "practice");
  }
  // 480 grammar + 1500 vocabulary (300×5) + 720 practice
  // variants + 45 reading words. Vocabulary growth flows into recall by design.
  expect(STUDY_CARDS).toHaveLength(2745);
});

import { expect, it } from "vitest";
import { STUDY_CARDS, PACK_CREDIT } from "./cards";
import { makePack, packAnki, packHtml, packText } from "./materials";
import { LEARNING_LANGUAGES } from "./catalog";
it("exports the chosen grammar and vocabulary in five languages with source attribution", () => {
  for (const lang of LEARNING_LANGUAGES) {
    const cards = STUDY_CARDS.filter((c) => c.language === lang);
    const pack = makePack([cards[0].id, cards.at(-1)!.id], "zh")!;
    expect(pack.cards).toHaveLength(2);
    expect(packHtml(pack)).toContain("connect-src");
    expect(packText(pack)).toContain(cards[0].front);
    expect(packAnki(pack)).toContain("CC BY-SA");
    expect(packHtml(pack)).toContain(PACK_CREDIT);
  }
});
it("keeps print answers separate, supports pocket sheets, and uses foldable same-sheet cards", () => {
  const ids = STUDY_CARDS.slice(0, 4).map((c) => c.id);
  const workbook = packHtml(makePack(ids, "en")!);
  expect(workbook).toContain('class="answer-key"');
  expect(workbook).toContain("break-before:page");
  expect(workbook).toContain("My own example");
  const questionsOnly = packHtml(makePack(ids, "en", "A4", "workbook", false)!);
  expect(questionsOnly).not.toContain('class="answer-key"');
  for (const paper of ["A4", "A5", "Letter"] as const) {
    const html = packHtml(makePack(ids, "en", paper, "cards")!);
    expect(html).toContain(`size:${paper}`);
    expect(html.match(/class="cut-card"/g)).toHaveLength(4);
    expect(html).toContain("duplex alignment is not required");
  }
  const ref = packHtml(makePack(ids, "en", "A4", "reference")!);
  expect(ref.match(/class="reference"/g)).toHaveLength(1);
});
it("writes unambiguous UTF-8 TSV with stable first-field IDs and explicit Anki mappings", () => {
  const p = makePack(
    STUDY_CARDS.slice(0, 5).map((c) => c.id),
    "en",
  )!;
  const lines = packAnki(p).split("\n");
  expect(lines.slice(0, 4)).toEqual([
    "#separator:Tab",
    "#html:true",
    "#tags column:3",
    "#columns:Front\tBack\tTags",
  ]);
  for (const [i, line] of lines.slice(4).entries()) {
    const fields = line.split("\t");
    expect(fields).toHaveLength(3);
    expect(fields[0]).toContain(p.cards[i].id);
    expect(fields[1]).toContain(p.cards[i].answer.en);
    expect(fields[2]).toContain(p.cards[i].language);
  }
});
it("escapes scripts and HTML in generated documents and rejects invalid pack configuration", () => {
  const p = makePack([STUDY_CARDS[0].id], "en")!;
  const evil = structuredClone(p);
  evil.cards[0].front = '</script><img src=x onerror="globalThis.pwned=1"> &';
  const html = packHtml(evil);
  expect(html).not.toContain("<img src=x");
  expect(html).toContain("&lt;/script&gt;");
  expect(html).toContain("\\u003c/script>");
  expect(makePack([], "en")).toBeNull();
  expect(makePack(["unknown"], "en")).toBeNull();
  expect(
    makePack(
      [STUDY_CARDS[0].id, STUDY_CARDS.find((c) => c.language === "ja")!.id],
      "en",
    ),
  ).toBeNull();
  expect(makePack([STUDY_CARDS[0].id], "en", "<script>" as never)).toBeNull();
});

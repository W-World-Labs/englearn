import { PACK_CREDIT, type StudyCard, studyCard } from "./cards";
import type { StudyLocale } from "./catalog";
import { offlineScript } from "./offline";
import { materialsEn } from "@/lib/i18n/messages/en";
import { materialsZh } from "@/lib/i18n/messages/zh-CN";
export type PaperSize = "A4" | "Letter" | "A5";
export type MaterialLayout = "workbook" | "cards" | "reference";
export interface StudyPack {
  version: 1;
  id: string;
  title: string;
  locale: StudyLocale;
  cards: StudyCard[];
  paper: PaperSize;
  layout: MaterialLayout;
  answerKey: boolean;
}
export const MAX_PACK_CARDS = 160;
export function makePack(
  ids: string[],
  locale: StudyLocale,
  paper: PaperSize = "A4",
  layout: MaterialLayout = "workbook",
  answerKey = true,
): StudyPack | null {
  if (
    !["en", "zh"].includes(locale) ||
    !["A4", "Letter", "A5"].includes(paper) ||
    !["workbook", "cards", "reference"].includes(layout)
  )
    return null;
  const cards = [...new Set(ids)].map(studyCard);
  if (
    !cards.length ||
    cards.length > MAX_PACK_CARDS ||
    cards.some((c) => !c || c.language !== cards[0]?.language)
  )
    return null;
  return {
    version: 1,
    id: `cards-v1:${locale}:${cards.map((c) => c!.id).join("|")}`,
    title: `LingoLearn · ${cards[0]!.language.toUpperCase()} · ${materialLabels[locale].packTitleSuffix}`,
    locale,
    cards: cards as StudyCard[],
    paper,
    layout,
    answerKey,
  };
}
export interface MaterialLabels {
  reset: string; resetConfirm: string; full: string; print: string;
  title: string; cards: string; reference: string; questions: string;
  key: string; note: string; fold: string; hint: string; again: string;
  hard: string; good: string; reveal: string; recall: string; all: string;
  weak: string; export: string; import: string; saved: string;
  storage: string; done: string; next: string; none: string;
  invalid: string; imported: string; backupHint: string; progress: string;
  close: string; keyHint: string; copyright: string; packTitleSuffix: string;
}
/** UI copy lives in the message tree (materials.*); this record only derives
 *  per-pack-locale labels from it, so packText/packHtml/offline JSON,
 *  RecallPanel and materials.test.ts need no change. */
export const materialLabels: Record<StudyLocale, MaterialLabels> = {
  en: materialsEn as unknown as MaterialLabels,
  zh: materialsZh as unknown as MaterialLabels,
};
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
const plain = (s: string) => s.replace(/[\r\n\t]+/g, " ");
export function packText(pack: StudyPack): string {
  const m = materialLabels[pack.locale];
  return [
    pack.title,
    m.hint,
    ...pack.cards.map(
      (c, i) =>
        `${i + 1}. ${c.front}\n${c.choices.map((o, k) => `${String.fromCharCode(65 + k)}. ${o}`).join("\n")}\n${m.note}: ____________________`,
    ),
    ...(pack.answerKey || pack.layout !== "workbook"
      ? [
          `\n${m.key}`,
          ...pack.cards.map(
            (c, i) =>
              `${i + 1}. ${c.answer[pack.locale]}\n${c.explanation[pack.locale]}\n${c.examples.join("\n")}`,
          ),
        ]
      : []),
    PACK_CREDIT,
  ].join("\n\n");
}
/** UTF-8 Anki text import: Front / Back / Tags, HTML explicitly declared. */
export function packAnki(pack: StudyPack): string {
  const html = (s: string) => escapeHtml(s).replace(/\r?\n/g, "<br>");
  return [
    "#separator:Tab",
    "#html:true",
    "#tags column:3",
    "#columns:Front\tBack\tTags",
    ...pack.cards.map((c) =>
      [
        `<small>${html(c.id)}</small><br>${html(c.front)}${c.choices.length ? "<br>" + c.choices.map((o, i) => `${String.fromCharCode(65 + i)}. ${html(o)}`).join("<br>") : ""}`,
        `${html(c.answer[pack.locale])}<br>${html(c.explanation[pack.locale])}<br>${c.examples.map(html).join("<br>")}<hr><small>${html(PACK_CREDIT)}</small>`,
        `LingoLearn::${c.language} ${c.source} ${c.stage}`,
      ]
        .map(plain)
        .join("\t"),
    ),
  ].join("\n");
}
export function packHtml(pack: StudyPack): string {
  const m = materialLabels[pack.locale],
    esc = escapeHtml;
  const question = (c: StudyCard, i: number) =>
    `<article class="question"><h3>${i + 1}. ${esc(c.front)}</h3>${c.choices.length ? `<ol type="A">${c.choices.map((o) => `<li>${esc(o)}</li>`).join("")}</ol>` : ""}<div class="write-lines">${m.note}<br>________________________________________________<br>________________________________________________</div></article>`;
  const concepts = [
    ...new Map(pack.cards.map((c) => [c.lessonId ?? c.id, c])).values(),
  ];
  const reference = concepts
    .map(
      (c) =>
        `<article class="reference"><h3>${esc(c.title[pack.locale])}</h3><p>${esc(c.source === "vocabulary" ? c.answer[pack.locale] : c.explanation[pack.locale])}</p>${c.examples.map((e) => `<p lang="${c.language}">${esc(e)}</p>`).join("")}</article>`,
    )
    .join("");
  const content =
    pack.layout === "cards"
      ? `<h2>${m.cards}</h2><p>${m.fold}</p>${pack.cards.map((c, i) => `<article class="cut-card"><div><small>${i + 1} · ${esc(c.id)}</small><p>${esc(c.front)}</p>${c.choices.length ? `<ol type="A">${c.choices.map((o) => `<li>${esc(o)}</li>`).join("")}</ol>` : ""}</div><div><small>${i + 1}</small><strong>${esc(c.answer[pack.locale])}</strong><p>${esc(c.examples[0] ?? c.explanation[pack.locale])}</p></div></article>`).join("")}`
      : pack.layout === "reference"
        ? `<h2>${m.reference}</h2>${reference}`
        : `<h2>${m.questions}</h2>${pack.cards.map(question).join("")}${pack.answerKey ? `<section class="answer-key"><h2>${m.key}</h2>${pack.cards.map((c, i) => `<article><h3>${i + 1}. ${esc(c.answer[pack.locale])}</h3><p>${esc(c.explanation[pack.locale])}</p></article>`).join("")}</section>` : ""}`;
  const data = JSON.stringify({ pack, m, credit: PACK_CREDIT })
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return `<!doctype html><html lang="${pack.locale === "zh" ? "zh-CN" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>${esc(pack.title)}</title><style>
*{box-sizing:border-box}body{margin:0;background:#f1f5f9;color:#172033;font:16px/1.65 system-ui,'Noto Sans CJK SC','Noto Sans CJK JP','Noto Sans CJK KR',sans-serif}main{max-width:900px;margin:auto;padding:24px}h1{font-size:26px}h2{font-size:21px}h3{font-size:17px}button,.file-label{font:inherit;padding:10px 14px;border:1px solid #94a3b8;border-radius:9px;background:white;color:#173970;cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #2563eb}button:disabled{opacity:.5;cursor:default}.toolbar{display:flex;gap:8px;flex-wrap:wrap}.screen{padding:20px;background:#fff;border-radius:14px;margin-bottom:20px}.card-face{padding:18px;background:#eff6ff;margin:16px 0;border-radius:10px}.rating{display:flex;flex-wrap:wrap;gap:8px}.question,.reference{margin:0 0 24px;background:white;padding:18px;border:1px solid #cbd5e1;border-radius:8px;break-inside:avoid}.write-lines{line-height:2.2;color:#475569;overflow:hidden}.answer-key{border-top:2px solid #94a3b8;margin-top:30px;padding-top:20px}.answer-key article{break-inside:avoid}.cut-card{display:grid;grid-template-columns:1fr 1fr;border:1px dashed #64748b;break-inside:avoid;margin:0 0 12px;min-height:150px;background:white}.cut-card>div{padding:14px;min-width:0;overflow-wrap:anywhere}.cut-card>div+div{border-left:1px dashed #64748b}.cut-card strong{display:block}small,.muted{font-size:12px;color:#475569}li{margin-bottom:6px}footer{font-size:11px;overflow-wrap:anywhere}#recall-back[hidden]{display:none}[hidden]{display:none!important}.print-content{overflow-wrap:anywhere}.key-note{font-size:13px}@page{size:${pack.paper};margin:14mm}@media print{body{background:white;color:black;font-size:11pt;line-height:1.45}main{max-width:none;padding:0}.screen{display:none!important}h1{font-size:20pt}h2{font-size:16pt}h3{font-size:12pt}.question,.reference{padding:4mm;border-radius:0;margin-bottom:5mm}.question{break-inside:avoid}.answer-key{break-before:page;border:0;margin:0;padding:0}.cut-card{min-height:42mm;margin-bottom:4mm}.cut-card>div{padding:4mm}footer{margin-top:8mm;font-size:8pt}.write-lines{line-height:2.3}a{color:black;text-decoration:none}}
</style></head><body><main><h1>${esc(pack.title)}</h1><p>${m.hint}</p><section class="screen"><div class="toolbar"><button id="print">${m.print}</button><button id="export">${m.export}</button><label class="file-label">${m.import}<input id="import" type="file" accept=".json,application/json" hidden></label></div><p class="muted">${m.backupHint}</p><p id="save-status" role="status"></p><h2>${m.recall}</h2><div class="toolbar"><button id="all">${m.all}</button><button id="weak">${m.weak}</button></div><p id="round-status" aria-live="polite"></p><div id="recall-front" class="card-face"></div><button id="reveal">${m.reveal}</button><div id="recall-back" class="card-face" hidden></div><div id="rating" class="rating" hidden><button data-rating="0">${m.again}</button><button data-rating="1">${m.hard}</button><button data-rating="2">${m.good}</button></div><button id="next" hidden>${m.next}</button></section><section class="print-content">${content}</section><footer><h2>${m.copyright}</h2>${esc(PACK_CREDIT)}</footer></main><script id="pack-data" type="application/json">${data}</script><script>${offlineScript}</script></body></html>`;
}
export function downloadMaterial(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

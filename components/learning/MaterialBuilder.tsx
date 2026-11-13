import * as React from "react";
import { useI18n } from "@/lib/i18n/context";
import { studyTextLocale } from "@/lib/i18n/localized";
import {
  LEARNING_LANGUAGES,
  STAGES,
  type LearningLanguage,
  type Stage,
  type StudyLocale,
} from "@/lib/learning/catalog";
import { STUDY_CARDS, studyCard, type StudyCard } from "@/lib/learning/cards";
import { type StudyJournal } from "@/lib/learning/session";
import { reviewCards } from "@/lib/learning/review";
import {
  makePack,
  packHtml,
  packText,
  packAnki,
  downloadMaterial,
  MAX_PACK_CARDS,
  type PaperSize,
  type MaterialLayout,
} from "@/lib/learning/materials";
import { reinforcementMessages } from "@/lib/learning/reinforcement-messages";
import { learningMessages } from "@/lib/learning/messages";

export function MaterialBuilder({
  session,
  wordIds,
}: {
  session: StudyJournal | null;
  wordIds?: string;
}) {
  const { locale, learningLanguage } = useI18n(),
    m = reinforcementMessages(locale),
    l = learningMessages(locale);
  const seeds = React.useMemo(
    () =>
      wordIds
        ?.split(",")
        .map((id) => studyCard(`v:${id}`))
        .filter((c): c is StudyCard => !!c) ?? [],
    [wordIds],
  );
  const [language, setLanguage] = React.useState<LearningLanguage>(
    (seeds[0]?.language ?? learningLanguage) as LearningLanguage,
  );
  const [source, setSource] = React.useState<StudyCard["source"]>(
      wordIds !== undefined ? "vocabulary" : "grammar",
    ),
    [stage, setStage] = React.useState<Stage | "all">("all"),
    [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>(() =>
    wordIds !== undefined
      ? seeds.filter((c) => c.language === seeds[0]?.language).map((c) => c.id)
      : STUDY_CARDS.filter(
          (c) => c.language === learningLanguage && c.source === "grammar",
        )
          .slice(0, 12)
          .map((c) => c.id),
  );
  const [paper, setPaper] = React.useState<PaperSize>("A4"),
    [layout, setLayout] = React.useState<MaterialLayout>("workbook"),
    [answerKey, setAnswerKey] = React.useState(true),
    [explanation, setExplanation] = React.useState<StudyLocale>(
      studyTextLocale(locale),
    ),
    [notice, setNotice] = React.useState("");
  const visible = STUDY_CARDS.filter(
    (c) =>
      c.language === language &&
      c.source === source &&
      (stage === "all" || c.stage === stage) &&
      `${c.title.en} ${c.title.zh} ${c.front} ${c.answer.en} ${c.answer.zh}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const groups = [
    ...new Map(
      visible.map((c) => [
        c.lessonId ?? c.id,
        visible.filter(
          (other) => (other.lessonId ?? other.id) === (c.lessonId ?? c.id),
        ),
      ]),
    ).values(),
  ];
  function selection(ids: string[]) {
    setNotice("");
    const next = [...new Set(ids)];
    if (next.length > MAX_PACK_CARDS) {
      setNotice(m.limit);
      return;
    }
    setSelected(next);
  }
  function toggle(cards: StudyCard[]) {
    const ids = cards.map((c) => c.id),
      all = ids.every((id) => selected.includes(id));
    selection(
      all ? selected.filter((id) => !ids.includes(id)) : [...selected, ...ids],
    );
  }
  function selectedReviews(filter: "weak" | "due") {
    const cards = reviewCards(session, language, filter);
    selection(cards.map((c) => c.id));
    if (!cards.length) setNotice(m.weakEmpty);
  }
  const pack = makePack(selected, explanation, paper, layout, answerKey),
    name = `lingolearn-${language}-${layout}`;
  function save(format: "html" | "txt" | "anki") {
    if (!pack) {
      setNotice(m.none);
      return;
    }
    downloadMaterial(
      format === "html"
        ? packHtml(pack)
        : format === "txt"
          ? packText(pack)
          : packAnki(pack),
      `${name}.${format === "anki" ? "tsv" : format}`,
      format === "html"
        ? "text/html;charset=utf-8"
        : format === "txt"
          ? "text/plain;charset=utf-8"
          : "text/tab-separated-values;charset=utf-8",
    );
  }
  function print() {
    if (!pack) return;
    const win = window.open("", "_blank");
    if (!win) {
      save("html");
      setNotice(m.popup);
      return;
    }
    win.opener = null;
    win.document.open();
    win.document.write(packHtml(pack));
    win.document.close();
  }
  async function share() {
    if (!pack) return;
    const file = new File([packHtml(pack)], `${name}.html`, {
      type: "text/html",
    });
    try {
      if (!navigator.canShare?.({ files: [file] }) || !navigator.share)
        throw Error();
      await navigator.share({ files: [file], title: pack.title });
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      save("html");
      setNotice(m.shareFailed);
    }
  }
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
      aria-label={m.materials}
    >
      <h2 className="text-2xl font-bold">{m.materialsTitle}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
        {m.materialsHint}
      </p>
      <div className="mt-5 flex flex-wrap gap-4">
        <label className="text-sm">
          {l.learningLanguage}
          <select
            aria-label={l.learningLanguage}
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value as LearningLanguage);
              setSelected([]);
              setQuery("");
              setNotice("");
            }}
            className="ml-2 min-h-11 rounded-lg border border-slate-300 bg-white px-3"
          >
            {LEARNING_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {
                  {
                    en: "English",
                    zh: "中文",
                    ja: "日本語",
                    ko: "한국어",
                    es: "Español",
                  }[lang]
                }
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {m.source}
          <select
            aria-label={m.source}
            value={source}
            onChange={(e) => setSource(e.target.value as typeof source)}
            className="ml-2 min-h-11 rounded-lg border border-slate-300 bg-white px-3"
          >
            <option value="grammar">{m.grammar}</option>
            <option value="vocabulary">{m.vocabulary}</option>
            <option value="reading">
              {m.readingWords}
            </option>
          </select>
        </label>
        <label className="text-sm">
          {m.stage}
          <select
            aria-label={m.stage}
            value={stage}
            onChange={(e) => setStage(e.target.value as Stage | "all")}
            className="ml-2 min-h-11 rounded-lg border border-slate-300 bg-white px-3"
          >
            <option value="all">{m.allStages}</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {l[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-4 block text-sm">
        {m.search}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3"
        />
      </label>
      <div className="my-4 flex flex-wrap gap-2">
        <button
          className="ielts-button"
          onClick={() => selection([...selected, ...visible.map((c) => c.id)])}
        >
          {m.selectVisible}
        </button>
        <button className="ielts-button" onClick={() => selection([])}>
          {m.clear}
        </button>
        <button
          className="ielts-button"
          onClick={() => selectedReviews("weak")}
        >
          {m.fromWeak}
        </button>
        <button className="ielts-button" onClick={() => selectedReviews("due")}>
          {m.fromDue}
        </button>
      </div>
      <p
        role="status"
        className="mb-3 text-sm font-semibold"
        data-testid="material-count"
      >
        {m.selected}: {selected.length} / {MAX_PACK_CARDS}
      </p>
      <div className="grid max-h-96 gap-3 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
        {groups.map((cards) => {
          const c = cards[0],
            all = cards.every((c) => selected.includes(c.id)),
            some = cards.some((c) => selected.includes(c.id));
          return (
            <label
              key={c.lessonId ?? c.id}
              className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm"
              data-testid="material-option"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={all}
                ref={(el) => {
                  if (el) el.indeterminate = some && !all;
                }}
                onChange={() => toggle(cards)}
              />
              <span>
                <strong>{c.title[explanation]}</strong>
                <span className="mt-1 block text-xs text-slate-600">
                  {l[c.stage]} · {cards.length} {m.cardUnit}
                </span>
              </span>
            </label>
          );
        })}
        {!groups.length && <p className="p-3 text-sm">{l.noMatches}</p>}
      </div>
      <div className="my-5 flex flex-wrap gap-4">
        <label className="text-sm">
          {m.language}
          <select
            aria-label={m.language}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value as StudyLocale)}
            className="ml-2 min-h-11 rounded-lg border border-slate-300 px-3"
          >
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </label>
        <label className="text-sm">
          {m.paper}
          <select
            aria-label={m.paper}
            value={paper}
            onChange={(e) => setPaper(e.target.value as PaperSize)}
            className="ml-2 min-h-11 rounded-lg border border-slate-300 px-3"
          >
            {["A4", "Letter", "A5"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {m.layout}
          <select
            aria-label={m.layout}
            value={layout}
            onChange={(e) => setLayout(e.target.value as MaterialLayout)}
            className="ml-2 min-h-11 rounded-lg border border-slate-300 px-3"
          >
            {(["workbook", "cards", "reference"] as const).map((v) => (
              <option key={v} value={v}>
                {m[v]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {layout === "workbook" && (
        <label className="mb-5 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={answerKey}
            onChange={(e) => setAnswerKey(e.target.checked)}
          />
          {m.key}
        </label>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          className="ielts-button disabled:opacity-50"
          disabled={!pack}
          onClick={print}
        >
          {m.print}
        </button>
        <button
          className="ielts-button disabled:opacity-50"
          disabled={!pack}
          onClick={() => save("html")}
        >
          {m.html}
        </button>
        <button
          className="ielts-button disabled:opacity-50"
          disabled={!pack}
          onClick={() => save("txt")}
        >
          {m.txt}
        </button>
        <button
          className="ielts-button disabled:opacity-50"
          disabled={!pack}
          onClick={() => save("anki")}
        >
          {m.anki}
        </button>
        <button
          className="ielts-button disabled:opacity-50"
          disabled={!pack}
          onClick={() => void share()}
        >
          {m.share}
        </button>
      </div>
      {notice && (
        <p role="status" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm">
          {notice}
        </p>
      )}
      <div className="mt-6 space-y-3 text-xs leading-6 text-slate-600">
        <p>{m.printHint}</p>
        <p>{m.offlineHint}</p>
        <p>
          {m.ankiHint}{" "}
          <a
            href="https://docs.ankiweb.net/importing/text-files.html"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Anki
          </a>
        </p>
        <p>{m.shareHint}</p>
        <p>CC BY-SA 4.0 · LingoLearn · wordfreq 3.1.1</p>
      </div>
    </section>
  );
}

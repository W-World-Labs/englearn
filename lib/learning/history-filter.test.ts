import { describe, expect, it } from "vitest";
import {
  filterHistory,
  hasActiveHistoryFilters,
  historyFilterOptions,
  HISTORY_FILTER_ALL,
  type HistoryFilterItem,
} from "./history-filter";

const items: HistoryFilterItem[] = [
  { id: "a", label: "TOPIK I reading", family: "topik", language: "ko", status: "finished" },
  { id: "b", label: "HSK 1 listening", family: "hsk", language: "zh", status: "finished" },
  { id: "c", label: "JLPT N5 grammar", family: "jlpt", language: "ja", status: "draft" },
  { id: "d", label: "IELTS Academic writing", family: "ielts", language: "en", status: "finished" },
  { id: "e", label: "Lesson: past tense", family: "lesson", language: "en", status: "finished" },
];

const ids = (rows: HistoryFilterItem[]) => rows.map((row) => row.id);

describe("filterHistory", () => {
  it("returns every item, in order, when no criteria are supplied", () => {
    expect(ids(filterHistory(items))).toEqual(["a", "b", "c", "d", "e"]);
    expect(ids(filterHistory(items, {}))).toEqual(["a", "b", "c", "d", "e"]);
    expect(ids(filterHistory([], {}))).toEqual([]);
  });

  it.each([
    ["topik", ["a"]],
    ["hsk", ["b"]],
    ["jlpt", ["c"]],
    ["ielts", ["d"]],
    ["lesson", ["e"]],
    ["TOPIK", ["a"]],
    [HISTORY_FILTER_ALL, ["a", "b", "c", "d", "e"]],
    ["", ["a", "b", "c", "d", "e"]],
    ["missing", []],
  ])("filters by family %s", (family, expected) => {
    expect(ids(filterHistory(items, { family }))).toEqual(expected);
  });

  it("filters by language and status", () => {
    expect(ids(filterHistory(items, { language: "en" }))).toEqual(["d", "e"]);
    expect(ids(filterHistory(items, { status: "finished" }))).toEqual([
      "a",
      "b",
      "d",
      "e",
    ]);
    expect(ids(filterHistory(items, { status: "draft" }))).toEqual(["c"]);
    expect(ids(filterHistory(items, { status: "unknown" }))).toEqual([]);
  });

  it("composes active facets with AND", () => {
    expect(
      ids(filterHistory(items, { family: "jlpt", status: "draft" })),
    ).toEqual(["c"]);
    expect(
      ids(filterHistory(items, { language: "en", status: "finished" })),
    ).toEqual(["d", "e"]);
    expect(
      ids(
        filterHistory(items, {
          family: "en",
          language: "en",
          status: "draft",
        }),
      ),
    ).toEqual([]);
  });

  it("searches display labels case-insensitively and trims the query", () => {
    expect(ids(filterHistory(items, { query: "listening" }))).toEqual(["b"]);
    expect(ids(filterHistory(items, { query: "  TOPIK " }))).toEqual(["a"]);
    expect(ids(filterHistory(items, { query: "GRAMMAR" }))).toEqual(["c"]);
    expect(ids(filterHistory(items, { query: "ing" }))).toEqual([
      "a",
      "b",
      "d",
    ]);
    expect(ids(filterHistory(items, { query: "   " }))).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  it("combines search with facets and returns an empty array when nothing matches", () => {
    expect(
      ids(filterHistory(items, { query: "listening", family: "hsk" })),
    ).toEqual(["b"]);
    expect(
      ids(filterHistory(items, { query: "listening", family: "topik" })),
    ).toEqual([]);
    expect(
      ids(filterHistory(items, { query: "zzz", language: "en" })),
    ).toEqual([]);
  });

  it("preserves the original ordering after filtering", () => {
    const ordered: HistoryFilterItem[] = [
      { id: "new", label: "newest", family: "hsk", status: "finished" },
      { id: "mid", label: "middle", family: "hsk", status: "finished" },
      { id: "old", label: "oldest", family: "hsk", status: "finished" },
    ];
    expect(ids(filterHistory(ordered, { family: "hsk" }))).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  it("does not mutate the input array", () => {
    const snapshot = [...items];
    filterHistory(items, { query: "topik", status: "finished" });
    expect(items).toEqual(snapshot);
  });

  it("tolerates missing, null and unknown fields without throwing", () => {
    const messy = [
      { id: "x", label: "kept" },
      { id: "y", label: "nulls", family: null, language: null, status: null },
      { id: "z" } as unknown as HistoryFilterItem,
      {
        id: "w",
        label: 42,
        family: { unexpected: true },
      } as unknown as HistoryFilterItem,
    ];
    expect(() => filterHistory(messy, { query: "kept" })).not.toThrow();
    expect(ids(filterHistory(messy, { query: "kept" }))).toEqual(["x"]);
    // Items without a usable label simply never match a non-empty query.
    expect(ids(filterHistory(messy, { query: "anything" }))).toEqual([]);
    // Unknown facet shapes never match an active facet but are not dropped.
    expect(ids(filterHistory(messy, { family: "topik" }))).toEqual([]);
    expect(ids(filterHistory(messy, { family: HISTORY_FILTER_ALL }))).toEqual([
      "x",
      "y",
      "z",
      "w",
    ]);
  });
});

describe("hasActiveHistoryFilters", () => {
  it.each([
    [{}, false],
    [{ query: "" }, false],
    [{ query: "  " }, false],
    [{ family: HISTORY_FILTER_ALL, status: HISTORY_FILTER_ALL }, false],
    [{ query: "x" }, true],
    [{ family: "hsk" }, true],
    [{ language: "ja" }, true],
    [{ status: "draft" }, true],
  ])("reports %o as %s", (criteria, expected) => {
    expect(hasActiveHistoryFilters(criteria)).toBe(expected);
  });
});

describe("historyFilterOptions", () => {
  it("collects distinct facet values in a stable sorted order", () => {
    const options = historyFilterOptions(items);
    expect(options.families).toEqual([
      "hsk",
      "ielts",
      "jlpt",
      "lesson",
      "topik",
    ]);
    expect(options.languages).toEqual(["en", "ja", "ko", "zh"]);
    expect(options.statuses).toEqual(["draft", "finished"]);
  });

  it("skips blanks and tolerates missing fields", () => {
    const options = historyFilterOptions([
      { id: "a", label: "a", family: "  ", status: undefined },
      { id: "b", label: "b" },
      { id: "c", label: "c", family: "hsk" },
    ]);
    expect(options.families).toEqual(["hsk"]);
    expect(options.languages).toEqual([]);
    expect(options.statuses).toEqual([]);
  });
});

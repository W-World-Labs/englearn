import { describe, expect, it } from "vitest";
import { paginateArray, parsePageParams } from "./pagination";

describe("paginateArray", () => {
  it("slices items by page", () => {
    const items = [1, 2, 3, 4, 5];
    const p = paginateArray(items, 2, 2);
    expect(p.items).toEqual([3, 4]);
    expect(p.total).toBe(5);
    expect(p.page).toBe(2);
    expect(p.totalPages).toBe(3);
  });
});

describe("parsePageParams", () => {
  it("parses page and pageSize", () => {
    const params = new URLSearchParams("page=2&pageSize=5");
    expect(parsePageParams(params)).toEqual({ page: 2, pageSize: 5, all: false });
  });
});
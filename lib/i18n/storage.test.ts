import { afterEach, expect, it, vi } from "vitest";
import { loadLearningLanguage, loadUiLocale } from "./storage";
import { DEFAULT_UI_LOCALE } from "./ui-locales";
import { addXp } from "@/lib/gamification/store";
afterEach(() => vi.unstubAllGlobals());
it("keeps preference reads and answer XP usable when device storage is blocked", () => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
  expect(loadLearningLanguage()).toBe("en");
  expect(loadUiLocale()).toBe(DEFAULT_UI_LOCALE);
  const progress = addXp(10);
  expect(progress.dailyXpToday).toBe(10);
  expect(progress.lastActiveDate).toBe(new Date().toISOString().slice(0, 10));
});

it("lands on English when the stored UI locale was removed from the picker", () => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) =>
      key === "lingolearn:uiLocale" ? "fr" : null,
    setItem() {},
  });
  expect(loadUiLocale()).toBe("en");
});

it("restores a stored picker locale on the next visit", () => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) =>
      key === "lingolearn:uiLocale" ? "ko" : null,
    setItem() {},
  });
  expect(loadUiLocale()).toBe("ko");
});

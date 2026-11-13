import { describe, expect, it } from "vitest";
import {
  ieltsDraft,
  ieltsDraftFor,
  practiceDraft,
  practiceDraftFor,
  readStored,
  vocabularyDraft,
  vocabularyDraftFor,
} from "./drafts";
import { createPractice, reconcilePractice } from "./session";
import { createSession, reconcileSession } from "@/lib/ielts/session";
import { EXAM_ID, EXAM_ID_02 } from "@/lib/ielts/exam";
import {
  advanceVocabulary,
  answerVocabulary,
  createVocabulary,
  vocabularyStorageKey,
} from "@/lib/vocabulary/session";
import { LANGUAGE_NAMES } from "@/lib/vocabulary/bank";

const NOW = 1_000_000;

describe("practiceDraft", () => {
  it("labels running and finished drafts, ignores corrupt storage", () => {
    const running = createPractice("hsk-3-01-v1", "all", NOW, "p1");
    expect(practiceDraft(JSON.stringify(running), NOW + 1000)).toEqual({
      label: "HSK 3",
      status: "running",
    });
    // Expired mid-paper: the wall clock moved it a section on, still live.
    const later = reconcilePractice(running, running.deadline + 1);
    expect(later.status).toBe("running");
    expect(practiceDraft(JSON.stringify(later), later.deadline - 1)).toEqual({
      label: "HSK 3",
      status: "running",
    });
    // Fully elapsed: reconciles to finished and stays surfacing as a review.
    const done = reconcilePractice(running, NOW + 60 * 60000);
    expect(done.status).toBe("finished");
    expect(practiceDraft(JSON.stringify(done), NOW + 60 * 60000)).toEqual({
      label: "HSK 3",
      status: "finished",
    });
    expect(practiceDraft("not json", NOW)).toBeNull();
    expect(practiceDraft(null, NOW)).toBeNull();
    expect(practiceDraft('{"id":"x"}', NOW)).toBeNull();
  });
});

describe("ieltsDraft", () => {
  it("prefers a running set over a finished one and labels the set", () => {
    const done01 = reconcileSession(
      createSession("full", NOW, "i1", EXAM_ID),
      NOW + 10 * 3600 * 1000,
    );
    expect(done01.status).toBe("finished");
    const running02 = createSession("listening", NOW, "i2", EXAM_ID_02);
    expect(
      ieltsDraft([JSON.stringify(done01), JSON.stringify(running02)], NOW + 1),
    ).toEqual({ label: "Practice 02", status: "running" });
    expect(ieltsDraft([JSON.stringify(done01), null], NOW + 1)).toEqual({
      label: "Practice 01",
      status: "finished",
    });
    expect(ieltsDraft([null, "junk"], NOW)).toBeNull();
    expect(ieltsDraft([], NOW)).toBeNull();
  });
});

describe("vocabularyDraft", () => {
  it("labels running and finished drafts with the tested language", () => {
    const running = createVocabulary("ja", "zh", "quick", NOW, "v1", () => 0.5);
    expect(vocabularyDraft(JSON.stringify(running))).toEqual({
      label: LANGUAGE_NAMES.ja,
      status: "running",
    });
    let s = running;
    while (s.status === "running")
      s = advanceVocabulary(answerVocabulary(s, "unknown"), NOW + 1);
    expect(s.status).toBe("finished");
    expect(vocabularyDraft(JSON.stringify(s))).toEqual({
      label: LANGUAGE_NAMES.ja,
      status: "finished",
    });
    expect(vocabularyDraft(null)).toBeNull();
    expect(vocabularyDraft("junk")).toBeNull();
  });
});

describe("storage probes", () => {
  it("builds the shared vocabulary key and fails closed without localStorage", () => {
    expect(vocabularyStorageKey("user:abc")).toBe(
      "lingolearn:vocabulary:user%3Aabc",
    );
    // Node/SSR has no localStorage: probes must return null, not throw.
    expect(readStored("anything")).toBeNull();
    expect(practiceDraftFor("guest", "hsk", NOW)).toBeNull();
    expect(ieltsDraftFor("guest", NOW)).toBeNull();
    expect(vocabularyDraftFor("guest")).toBeNull();
  });
});

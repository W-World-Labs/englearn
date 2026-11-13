import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as React from "react";
import { Route } from "@/src/app/test";
import { addXp } from "@/lib/gamification/store";
import {
  abandonTestSession,
  createTestSession,
  fetchSessionResume,
  scoreOpenItem,
  submitTestResponse,
} from "./api";
import {
  clearStoredSessionId,
  getStoredSessionId,
  setStoredSessionId,
} from "./active-session";
import type { ClientItem, ClientResponse } from "@/lib/types";

const hooks = vi.hoisted(() => ({
  cursor: 0,
  slots: [] as { value?: unknown; deps?: unknown[]; cleanup?: () => void }[],
  effects: [] as (() => void)[],
  navigate: vi.fn(),
}));

// Drive the real page's callbacks and effect cleanup without a browser. Keeping
// hook slots across renders lets requests settle in any order around unmount.
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useRef: (current: unknown) => {
    const index = hooks.cursor++;
    return (hooks.slots[index] ??= { value: { current } }).value;
  },
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    const slot = hooks.slots[index] ??= {
      value: typeof initial === "function" ? initial() : initial,
    };
    return [slot.value, (next: unknown) => {
      slot.value = typeof next === "function" ? next(slot.value) : next;
    }];
  },
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    const index = hooks.cursor++;
    const previous = hooks.slots[index];
    if (previous && deps.every((value, i) => value === previous.deps?.[i])) return;
    hooks.effects.push(() => {
      previous?.cleanup?.();
      hooks.slots[index] = { deps, cleanup: effect() || undefined };
    });
  },
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options, useSearch: () => ({}) }),
  useNavigate: () => hooks.navigate,
  Link: "a",
}));
vi.mock("@/lib/i18n/context", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    courseName: () => "English",
    learningLanguage: "en",
    locale: "en",
    setLearningLanguage: vi.fn(),
  }),
}));
vi.mock("./api", () => ({
  abandonTestSession: vi.fn(),
  createTestSession: vi.fn(),
  fetchSessionResume: vi.fn(),
  scoreOpenItem: vi.fn(),
  submitTestResponse: vi.fn(),
}));
vi.mock("./active-session", () => ({
  clearStoredSessionId: vi.fn(),
  getStoredSessionId: vi.fn(),
  setStoredSessionId: vi.fn(),
}));
vi.mock("@/lib/gamification/store", () => ({
  addXp: vi.fn(),
  recordAnswerXp: () => 3,
}));

type Element = React.ReactElement<Record<string, unknown>>;
const item = { id: "question", module: "grammar", format: "mcq" } as ClientItem;
const started = { sessionId: "alice-session", item, currentModule: "grammar" as const };
const completed = {
  item: null,
  currentModule: "grammar" as const,
  moduleDone: true,
  done: true,
  lastGrade: { itemId: item.id, correct: true, module: "grammar" as const, format: "mcq" as const },
};
const answer: ClientResponse = { itemId: item.id, selectedIndex: 0 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
function render() {
  hooks.cursor = 0;
  const Page = Route.options.component as () => Element;
  const tree = Page();
  for (const effect of hooks.effects.splice(0)) effect();
  return tree;
}
function unmount() {
  for (const slot of hooks.slots) slot.cleanup?.();
}
function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!React.isValidElement(value)) return [];
  const node = value as Element;
  return [node, ...elements(node.props.children)];
}
function containsText(value: unknown, label: string): boolean {
  if (value === label) return true;
  if (Array.isArray(value)) return value.some((child) => containsText(child, label));
  return React.isValidElement(value) && containsText((value as Element).props.children, label);
}
function click(tree: Element, label: string) {
  const node = elements(tree).find((element) =>
    typeof element.props.onClick === "function" && containsText(element.props.children, label));
  expect(node).toBeDefined();
  return (node!.props.onClick as () => Promise<void>)();
}
function respond(tree: Element) {
  const node = elements(tree).find((element) => typeof element.props.onAnswer === "function");
  expect(node).toBeDefined();
  return (node!.props.onAnswer as (response: ClientResponse) => Promise<void>)(answer);
}
async function running(open = false) {
  vi.mocked(createTestSession).mockResolvedValue({
    ...started,
    item: open ? { ...item, format: "open" } : item,
  });
  render();
  await click(render(), "test.startBtn");
  return render();
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.cursor = 0;
  hooks.slots = [];
  hooks.effects = [];
  vi.mocked(getStoredSessionId).mockReturnValue(null);
  vi.stubGlobal("window", {
    setTimeout: vi.fn(),
    setInterval: vi.fn(),
    clearInterval: vi.fn(),
  });
});
afterEach(() => {
  unmount();
  vi.unstubAllGlobals();
});

it("does not replace another page's resume link when session creation resolves after unmount", async () => {
  const creation = deferred<typeof started>();
  vi.mocked(createTestSession).mockReturnValue(creation.promise);
  render();
  const pending = click(render(), "test.startBtn");
  unmount();
  creation.resolve(started);
  await pending;
  expect(setStoredSessionId).not.toHaveBeenCalled();
});

it("does not clear another page's resume link when abandonment resolves after unmount", async () => {
  vi.mocked(getStoredSessionId).mockReturnValue(started.sessionId);
  vi.mocked(fetchSessionResume).mockResolvedValue({
    ...started, modules: ["grammar"], moduleCounts: { grammar: 0 },
  });
  render();
  await Promise.resolve();
  const deletion = deferred<boolean>();
  vi.mocked(abandonTestSession).mockReturnValue(deletion.promise);
  const pending = click(render(), "test.abandonBtn");
  unmount();
  deletion.resolve(true);
  await pending;
  expect(clearStoredSessionId).not.toHaveBeenCalled();
});

it("does not award XP, clear a resume link or navigate for an answer completed after unmount", async () => {
  const tree = await running();
  const submission = deferred<typeof completed>();
  vi.mocked(submitTestResponse).mockReturnValue(submission.promise);
  const pending = respond(tree);
  unmount();
  submission.resolve(completed);
  await pending;
  expect(addXp).not.toHaveBeenCalled();
  expect(clearStoredSessionId).not.toHaveBeenCalled();
  expect(hooks.navigate).not.toHaveBeenCalled();
});

it("does not submit an open answer after scoring resolves for an unmounted account page", async () => {
  const tree = await running(true);
  const scoring = deferred<{ score: number; feedback: string }>();
  vi.mocked(scoreOpenItem).mockReturnValue(scoring.promise);
  const pending = respond(tree);
  unmount();
  scoring.resolve({ score: 0.8, feedback: "Good response" });
  await pending;
  expect(submitTestResponse).not.toHaveBeenCalled();
  expect(addXp).not.toHaveBeenCalled();
});

it("still awards completed answers and opens results while the page is active", async () => {
  const tree = await running();
  vi.mocked(submitTestResponse).mockResolvedValue(completed);
  await respond(tree);
  expect(setStoredSessionId).toHaveBeenCalledWith(started.sessionId);
  expect(addXp).toHaveBeenCalledWith(3);
  expect(clearStoredSessionId).toHaveBeenCalledOnce();
  expect(hooks.navigate).toHaveBeenCalledOnce();
});

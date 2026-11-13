import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/client/api";
import { useExamCloud } from "./useExamCloud";

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
}));
// The hook's asynchronous work only needs mounted refs, state setters and
// effects. Drive those explicitly so request ordering is deterministic.
vi.mock("react", () => ({
  useRef: (current: unknown) => ({ current }),
  useCallback: (callback: unknown) => callback,
  useState: (initial: unknown) => {
    const index = hooks.states.push(initial) - 1;
    return [initial, (value: unknown) => { hooks.states[index] = value; }];
  },
  useEffect: (effect: () => void | (() => void)) => hooks.effects.push(effect),
}));
vi.mock("@/lib/client/api", () => ({ apiFetch: vi.fn() }));

type Session = { id: string; status: "running"; answers: number[] };
const initial: Session = { id: "grammar-v1", status: "running", answers: [] };
const prefix = "learning:user-alice";
const endpoint = "/api/learning/journal";
const fetchMock = vi.mocked(apiFetch);
let tick: () => void;
let online: () => void;
let cleanups: (() => void)[];
let storage: Map<string, string>;
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

function saved(session: Session, revision = 1) {
  return { session, revision, updatedAt: revision };
}
function history(session: Session | null = initial, revision = 1) {
  return Response.json({
    latest: session && saved(session, revision),
    draft: session && saved(session, revision),
    items: [], total: session ? 1 : 0, page: 1, pageSize: 10, totalPages: 1,
  });
}
function deferred() {
  let resolve!: (response: Response) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Response>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function mount(session: Session | null = initial, account: string | null = "alice") {
  const current = { current: session };
  const commit = vi.fn((next: Session) => { current.current = next; });
  const cloud = useExamCloud<Session, { id: string }>({
    prefix, endpoint, account, loaded: true, session, current, commit,
  });
  for (const effect of hooks.effects) {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  }
  return { cloud, current, commit, status: () => hooks.states[0] };
}
beforeEach(() => {
  hooks.states = [];
  hooks.effects = [];
  cleanups = [];
  storage = new Map();
  fetchMock.mockReset();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal("window", {
    setInterval: (callback: () => void) => { tick = callback; return 1; },
    clearInterval: () => {},
    addEventListener: (_event: string, callback: () => void) => { online = callback; },
    removeEventListener: () => {},
  });
});
afterEach(() => {
  cleanups.forEach((cleanup) => cleanup());
  vi.unstubAllGlobals();
});

it("holds periodic writes until retry restores the current revision", async () => {
  fetchMock.mockResolvedValueOnce(history());
  const { cloud, current, status } = mount();
  await settle();
  const changed: Session = { ...initial, answers: [1] };
  current.current = changed;
  const restore = deferred();
  fetchMock.mockReturnValueOnce(restore.promise);
  fetchMock.mockResolvedValueOnce(Response.json({ attempt: saved(changed, 2) }));
  cloud.retry();
  tick();
  await settle();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(status()).toBe("loading");
  expect(current.current).toEqual(changed);

  restore.resolve(history());
  await settle();
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(JSON.parse(fetchMock.mock.calls[2][1]!.body as string)).toEqual({
    session: changed, revision: 1,
  });
  expect(current.current).toEqual(changed);
  expect(status()).toBe("saved");
});

it("does not restore an older GET over a save already in flight", async () => {
  fetchMock.mockResolvedValueOnce(history());
  const { cloud, current, status } = mount();
  await settle();
  const changed: Session = { ...initial, answers: [1] };
  current.current = changed;
  const write = deferred(), restore = deferred();
  fetchMock.mockReturnValueOnce(write.promise).mockReturnValueOnce(restore.promise);
  tick();
  cloud.retry();
  write.resolve(Response.json({ attempt: saved(changed, 2) }));
  await settle();
  restore.resolve(history());
  await settle();
  expect(current.current).toEqual(changed);
  expect(status()).toBe("saved");
  expect(JSON.parse(storage.get(`${prefix}:${initial.id}:cloud`)!)).toEqual({
    revision: 2, signature: JSON.stringify(changed),
  });
});

it("rehydrates cloud records after an offline initial read", async () => {
  fetchMock.mockRejectedValueOnce(new Error("offline"));
  const { current, status } = mount(null);
  await settle();
  expect(status()).toBe("error");
  fetchMock.mockResolvedValueOnce(history());
  online();
  await settle();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(current.current).toEqual(initial);
  expect(status()).toBe("saved");
});

it("preserves unsynced edits when online recovery finds a newer server revision", async () => {
  const local: Session = { ...initial, answers: [0] };
  storage.set(`${prefix}:${initial.id}:cloud`, JSON.stringify({
    revision: 1, signature: JSON.stringify(initial),
  }));
  fetchMock.mockRejectedValueOnce(new Error("offline"));
  const { current, status } = mount(local);
  await settle();
  fetchMock.mockResolvedValueOnce(history({ ...initial, answers: [1] }, 2));
  online();
  await settle();
  expect(current.current).toEqual(local);
  expect(status()).toBe("conflict");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("ignores a late restore failure after a newer retry succeeds", async () => {
  fetchMock.mockResolvedValueOnce(history());
  const { cloud, current, status } = mount();
  await settle();
  const stale = deferred();
  const latest: Session = { ...initial, answers: [1] };
  fetchMock.mockReturnValueOnce(stale.promise).mockResolvedValueOnce(history(latest, 2));
  cloud.retry();
  cloud.retry();
  await settle();
  stale.reject(new Error("old timeout"));
  await settle();
  expect(current.current).toEqual(latest);
  expect(status()).toBe("saved");
});

it("resumes saving when the local session changes during a restore", async () => {
  const restore = deferred();
  fetchMock.mockReturnValueOnce(restore.promise);
  const { cloud, current, status } = mount();
  const next: Session = { ...initial, id: "next-session", answers: [1] };
  current.current = next;
  restore.resolve(history());
  await settle();
  expect(current.current).toEqual(next);
  expect(status()).toBe("pending");

  fetchMock.mockResolvedValueOnce(Response.json({ attempt: saved(next) }));
  fetchMock.mockResolvedValueOnce(history(next));
  expect(await cloud.flush()).toBe(true);
  expect(current.current).toEqual(next);
  expect(status()).toBe("saved");
});

it("does not let a background history failure interrupt recovery or clear a conflict", async () => {
  fetchMock.mockResolvedValueOnce(history());
  const { cloud, current, status } = mount();
  await settle();
  const background = deferred(), restore = deferred();
  fetchMock.mockReturnValueOnce(background.promise).mockReturnValueOnce(restore.promise);
  const listing = cloud.readHistory(2);
  current.current = { ...initial, answers: [0] };
  cloud.retry();
  background.reject(new Error("history unavailable"));
  await listing;
  expect(status()).toBe("loading");
  restore.resolve(history({ ...initial, answers: [1] }, 2));
  await settle();
  expect(status()).toBe("conflict");

  fetchMock.mockRejectedValueOnce(new Error("history still unavailable"));
  await cloud.readHistory(2);
  expect(status()).toBe("conflict");
  expect(current.current?.answers).toEqual([0]);
});

it("binds history, writes and record opens to the account owning the browser cache", async () => {
  fetchMock.mockResolvedValueOnce(history());
  const { cloud, current } = mount();
  await settle();
  const changed: Session = { ...initial, answers: [1] };
  current.current = changed;
  fetchMock.mockResolvedValueOnce(Response.json({ attempt: saved(changed, 2) }));
  expect(await cloud.flush()).toBe(true);
  fetchMock.mockResolvedValueOnce(Response.json({ attempt: saved(changed, 2) }));
  expect(await cloud.open(initial.id)).toBe(true);
  fetchMock.mockResolvedValueOnce(history(changed, 2));
  await cloud.readHistory(2);

  expect(fetchMock).toHaveBeenCalledTimes(4);
  for (const [, options] of fetchMock.mock.calls)
    expect(new Headers(options?.headers).get("X-LingoLearn-Account")).toBe("alice");
});

it("keeps unsaved Alice work when the cookie has switched to another account", async () => {
  fetchMock.mockResolvedValueOnce(history());
  const { cloud, current, commit, status } = mount();
  await settle();
  commit.mockClear();
  const changed: Session = { ...initial, answers: [1] };
  current.current = changed;
  fetchMock.mockResolvedValueOnce(Response.json({ error: "Account changed" }, { status: 403 }));
  expect(await cloud.flush()).toBe(false);
  expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get("X-LingoLearn-Account")).toBe("alice");
  expect(current.current).toEqual(changed);
  expect(status()).toBe("error");
  expect(commit).not.toHaveBeenCalled();

  fetchMock.mockResolvedValueOnce(Response.json({ error: "Account changed" }, { status: 403 }));
  cloud.retry();
  await settle();
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(new Headers(fetchMock.mock.calls[2][1]?.headers).get("X-LingoLearn-Account")).toBe("alice");
  expect(current.current).toEqual(changed);
  expect(commit).not.toHaveBeenCalled();
  expect(JSON.parse(storage.get(`${prefix}:${initial.id}:cloud`)!)).toEqual({
    revision: 1, signature: JSON.stringify(initial),
  });
});

it("does not send account requests for guest workspaces", async () => {
  const guest = mount(initial, null);
  guest.cloud.retry();
  expect(await guest.cloud.open(initial.id)).toBe(false);
  await settle();
  expect(fetchMock).not.toHaveBeenCalled();

  cleanups.forEach((cleanup) => cleanup());
  await guest.cloud.readHistory();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("ignores late account responses and callbacks after the workspace unmounts", async () => {
  const restore = deferred();
  fetchMock.mockReturnValueOnce(restore.promise);
  const { cloud, commit } = mount();
  cleanups.forEach((cleanup) => cleanup());
  restore.resolve(history());
  await settle();
  cloud.retry();
  tick();
  await settle();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(commit).not.toHaveBeenCalled();
  expect(storage.size).toBe(0);
});

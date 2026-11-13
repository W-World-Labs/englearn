import { afterEach, expect, it, vi } from "vitest";

const esState = vi.hoisted(() => ({ attempts: 0 }));

vi.doMock("./messages/es", () => ({
  get es(): never {
    esState.attempts += 1;
    throw new Error("network down");
  },
}));

afterEach(() => {
  esState.attempts = 0;
  vi.resetModules();
});

it("retries a failed locale chunk instead of caching the rejection", async () => {
  const m = await import("./messages");
  await expect(m.loadLocaleMessages("es")).rejects.toThrow("network down");
  await expect(m.loadLocaleMessages("es")).rejects.toThrow("network down");
  // Each call reached the chunk accessor: the rejected promise was
  // evicted, not replayed. A cached rejection would leave attempts at 1.
  expect(esState.attempts).toBe(2);
});

it("shares one in-flight import across concurrent loads", async () => {
  const m = await import("./messages");
  const [a, b] = [m.loadLocaleMessages("ja"), m.loadLocaleMessages("ja")];
  expect(a).toBe(b);
  await a;
  const tree = m.getMessagesForLocale("ja") as Record<
    string,
    Record<string, string>
  >;
  expect(tree.learn.familyActivity).toBe("アクティビティ練習");
});

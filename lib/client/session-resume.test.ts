import { afterEach, expect, it, vi } from "vitest";
import { fetchSessionResume } from "./api";
afterEach(() => vi.unstubAllGlobals());
it.each([401, 403, 429, 500, 503])(
  "does not treat HTTP %s as a missing bookmark",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status })),
    );
    await expect(fetchSessionResume("saved-id")).rejects.toThrow();
  },
);
it("only treats a confirmed 404 as a missing session", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("{}", { status: 404 })),
  );
  await expect(fetchSessionResume("saved-id")).resolves.toBeNull();
});
it("does not erase a bookmark on invalid JSON or a network outage", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response("broken"))
    .mockRejectedValueOnce(new Error("offline"));
  vi.stubGlobal("fetch", fetch);
  await expect(fetchSessionResume("saved-id")).rejects.toThrow();
  await expect(fetchSessionResume("saved-id")).rejects.toThrow();
  expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
});

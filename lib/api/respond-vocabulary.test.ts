import { afterAll, beforeAll, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
let directory: string;
beforeAll(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "englearn-recognition-"));
  vi.stubEnv("ENGLEARN_DATA_DIR", directory);
});
afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
it.each(["en", "zh", "ja", "ko", "es"])("completes %s vocabulary recognition without exposing its answer keys or emitting the retired word-count heuristic", async (language) => {
  const { handleSessionPost, handleSessionGet } = await import("./session");
  const { handleItemGet } = await import("./item");
  const { handleRespondPost } = await import("./respond");
  const { getResult } = await import("@/lib/db");
  const { getItemById } = await import("@/lib/items");
  const post = (path: string, body: unknown) =>
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const created = await (
    await handleSessionPost(
      post("/api/session", { modules: ["vocabulary"], learningLanguage: language }),
    )
  ).json();
  let item = created.item,
    done = false;
  for (const handler of [handleSessionGet, handleItemGet]) {
    const resumed = await (await handler(new Request(`http://localhost/api/session?sessionId=${created.sessionId}`))).json();
    expect(resumed.item).toEqual(item);
    expect(resumed.item).not.toHaveProperty("isPseudoword");
  }
  for (let i = 0; i < 35 && !done; i++) {
    expect(item).not.toHaveProperty("isPseudoword");
    expect(item).not.toHaveProperty("answerIndex");
    const source = getItemById(item.id, language)!;
    const response = await handleRespondPost(
      post("/api/respond", {
        sessionId: created.sessionId,
        response: { itemId: item.id, selectedYes: !source.isPseudoword },
      }),
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.lastGrade.correct).toBe(true);
    item = data.item;
    done = data.done;
  }
  expect(done).toBe(true);
  const result = getResult(created.sessionId)!;
  expect(result.modules).toHaveLength(1);
  expect(result.modules[0].itemsAdministered).toBeGreaterThan(0);
  expect(result.modules[0]).not.toHaveProperty("vocabularySize");
});

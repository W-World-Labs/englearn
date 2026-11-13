import { beforeAll, afterAll, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
let directory: string;
beforeAll(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "englearn-session-bank-"));
  vi.stubEnv("ENGLEARN_DATA_DIR", directory);
});
afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
const request = (body: unknown) =>
  new Request("http://localhost/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
it.each(["fr", "de", "ar", "sw"])(
  "rejects %s before writing a misleading English session",
  async (language) => {
    const { handleSessionPost } = await import("./session");
    const file = path.join(directory, "sessions.json");
    const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    const result = await handleSessionPost(
      request({ modules: ["grammar"], learningLanguage: language }),
    );
    expect(result.status).toBe(422);
    expect(await result.json()).toMatchObject({
      code: "unsupported_learning_language",
      supportedLanguages: ["en", "zh", "ko", "ja", "es"],
    });
    expect(fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null).toBe(
      before,
    );
  },
);
it.each(["", "english", 7, {}, "invalidlong"])(
  "rejects invalid language %j instead of defaulting to English",
  async (language) => {
    const { handleSessionPost } = await import("./session");
    expect(
      (await handleSessionPost(request({ learningLanguage: language }))).status,
    ).toBe(400);
  },
);
it.each([
  ["en", "en-US"],
  ["zh-CN", "zh-CN"],
  ["KO", "ko-KR"],
  ["ja", "ja-JP"],
  ["es", "es-ES"],
])("starts and resumes real %s content", async (language, contentLang) => {
  const { handleSessionPost, handleSessionGet } = await import("./session");
  const result = await handleSessionPost(
    request({ modules: ["grammar"], learningLanguage: language }),
  );
  expect(result.status).toBe(200);
  const created = await result.json();
  expect(created.item.contentLang).toBe(contentLang);
  expect(created.item).not.toHaveProperty("answerIndex");
  const resumed = await (
    await handleSessionGet(
      new Request(
        `http://localhost/api/session?sessionId=${created.sessionId}`,
      ),
    )
  ).json();
  expect(resumed.learningLanguage).toBe(language.toLowerCase().split("-")[0]);
  expect(resumed.item).toEqual(created.item);
});
it("retains the documented English default when language is omitted", async () => {
  const { handleSessionPost } = await import("./session");
  const result = await (
    await handleSessionPost(request({ modules: ["grammar"] }))
  ).json();
  expect(result.item.contentLang).toBe("en-US");
});
it("leaves legacy fallback sessions readable and unmodified", async () => {
  const { createSession, getSession } = await import("@/lib/db");
  const { getItemsByModule } = await import("@/lib/items");
  const { handleSessionGet } = await import("./session");
  const old = {
    id: randomUUID(),
    learningLanguage: "fr",
    createdAt: new Date().toISOString(),
    modules: ["grammar"] as const,
    currentModule: "grammar" as const,
    administeredItemIds: [getItemsByModule("grammar", "en")[0].id],
    responses: [],
    ability: {},
    finished: false,
  };
  createSession({ ...old, modules: [...old.modules] });
  const response = await handleSessionGet(
    new Request(`http://localhost/api/session?sessionId=${old.id}`),
  );
  expect(response.status).toBe(200);
  expect((await response.json()).item.contentLang).toBe("en-US");
  expect(getSession(old.id)).toEqual(old);
});

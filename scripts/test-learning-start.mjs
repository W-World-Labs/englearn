// UI acceptance uses isolated browser storage and mocked assessment endpoints;
// it is safe against public builds. Real bank and record behavior is covered by API tests.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(
  process.env.ENGLEARN_PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.ENGLEARN_TEST_URL || "http://127.0.0.1:31971";
const output =
  process.env.ENGLEARN_TEST_OUTPUT || "/tmp/englearn-v0100/browser";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [],
  passed = [];
const fixture = {
  sessionId: "learning-start-ui-fixture",
  learningLanguage: "en",
  modules: ["grammar"],
  currentModule: "grammar",
  moduleCounts: { grammar: 1 },
  createdAt: new Date().toISOString(),
  item: {
    id: "ui-fixture-grammar",
    module: "grammar",
    format: "mcq",
    cefr: "A1",
    contentLang: "en-US",
    prompt: "Choose a greeting.",
    options: ["Hello", "Goodbye", "Yesterday", "Soon"],
  },
};
async function pageFor({
  width = 390,
  locale = "en",
  course = "en",
  bookmark = false,
  storageBlocked = false,
} = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 950 },
    reducedMotion: "reduce",
  });
  await context.route("**/platform/bootstrap.js", (r) =>
    r.fulfill({ body: "" }),
  );
  await context.route("**/api/auth/me", (r) =>
    r.fulfill({ json: { configured: true, user: null } }),
  );
  await context.route("**/api/progress", (r) => r.fulfill({ json: {} }));
  const state = { resumeStatus: 200, deleteStatus: 200, posts: [], gets: 0 };
  await context.route("**/api/session**", async (r) => {
    const method = r.request().method();
    if (method === "GET") {
      state.gets++;
      return r.fulfill({
        status: state.resumeStatus,
        json: state.resumeStatus === 200 ? fixture : { error: "unavailable" },
      });
    }
    if (method === "DELETE")
      return r.fulfill({
        status: state.deleteStatus,
        json: { ok: state.deleteStatus === 200 },
      });
    if (method === "POST") {
      const body = r.request().postDataJSON();
      state.posts.push(body);
      return r.fulfill({
        json: {
          ...fixture,
          item: { ...fixture.item, contentLang: body.learningLanguage },
        },
      });
    }
    throw new Error("Unexpected assessment request");
  });
  await context.addInitScript(
    ({ locale, course, bookmark, storageBlocked }) => {
      if (storageBlocked) {
        Object.defineProperty(window, "localStorage", {
          get() {
            throw new DOMException("Disabled", "SecurityError");
          },
        });
        return;
      }
      if (!localStorage.getItem("lingolearn:uiLocale"))
        localStorage.setItem("lingolearn:uiLocale", locale);
      if (!localStorage.getItem("lingolearn:course"))
        localStorage.setItem("lingolearn:course", course);
      if (bookmark && !sessionStorage.getItem("seeded")) {
        localStorage.setItem(
          "englearn:active-session",
          "learning-start-ui-fixture",
        );
        sessionStorage.setItem("seeded", "1");
      }
    },
    { locale, course, bookmark, storageBlocked },
  );
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (e) => errors.push(e.message));
  return { page, state };
}
const fits = async (p) =>
  assert(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "no horizontal page overflow",
  );
const goto = async (p, path = "/") =>
  p.goto(base + path, { waitUntil: "networkidle" });
const selected = async (p, id) =>
  assert.equal(
    await p
      .locator(`button[data-language="${id}"]`)
      .first()
      .getAttribute("aria-pressed"),
    "true",
  );
const start = (p) =>
  p.getByRole("button", { name: "Start lesson →", exact: true });
try {
  for (const [width, locale] of [
    [320, "en"],
    [390, "zh-CN"],
    [390, "zh-TW"],
    [390, "ja"],
    [390, "ko"],
    [390, "es"],
    [390, "ar"],
    [768, "fr"],
    [1440, "en"],
  ]) {
    const { page: p } = await pageFor({ width, locale });
    await goto(p);
    await fits(p);
    assert.equal(await p.getByTestId("home-quick").count(), 1);
    assert(
      (await p.locator('button[data-language="en"]').first().boundingBox()).y <
        600,
      "available courses near top",
    );
    await p.screenshot({
      path: `${output}/home-${locale}-${width}.png`,
      fullPage: true,
    });
    await p.context().close();
  }
  passed.push(
    "Home fits 320–1440 px with seven translated entry flows, French fallback and Arabic RTL",
  );
  for (const [language, exam] of [
    ["en", "ielts"],
    ["zh", "hsk"],
    ["ko", "topik"],
    ["ja", "jlpt"],
    ["es", null],
  ]) {
    const { page: p } = await pageFor();
    await goto(p);
    await p.locator(`button[data-language="${language}"]`).first().click();
    await selected(p, language);
    for (const e of ["ielts", "topik", "hsk", "jlpt"])
      assert.equal(
        await p.locator(`main a[href="/${e}"]`).count(),
        e === exam ? 1 : 0,
      );
    assert.equal(await p.getByLabel("Interface language").inputValue(), "en");
    await p.getByTestId("home-quick").click();
    await p.getByRole("checkbox").first().waitFor();
    assert.equal(await p.getByRole("checkbox", { checked: true }).count(), 2);
    assert.equal(
      await p
        .getByRole("button", {
          name: "Quick Vocab + grammar · ~8 min",
          exact: true,
        })
        .getAttribute("aria-pressed"),
      "true",
    );
    await selected(p, language);
    await p.reload({ waitUntil: "networkidle" });
    await selected(p, language);
    await p.context().close();
  }
  passed.push(
    "Five learning languages preserve interface choice and refresh preferences; only matching exam shown; quick CTA selects two skills",
  );
  {
    const { page: p, state } = await pageFor({ course: "fr" });
    await goto(p);
    assert.equal(await p.getByTestId("home-quick").count(), 0);
    assert.match(
      await p.getByTestId("course-availability").innerText(),
      /do not yet have questions for French/,
    );
    await p
      .getByText("Browse all languages and availability", { exact: true })
      .click();
    await p.getByRole("searchbox").fill("Deutsch");
    assert.equal(await p.locator("details button[data-language]").count(), 1);
    await p.locator('details button[data-language="de"]').click();
    assert.match(
      await p.getByTestId("course-availability").innerText(),
      /German/,
    );
    await p.getByRole("searchbox").fill("no-matching-language");
    await p.getByText(/No matching language/).waitFor();
    await goto(p, "/test");
    assert(await start(p).isDisabled());
    assert.equal(state.posts.length, 0);
    await p.locator('button[data-language="ja"]').first().click();
    assert(await start(p).isEnabled());
    await start(p).click();
    await p.getByText("Choose a greeting.", { exact: true }).waitFor();
    assert.equal(state.posts[0].learningLanguage, "ja");
    assert.deepEqual(state.posts[0].modules, ["vocabulary", "grammar"]);
    await p.context().close();
  }
  passed.push(
    "Search supports native names and empty states; unavailable courses cannot start; explicit supported selection sends the selected language",
  );
  {
    const { page: p } = await pageFor();
    await goto(p, "/test?modules=reading");
    assert.equal(await p.getByRole("checkbox", { checked: true }).count(), 1);
    assert.equal(
      await p
        .getByRole("button", { pressed: true })
        .filter({ hasText: "Six-skill assessment" })
        .count(),
      0,
    );
    await p.context().close();
  }
  passed.push(
    "Single-skill links do not falsely highlight the six-skill preset",
  );
  {
    const { page: p, state } = await pageFor({ bookmark: true, course: "ja" });
    state.resumeStatus = 503;
    await goto(p);
    await p.getByTestId("home-resume").click();
    await p
      .getByRole("button", { name: "Check saved session again", exact: true })
      .waitFor();
    assert.equal(
      await p.evaluate(() => localStorage.getItem("englearn:active-session")),
      fixture.sessionId,
    );
    assert(await start(p).isDisabled());
    state.resumeStatus = 200;
    await p
      .getByRole("button", { name: "Check saved session again", exact: true })
      .click();
    await p
      .getByRole("heading", {
        name: "Unfinished lesson · English",
        exact: true,
      })
      .waitFor();
    assert(await start(p).isDisabled());
    state.deleteStatus = 503;
    await p.getByRole("button", { name: "Abandon & new", exact: true }).click();
    await p
      .getByText("Delete failed. Try again.", { exact: true })
      .waitFor();
    assert.equal(
      await p.evaluate(() => localStorage.getItem("englearn:active-session")),
      fixture.sessionId,
    );
    await p.getByRole("button", { name: "Continue", exact: true }).click();
    await p.getByText("Choose a greeting.", { exact: true }).waitFor();
    assert.equal(
      await p.evaluate(() => localStorage.getItem("lingolearn:course")),
      "en",
    );
    await p.context().close();
  }
  passed.push(
    "Home continuation survives 503; failed abandonment keeps bookmark; successful resume restores original learning language",
  );
  {
    const { page: p, state } = await pageFor({ bookmark: true });
    state.resumeStatus = 403;
    await goto(p, "/test");
    await p
      .getByRole("button", { name: "Check saved session again", exact: true })
      .waitFor();
    assert.equal(
      await p.evaluate(() => localStorage.getItem("englearn:active-session")),
      fixture.sessionId,
    );
    state.resumeStatus = 404;
    await p
      .getByRole("button", { name: "Check saved session again", exact: true })
      .click();
    await p.waitForFunction(
      () => !localStorage.getItem("englearn:active-session"),
    );
    assert(await start(p).isEnabled());
    await p.context().close();
  }
  passed.push(
    "Login failure preserves continuation; confirmed missing session releases stale bookmark",
  );
  {
    const { page: p, state } = await pageFor({ storageBlocked: true });
    await goto(p, "/test");
    await p.getByLabel("Interface language").selectOption("en");
    await p.locator('button[data-language="es"]').first().click();
    await start(p).click();
    await p.getByText("Choose a greeting.", { exact: true }).waitFor();
    assert.equal(state.posts[0].learningLanguage, "es");
    await p.context().close();
  }
  passed.push(
    "With device storage blocked, the in-memory language choice still reaches session creation",
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed, errors }, null, 2));
} finally {
  await browser.close();
}

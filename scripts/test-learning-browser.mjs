// Isolated guest browsers; safe against production. Actual cloud persistence has a separate suite.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir } from "node:fs/promises";
const { chromium } = await import(
  process.env.ENGLEARN_PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.ENGLEARN_TEST_URL || "http://127.0.0.1:31971";
const output =
  process.env.ENGLEARN_TEST_OUTPUT || "/tmp/englearn-v0110/browser";
const course = JSON.parse(
  await readFile(
    new URL("../data/learning/grammar-v1.json", import.meta.url),
    "utf8",
  ),
);
const browser = await chromium.launch({ headless: true }),
  errors = [],
  passed = [];
await mkdir(output, { recursive: true });
async function pageFor({
  language = "en",
  locale = "en",
  width = 390,
  journal,
  blocked = false,
} = {}) {
  const c = await browser.newContext({
    viewport: { width, height: 950 },
    reducedMotion: "reduce",
  });
  await c.route("**/api/auth/me", (r) =>
    r.fulfill({ json: { configured: true, user: null } }),
  );
  await c.route("**/api/progress", (r) => r.fulfill({ json: {} }));
  await c.route("**/platform/bootstrap.js", (r) => r.fulfill({ body: "" }));
  await c.addInitScript(
    ({ language, locale, journal, blocked }) => {
      if (blocked) {
        Object.defineProperty(window, "localStorage", {
          get() {
            throw new DOMException("Disabled", "SecurityError");
          },
        });
        return;
      }
      if (!localStorage.getItem("lingolearn:course"))
        localStorage.setItem("lingolearn:course", language);
      if (!localStorage.getItem("lingolearn:uiLocale"))
        localStorage.setItem("lingolearn:uiLocale", locale);
      if (journal && !sessionStorage.getItem("learning-seeded")) {
        localStorage.setItem(
          "lingolearn:learning:guest",
          JSON.stringify(journal),
        );
        sessionStorage.setItem("learning-seeded", "1");
      }
    },
    { language, locale, journal, blocked },
  );
  const p = await c.newPage();
  p.setDefaultTimeout(12000);
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept());
  return p;
}
const goto = (p, path = "/learn?tab=courses") =>
  p.goto(base + path, { waitUntil: "networkidle" });
const fits = async (p) =>
  assert(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "no page overflow",
  );
const snapshot = (p) =>
  p.evaluate(() =>
    JSON.parse(localStorage.getItem("lingolearn:learning:guest")),
  );
async function answer(p, choice, last = false) {
  await p.getByRole("radio").nth(choice).check();
  await p.getByRole("button", { name: "Check answer", exact: true }).click();
  await p.getByText("Why this form works", { exact: true }).waitFor();
  await p
    .getByRole("button", {
      name: last ? "Finish lesson →" : "Next question →",
      exact: true,
    })
    .click();
}
try {
  for (const [locale, language, width] of [
    ["en", "en", 320],
    ["zh-CN", "zh", 390],
    ["ja", "ja", 390],
    ["ko", "ko", 390],
    ["es", "es", 390],
    ["ar", "en", 390],
    ["en", "en", 768],
    ["es", "es", 1024],
    ["en", "en", 1440],
  ]) {
    const p = await pageFor({ locale, language, width });
    await goto(p);
    await fits(p);
    assert.equal(
      await p.getByTestId("learning-lesson").count(),
      language === "en" ? 24 : 12,
    );
    await p.screenshot({
      path: `${output}/courses-${locale}-${width}.png`,
      fullPage: true,
    });
    await goto(p, "/learn?tab=library");
    await fits(p);
    await p.getByTestId("book-text").waitFor();
    await fits(p);
    await p.context().close();
  }
  passed.push(
    "Five language courses, translated navigation, RTL fallback, library and responsive layouts at 320–1440px",
  );
  for (const language of ["en", "zh", "ja", "ko", "es"]) {
    const p = await pageFor({ language, width: 390 });
    await goto(p);
    await p.getByRole("button", { name: "Advanced", exact: true }).click();
    assert.equal(
      await p.getByTestId("learning-lesson").count(),
      language === "en" ? 8 : 4,
    );
    await p.getByRole("button", { name: "All stages", exact: true }).click();
    const lesson = course.lessons.find((l) => l.language === language);
    await p
      .getByRole("searchbox", { name: "Search lessons" })
      .fill(lesson.title.en);
    assert.equal(await p.getByTestId("learning-lesson").count(), 1);
    await p.getByTestId("learning-lesson").click();
    await p
      .getByRole("button", { name: "Practise this lesson →", exact: true })
      .click();
    await answer(p, (lesson.questions[0].answer + 1) % 3);
    await p.reload({ waitUntil: "networkidle" });
    assert.equal((await snapshot(p)).draft.answers.length, 1);
    for (let i = 1; i < 4; i++)
      await answer(p, lesson.questions[i].answer, i === 3);
    await p
      .getByRole("heading", { name: "Lesson complete", exact: true })
      .waitFor();
    await fits(p);
    const s = await snapshot(p);
    assert.equal(s.events.length, 1);
    assert.equal(s.draft, null);
    await goto(p, "/learn?tab=history");
    await p.getByTestId("learning-round").locator("summary").click();
    assert.equal(
      await p.getByTestId("learning-round").locator("li").count(),
      4,
    );
    await p.reload({ waitUntil: "networkidle" });
    assert.equal(await p.getByTestId("learning-round").count(), 1);
    await p.context().close();
  }
  passed.push(
    "Every language: stage/search, intentional error feedback, checked-answer resume, completion and persistent answer history",
  );
  const p = await pageFor();
  await goto(p, "/learn?tab=library");
  await p.getByRole("spinbutton").fill("27");
  await p.getByRole("button", { name: "Go to page", exact: true }).click();
  await p.reload({ waitUntil: "networkidle" });
  assert.equal(await p.getByRole("spinbutton").inputValue(), "27");
  await p.getByTestId("book-text").filter({ hasText: "Mr. Morton" }).waitFor();
  await p.getByRole("button", { name: "Original PDF", exact: true }).click();
  assert((await p.locator("iframe").getAttribute("src")).endsWith("#page=27"));
  await p.getByRole("button", { name: "Read text", exact: true }).click();
  const pdf = await p.request.get(base + "/api/library/book?id=brehe-grammar", {
    headers: { Range: "bytes=0-7" },
  });
  assert.equal(pdf.status(), 206);
  assert((await pdf.body()).toString().startsWith("%PDF-"));
  const downloadEvent = p.waitForEvent("download");
  await p.getByRole("link", { name: "Download PDF", exact: true }).click();
  const downloaded = await downloadEvent;
  assert.equal(downloaded.suggestedFilename(), "brehes-grammar-anatomy.pdf");
  assert.equal(
    createHash("sha256")
      .update(await readFile(await downloaded.path()))
      .digest("hex"),
    "c757c4641bc390b2ba787adb4b6db65148eb88b0ad7056857b97e10a154168b7",
  );
  const courseDownload = p.waitForEvent("download");
  await p
    .getByRole("button", {
      name: "Download the open course content",
      exact: true,
    })
    .click();
  assert.deepEqual(
    JSON.parse(await readFile(await (await courseDownload).path(), "utf8")),
    course,
  );
  await p.screenshot({
    path: `${output}/library-bookmark.png`,
    fullPage: true,
  });
  await p.context().close();
  passed.push(
    "Readable text edition, original PDF ranges/download and page bookmark retained after reload",
  );
  const failedBook = await pageFor();
  await failedBook
    .context()
    .route("**/api/library/book?*format=text", (r) =>
      r.fulfill({ status: 503, body: "unavailable" }),
    );
  await goto(failedBook, "/learn?tab=library");
  await failedBook
    .getByRole("alert")
    .filter({ hasText: "The text could not be loaded" })
    .waitFor();
  assert(
    await failedBook
      .getByRole("link", { name: "Download PDF", exact: true })
      .isVisible(),
  );
  await failedBook.context().unroute("**/api/library/book?*format=text");
  await failedBook.getByRole("alert").getByRole("button").click();
  await failedBook.getByTestId("book-text").waitFor();
  await failedBook.context().close();
  passed.push(
    "Text reader failure offers retry and independent original-PDF fallback",
  );
  const old = Date.now() - 3 * 86400000,
    lesson = course.lessons[0];
  const journal = {
    id: "grammar-v1",
    course: "grammar-v1",
    startedAt: old,
    status: "running",
    draft: null,
    bookPage: 1,
    events: Array.from({ length: 12 }, (_, i) => ({
      id: `past-${i}`,
      lessonId: lesson.id,
      at: old + i,
      answers: lesson.questions.map((q) => q.answer),
    })),
  };
  const due = await pageFor({ journal });
  await goto(due, "/learn?tab=review");
  assert.equal(await due.getByTestId("learning-lesson").count(), 1);
  await goto(due, "/learn?tab=history");
  assert.equal(await due.getByTestId("learning-round").count(), 10);
  await due.getByRole("button", { name: "Next", exact: true }).click();
  assert.equal(await due.getByTestId("learning-round").count(), 2);
  await due.context().close();
  const blocked = await pageFor({ blocked: true });
  await goto(blocked, "/learn?lesson=en-be");
  await blocked
    .getByRole("combobox", { name: "Interface language" })
    .selectOption("en");
  await blocked
    .getByRole("button", { name: "Practise this lesson →", exact: true })
    .click();
  await answer(blocked, 0);
  assert(await blocked.getByRole("alert").isVisible());
  await blocked.context().close();
  passed.push(
    "Due queue, paginated history and in-memory practice when browser storage is blocked",
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed, pageErrors: errors }, null, 2));
} finally {
  await browser.close();
}

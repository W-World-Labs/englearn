// UI acceptance using isolated guest data; safe against local or public deployments.
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.ENGLEARN_PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.ENGLEARN_TEST_URL || "http://127.0.0.1:31971";
const output =
  process.env.ENGLEARN_TEST_OUTPUT || "/tmp/englearn-ui/acceptance";
const reading = JSON.parse(
  await readFile(
    new URL("../data/ielts/reading.json", import.meta.url),
    "utf8",
  ),
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
async function pageFor(width = 1440, locale = "en", session) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
  });
  await context.route("**/platform/bootstrap.js", (r) =>
    r.fulfill({ body: "" }),
  );
  await context.route("**/api/auth/me", (r) =>
    r.fulfill({ json: { configured: true, user: null } }),
  );
  await context.addInitScript(
    ({ locale, session }) => {
      localStorage.setItem("lingolearn:uiLocale", locale);
      if (session)
        localStorage.setItem(
          "lingolearn:ielts:guest:academic-practice-01-v1",
          JSON.stringify(session),
        );
    },
    { locale, session },
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/ielts`, { waitUntil: "networkidle" });
  return page;
}
async function noOverflow(page) {
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  ) {
    await page.screenshot({ path: `${output}/overflow.png`, fullPage: true });
    console.log(
      await page.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 10)
          .map((el) => ({
            tag: el.tagName,
            cls: el.className,
            right: el.getBoundingClientRect().right,
          })),
      ),
    );
  }
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Page must fit the viewport",
  );
}
const finished = {
  examId: "academic-practice-01-v1",
  id: "ui-review-fixture",
  mode: "full",
  startedAt: Date.now() - 200000,
  deadline: Date.now() - 1000,
  completedAt: Date.now() - 1000,
  sectionIndex: 2,
  partIndex: 0,
  status: "finished",
  answers: {
    q1: reading.questions[0].correctAnswer,
    q2: "wrong answer",
    "task-1": "The figures show a shift towards public transport.",
  },
  flags: [],
  notes: {},
  highlights: {},
};
try {
  for (const width of [320, 390, 768, 1440]) {
    for (const locale of ["en", "zh-CN"]) {
      const page = await pageFor(width, locale);
      const brand = page.locator("header > a");
      assert.equal(await brand.innerText(), "L\nLingoLearn");
      assert(
        await brand.evaluate((el) => el.scrollWidth <= el.clientWidth),
        "Brand must remain fully readable",
      );
      assert.equal(
        await page.locator("header a button").count(),
        0,
        "Navigation must not nest interactive elements",
      );
      assert.equal(
        await page
          .locator('header nav a[aria-current="page"]')
          .getAttribute("href"),
        "/exams",
      );
      await noOverflow(page);
      if (locale === "zh-CN" && [390, 1440].includes(width))
        await page.screenshot({
          path: `${output}/lobby-${width}.png`,
          fullPage: true,
        });
      await page.context().close();
    }
  }
  const page = await pageFor(1440, "en", finished);
  await page.getByRole("button", { name: "View review", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your test review", exact: true })
    .waitFor();
  const overview = page.getByLabel("Section overview");
  await overview.getByRole("button", { name: /^Reading/ }).click();
  const map = page.getByRole("navigation", { name: "Review question map" });
  assert.equal(await map.getByRole("button").count(), 40);
  await map
    .getByRole("button", { name: "Question 2, Incorrect", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "review-q2",
  );
  await page
    .locator("#review-q2")
    .getByRole("button", { name: "Question map ↑" })
    .click();
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "review-question-map",
  );
  await page
    .getByRole("button", { name: "Incorrect (incl. blank) 39", exact: true })
    .click();
  assert.equal(await map.getByRole("button").count(), 39);
  assert.equal(await page.locator("#review-q1").count(), 0);
  await page
    .getByRole("button", { name: "Unanswered 38", exact: true })
    .click();
  assert.equal(await map.getByRole("button").count(), 38);
  await overview.getByRole("button", { name: /^Listening/ }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "All 40", exact: true })
      .getAttribute("aria-pressed"),
    "true",
    "Changing skills resets the filter",
  );
  await overview.getByRole("button", { name: /^Reading/ }).click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${output}/review-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await page.screenshot({ path: `${output}/review-mobile.png` });
  await overview.getByRole("button", { name: /^Writing/ }).click();
  await page
    .getByText("View task and material", { exact: true })
    .first()
    .click();
  const table = page.getByRole("table", {
    name: "Journeys to work in Westbridge (%)",
  });
  await table.waitFor();
  assert.equal(await table.getByRole("row").count(), 5);
  assert.equal(
    await table.getByRole("cell", { name: "58", exact: true }).count(),
    1,
  );
  await noOverflow(page);
  assert(
    await table.evaluate(
      (el) => el.parentElement.scrollWidth <= el.parentElement.clientWidth,
    ),
    "Writing source table must fit on mobile",
  );
  await table.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/writing-review-mobile.png` });
  await page.context().close();

  const perfect = await pageFor(390, "en", {
    ...finished,
    mode: "reading",
    sectionIndex: 0,
    answers: Object.fromEntries(
      reading.questions.map((q) => [q.id, q.correctAnswer]),
    ),
  });
  await perfect
    .getByRole("button", { name: "View review", exact: true })
    .click();
  await perfect
    .getByRole("button", { name: "Incorrect (incl. blank) 0", exact: true })
    .click();
  await perfect
    .getByRole("heading", { name: "Every answer is correct", exact: true })
    .waitFor();
  await perfect
    .getByRole("button", { name: "Unanswered 0", exact: true })
    .click();
  await perfect
    .getByRole("heading", { name: "No unanswered questions", exact: true })
    .waitFor();
  await perfect
    .getByRole("button", { name: "Show all answers", exact: true })
    .click();
  assert.equal(
    await perfect
      .getByRole("navigation", { name: "Review question map" })
      .getByRole("button")
      .count(),
    40,
  );
  assert.deepEqual(errors, [], "No browser or hydration errors");
  console.log(
    "PASS: responsive bilingual header, accessible navigation, review filters/counts, question focus/return, section reset, empty states and writing source table",
  );
} finally {
  await browser.close();
}

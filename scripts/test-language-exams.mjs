import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(
  process.env.ENGLEARN_PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.ENGLEARN_TEST_URL || "http://127.0.0.1:31971";
const output = process.env.ENGLEARN_TEST_OUTPUT || "/tmp/englearn-languages";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [],
  passed = [];
async function pageFor(
  path = "/hsk",
  width = 1440,
  locale = "en",
  course = "zh",
) {
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
  await context.route("**/api/progress", (r) => r.fulfill({ json: {} }));
  await context.addInitScript(
    ({ locale, course }) => {
      localStorage.setItem("lingolearn:uiLocale", locale);
      localStorage.setItem("lingolearn:course", course);
      Object.defineProperty(window, "speechSynthesis", {
        value: { getVoices: () => [] },
      });
    },
    { locale, course },
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto(base + path, { waitUntil: "networkidle" });
  return page;
}
async function stored(page, family = "hsk") {
  return page.evaluate((family) => {
    const key = Object.keys(localStorage).find(
      (k) => k === `lingolearn:exams:${family}:guest`,
    );
    return key ? JSON.parse(localStorage.getItem(key)) : null;
  }, family);
}
async function start(page, skill = "Reading") {
  await page
    .getByRole("button", { name: `Start practice ${skill}`, exact: true })
    .click();
  if (await page.getByRole("dialog").isVisible())
    await page
      .getByRole("button", { name: "Confirm submission", exact: true })
      .click();
  assert.equal(await page.getByRole("timer").count(), 0);
  if (skill === "Listening") {
    assert(
      await page.getByLabel("I can hear the sample clearly.").isDisabled(),
    );
    await page.getByRole("button", { name: "Play audio", exact: true }).click();
    await page.getByLabel("I can hear the sample clearly.").check();
  }
  await page
    .getByLabel("I understand the timing and submission rules.")
    .check();
  await page
    .getByRole("button", { name: "Begin timed practice", exact: true })
    .click();
  await page.getByRole("timer", { name: "Time remaining" }).waitFor();
}
async function submit(page) {
  await page
    .getByRole("button", { name: "Submit section", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm submission", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Your practice review", exact: true })
    .waitFor();
}
async function fits(page) {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "No horizontal page overflow",
  );
}
try {
  for (const family of ["topik", "hsk"]) {
    for (const [width, locale] of [
      [320, "en"],
      [390, "zh-CN"],
      [768, "ko"],
      [1440, "en"],
    ]) {
      const page = await pageFor(`/${family}`, width, locale);
      await page
        .getByRole("heading", { name: family.toUpperCase(), exact: true })
        .waitFor();
      await fits(page);
      const expected = family === "topik" ? 2 : 6;
      assert.equal(
        await page.locator("section[aria-label] button[aria-pressed]").count(),
        expected,
      );
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: `${output}/${family}-lobby-${width}.png`,
          fullPage: true,
        });
      await page.context().close();
    }
  }
  const home = await pageFor("/", 390, "en", "ko");
  const centre = home.getByRole("region", { name: "Exam centre", exact: true });
  assert.equal(
    await centre.locator("div.grid > a").first().getAttribute("href"),
    "/topik",
  );
  await centre.getByRole("link", { name: /TOPIK I/ }).click();
  assert.equal(new URL(home.url()).pathname, "/topik");
  await home.context().close();
  passed.push(
    "Responsive Chinese/English/Korean modules, eight level selectors and Korean-course home entry",
  );
  const read = await pageFor("/topik");
  await start(read);
  await read.getByRole("radio", { name: "A 에", exact: true }).check();
  await read
    .getByRole("button", { name: "Mark for review ⚑", exact: true })
    .click();
  const first = await stored(read, "topik");
  assert.equal(first.answers.r1, "A");
  assert(first.flags.includes("r1"));
  await read.getByRole("button", { name: "Next →", exact: true }).click();
  await read.getByRole("radio", { name: "B 취미", exact: true }).check();
  await read.reload({ waitUntil: "networkidle" });
  await read
    .getByRole("button", { name: "Resume practice", exact: true })
    .click();
  assert.equal((await stored(read, "topik")).deadline, first.deadline);
  assert.equal((await stored(read, "topik")).answers.r2, "B");
  await read.screenshot({ path: `${output}/topik-reading.png` });
  await submit(read);
  await read
    .getByRole("button", { name: "Incorrect / blank", exact: true })
    .click();
  assert.equal(await read.locator("article").count(), 6);
  const download = read.waitForEvent("download");
  await read
    .getByRole("button", { name: "Download answers ↓", exact: true })
    .click();
  assert((await download).suggestedFilename().endsWith(".txt"));
  await read.context().close();
  passed.push(
    "TOPIK answers, flags, navigation, immutable refresh clock, filtered review and answer download",
  );
  const writing = await pageFor();
  await writing.getByRole("button", { name: "HSK 3", exact: true }).click();
  await start(writing, "Writing");
  await writing
    .getByRole("textbox", { name: "Your answer", exact: true })
    .fill("我每天学习汉语。");
  await writing.getByRole("button", { name: "Next →", exact: true }).click();
  await writing
    .getByRole("textbox", { name: "Your answer", exact: true })
    .fill("请把那本书给我");
  await submit(writing);
  assert((await writing.locator("main").innerText()).includes("2 / 4"));
  await writing.screenshot({ path: `${output}/hsk-review.png` });
  await writing.context().close();
  const korean = await pageFor("/topik", 390);
  await korean.getByRole("button", { name: "TOPIK II", exact: true }).click();
  await start(korean, "Writing");
  const essay = korean.getByRole("textbox", {
    name: "Your answer",
    exact: true,
  });
  await essay.fill("죄송합니다. 다음 수업은 언제입니까?");
  assert.equal(await essay.getAttribute("spellcheck"), "false");
  await fits(korean);
  await submit(korean);
  assert(
    (await korean.locator("main").innerText()).includes("Requires review"),
  );
  await korean.context().close();
  passed.push(
    "HSK sentence-order grading and Korean writing input with explicit ungraded review",
  );
  const summary = await pageFor();
  await summary.getByRole("button", { name: "HSK 6", exact: true }).click();
  await start(summary, "Writing");
  assert(
    await summary
      .getByRole("textbox", { name: "Your answer", exact: true })
      .isDisabled(),
  );
  await summary.getByTestId("practice-passage").waitFor();
  await summary.evaluate(() => {
    const key = "lingolearn:exams:hsk:guest",
      s = JSON.parse(localStorage.getItem(key));
    s.startedAt -= 92000;
    s.deadline -= 92000;
    localStorage.setItem(key, JSON.stringify(s));
  });
  await summary.reload({ waitUntil: "networkidle" });
  await summary
    .getByRole("button", { name: "Resume practice", exact: true })
    .click();
  assert.equal(await summary.getByTestId("practice-passage").count(), 0);
  assert(
    await summary
      .getByRole("textbox", { name: "Your answer", exact: true })
      .isEnabled(),
  );
  await summary
    .getByRole("textbox", { name: "Your answer", exact: true })
    .fill("图书馆通过了解居民需求调整服务。");
  await summary.evaluate(() => {
    const key = "lingolearn:exams:hsk:guest",
      s = JSON.parse(localStorage.getItem(key));
    s.deadline = Date.now() + 1200;
    localStorage.setItem(key, JSON.stringify(s));
  });
  await summary.reload({ waitUntil: "networkidle" });
  await summary
    .getByRole("button", { name: "Resume practice", exact: true })
    .click();
  await summary
    .getByRole("heading", { name: "Your practice review", exact: true })
    .waitFor({ timeout: 6000 });
  assert.equal((await stored(summary)).status, "finished");
  await summary.context().close();
  passed.push(
    "HSK 6 timed source hiding, writing unlock and automatic submission",
  );
  for (const family of ["topik", "hsk"]) {
    const listening = await pageFor(`/${family}`, 390, "en");
    await start(listening, "Listening");
    assert.equal(
      await listening
        .getByText(
          family === "topik"
            ? "오늘은 월요일입니다. 내일 한국어 시험이 있습니다."
            : "现在是上午九点。",
          { exact: true },
        )
        .count(),
      0,
      "Transcript must not be displayed while answering",
    );
    await listening
      .getByRole("button", { name: "Play audio", exact: true })
      .click();
    await listening
      .getByRole("button", { name: "Replay audio", exact: true })
      .waitFor();
    assert(
      (await listening.locator("audio").getAttribute("src")).includes(
        `${family === "topik" ? "topik-i" : "hsk-1"}-01-v1`,
      ),
    );
    assert(
      await listening
        .locator("audio")
        .evaluate((a) => a.duration > 1 && a.currentTime > 0),
    );
    await listening
      .getByRole("combobox", { name: "Playback speed", exact: true })
      .selectOption("0.75");
    assert.equal(
      await listening.locator("audio").evaluate((a) => a.playbackRate),
      0.75,
    );
    await fits(listening);
    await listening.context().close();
  }
  const unavailable = await pageFor("/topik");
  await unavailable.route("**/api/exams/audio?**", (r) =>
    r.fulfill({ status: 503, body: "Temporary audio failure" }),
  );
  await unavailable
    .getByRole("button", { name: "Start practice Listening", exact: true })
    .click();
  await unavailable
    .getByRole("alert")
    .filter({ hasText: "Audio could not play" })
    .waitFor();
  assert(
    await unavailable.getByLabel("I can hear the sample clearly.").isDisabled(),
  );
  await unavailable.unroute("**/api/exams/audio?**");
  await unavailable.getByRole("button", { name: "Retry", exact: true }).click();
  await unavailable.getByLabel("I can hear the sample clearly.").check();
  await unavailable.context().close();
  passed.push(
    "Real bundled Chinese/Korean audio plays without device voices; speed control and failed sound-check recovery work",
  );
  assert.deepEqual(errors, [], "No browser or hydration errors");
  console.log(
    JSON.stringify({ passed, browserErrors: errors, output }, null, 2),
  );
} finally {
  await browser.close();
}

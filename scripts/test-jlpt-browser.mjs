import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.ENGLEARN_PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.ENGLEARN_TEST_URL || "http://127.0.0.1:31971";
const output = process.env.ENGLEARN_TEST_OUTPUT || "/tmp/englearn-v050/browser";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [],
  passed = [];
async function pageFor(width = 1440, locale = "en", path = "/jlpt") {
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
  await context.addInitScript((locale) => {
    localStorage.setItem("lingolearn:uiLocale", locale);
    localStorage.setItem("lingolearn:course", "ja");
    Object.defineProperty(window, "speechSynthesis", {
      value: { getVoices: () => [] },
    });
  }, locale);
  const p = await context.newPage();
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept());
  await p.goto(base + path, { waitUntil: "networkidle" });
  return p;
}
async function fits(p) {
  assert(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "Page fits viewport",
  );
}
async function stored(p) {
  return p.evaluate(() =>
    JSON.parse(localStorage.getItem("lingolearn:exams:jlpt:guest")),
  );
}
async function start(p, skill, listening = false) {
  await p
    .getByRole("button", {
      name:
        skill === "Mixed practice"
          ? "Start practice →"
          : `Start practice ${skill}`,
      exact: true,
    })
    .click();
  if (listening) {
    assert(await p.getByLabel("I can hear the sample clearly.").isDisabled());
    await p.getByRole("button", { name: "Play audio", exact: true }).click();
    await p
      .getByLabel("I can hear the sample clearly.")
      .check({ timeout: 20000 });
  }
  await p.getByLabel("I understand the timing and submission rules.").check();
  await p
    .getByRole("button", { name: "Begin timed practice", exact: true })
    .click();
  await p.getByRole("timer").waitFor();
}
async function submit(p) {
  await p.getByRole("button", { name: "Submit section", exact: true }).click();
  await p
    .getByRole("button", { name: "Confirm submission", exact: true })
    .click();
}
try {
  for (const [width, locale] of [
    [320, "en"],
    [390, "zh-CN"],
    [390, "ja"],
    [1440, "ja"],
  ]) {
    const p = await pageFor(width, locale);
    await p.getByRole("heading", { name: "JLPT", exact: true }).waitFor();
    assert.equal(
      await p.locator("section[aria-label] button[aria-pressed]").count(),
      5,
    );
    await fits(p);
    await p.screenshot({
      path: `${output}/jlpt-${locale}-${width}.png`,
      fullPage: true,
    });
    await p.getByRole("button", { name: "JLPT N1", exact: true }).click();
    await fits(p);
    if (locale === "ja") {
      await p
        .getByRole("button", { name: "練習を開始 言語知識・読解", exact: true })
        .waitFor();
      await p.screenshot({
        path: `${output}/jlpt-n1-${width}.png`,
        fullPage: true,
      });
    }
    await p.context().close();
  }
  const home = await pageFor(390, "en", "/");
  assert.equal(
    await home
      .getByRole("region", { name: "Exam centre", exact: true })
      .locator("div.grid > a")
      .first()
      .getAttribute("href"),
    "/jlpt",
  );
  await home.goto(base + "/exams", { waitUntil: "networkidle" });
  for (const path of ["/ielts", "/topik", "/hsk", "/jlpt"])
    assert(await home.locator(`main a[href="${path}"]`).count());
  await fits(home);
  await home.context().close();
  passed.push(
    "Five levels and four exam entries fit 320–1440 px in English, Chinese and Japanese; Japanese course prioritizes JLPT",
  );

  const p = await pageFor();
  assert.equal(
    await p
      .getByRole("button", { name: "Start practice Writing", exact: true })
      .count(),
    0,
  );
  await start(p, "Vocabulary");
  await p.getByRole("radio", { name: "1 あめ", exact: true }).check();
  await p
    .getByRole("button", { name: "Mark for review ⚑", exact: true })
    .click();
  const first = await stored(p);
  assert.equal(first.answers.v1, "A");
  assert(first.flags.includes("v1"));
  await p.getByRole("button", { name: "Next →", exact: true }).click();
  await p.getByRole("radio").nth(3).check();
  await p.reload({ waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Resume practice", exact: true }).click();
  assert.equal((await stored(p)).deadline, first.deadline);
  assert.equal((await stored(p)).answers.v2, "D");
  await submit(p);
  await p
    .getByRole("heading", { name: "Your practice review", exact: true })
    .waitFor();
  assert((await p.locator("main").innerText()).includes("1 · あめ"));
  const original = await stored(p);
  const download = p.waitForEvent("download");
  await p
    .getByRole("button", { name: "Download answers ↓", exact: true })
    .click();
  const text = await readFile(await (await download).path(), "utf8");
  assert(text.includes("1 · あめ") && text.includes("scaled score"));
  await p
    .getByRole("button", { name: "Retry mistakes →", exact: true })
    .click();
  await p.getByRole("radio").first().check();
  await p.getByRole("button", { name: "Check answer", exact: true }).click();
  assert(await p.getByRole("radio").first().isDisabled());
  assert.deepEqual(await stored(p), original);
  await p.context().close();
  passed.push(
    "Numbered options retain compatible answers, flags and deadline across refresh; review/download and corrections preserve the submitted record",
  );

  const mixed = await pageFor();
  await start(mixed, "Mixed practice", true);
  await mixed.getByRole("radio").first().check();
  await submit(mixed);
  assert.equal((await stored(mixed)).sectionIndex, 1);
  for (let i = 0; i < 4; i++)
    await mixed.getByRole("button", { name: "Next →", exact: true }).click();
  assert((await mixed.locator("main").innerText()).includes("★"));
  await mixed.getByRole("radio").nth(2).check();
  assert.equal((await stored(mixed)).answers.g5, "C");
  await mixed.getByRole("button", { name: "Next →", exact: true }).click();
  await fits(mixed);
  await mixed.screenshot({
    path: `${output}/jlpt-reading.png`,
    fullPage: true,
  });
  await submit(mixed);
  assert.equal((await stored(mixed)).sectionIndex, 2);
  assert.equal((await stored(mixed)).answers.v1, "A");
  assert.equal(
    await mixed.getByText("Listening transcript", { exact: true }).count(),
    0,
  );
  await mixed.getByRole("button", { name: "Play audio", exact: true }).click();
  await mixed.waitForFunction(
    () => document.querySelector("audio")?.currentTime > 0.5,
  );
  await mixed.getByRole("button", { name: "Pause audio", exact: true }).click();
  await submit(mixed);
  await mixed
    .getByRole("heading", { name: "Your practice review", exact: true })
    .waitFor();
  assert.equal((await stored(mixed)).status, "finished");
  await mixed.context().close();
  passed.push(
    "Real Japanese headphone check and bundled listening work without system voices; mixed sections advance, including star-order grammar and reading",
  );

  const ja = await pageFor(390, "ja");
  await ja
    .getByRole("button", { name: "練習を開始 文字・語彙", exact: true })
    .click();
  await ja.getByLabel("時間と提出のルールを理解しました。").check();
  await ja.getByRole("button", { name: "計時練習を開始", exact: true }).click();
  await ja.getByRole("radio").first().check();
  await fits(ja);
  await ja.getByRole("button", { name: "この科目を提出", exact: true }).click();
  await ja.getByRole("button", { name: "提出を確定", exact: true }).click();
  await ja
    .getByRole("heading", { name: "練習の振り返り", exact: true })
    .waitFor();
  assert((await ja.locator("main").innerText()).includes("尺度得点"));
  await ja.screenshot({ path: `${output}/jlpt-ja-review.png`, fullPage: true });
  await fits(ja);
  await ja.context().close();
  passed.push(
    "Japanese timed workspace and review include localized explanations and the JLPT score boundary",
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      { base, passed, screenshots: output, pageErrors: errors },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}

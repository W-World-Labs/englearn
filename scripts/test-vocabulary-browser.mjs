import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.ENGLEARN_PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.ENGLEARN_TEST_URL || "http://127.0.0.1:31971";
const output = process.env.ENGLEARN_TEST_OUTPUT || "/tmp/englearn-v090/browser";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true }),
  errors = [],
  passed = [];
async function pageFor(
  width = 1440,
  locale = "en",
  course = "en",
  path = "/vocabulary",
) {
  const c = await browser.newContext({
    viewport: { width, height: 950 },
    reducedMotion: "reduce",
  });
  await c.route("**/platform/bootstrap.js", (r) => r.fulfill({ body: "" }));
  await c.route("**/api/auth/me", (r) =>
    r.fulfill({ json: { configured: true, user: null } }),
  );
  await c.route("**/api/progress", (r) => r.fulfill({ json: {} }));
  await c.addInitScript(
    ({ locale, course }) => {
      localStorage.setItem("lingolearn:uiLocale", locale);
      localStorage.setItem("lingolearn:course", course);
    },
    { locale, course },
  );
  const p = await c.newPage();
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept());
  await p.goto(base + path, { waitUntil: "networkidle" });
  return p;
}
const snapshot = (p) =>
  p.evaluate(() =>
    JSON.parse(localStorage.getItem("lingolearn:vocabulary:guest")),
  );
async function fits(p) {
  assert(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "No horizontal page overflow",
  );
}
async function finish(p, correct = false) {
  for (let i = 0; i < 40; i++) {
    const s = await snapshot(p),
      q = s.questions[s.index],
      known = correct === "mixed" ? s.index % 2 === 1 : correct;
    await p
      .locator(`input[type=radio][value="${known ? q.id : "unknown"}"]`)
      .check();
    if (correct === true && s.index === 2)
      assert.equal(
        await p.getByTestId("vocabulary-difficulty").innerText(),
        "Frequency difficulty 3 / 4",
      );
    const last =
      (await p.getByTestId("vocabulary-next").getAttribute("data-finish")) ===
      "true";
    await p
      .getByRole("button", {
        name: last ? "Finish and view results →" : "Next word →",
        exact: true,
      })
      .click();
    if (last) break;
  }
  await p
    .getByRole("heading", { name: "Your vocabulary snapshot", exact: true })
    .waitFor();
}
try {
  for (const [width, locale] of [
    [320, "en"],
    [390, "zh-CN"],
    [390, "ja"],
    [1440, "en"],
  ]) {
    const p = await pageFor(width, locale);
    await fits(p);
    assert.equal(await p.locator("fieldset button[aria-pressed]").count(), 5);
    await p.screenshot({
      path: `${output}/lobby-${locale}-${width}.png`,
      fullPage: true,
    });
    await p.context().close();
  }
  const home = await pageFor(320, "en", "en", "/");
  await home.getByRole("link", { name: /Find your vocabulary range/ }).click();
  assert.equal(new URL(home.url()).pathname, "/vocabulary");
  await home.context().close();
  passed.push(
    "Home and navigation entry plus five language choices fit 320–1440 px in English, Chinese and Japanese",
  );
  for (const [lang, name] of [
    ["en", "English"],
    ["zh", "中文"],
    ["ja", "日本語"],
    ["ko", "한국어"],
    ["es", "Español"],
  ]) {
    const p = await pageFor(390, "en", lang);
    assert.equal(
      await p
        .getByRole("button", { name, exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await p
      .getByRole("button", { name: "Start vocabulary test →", exact: true })
      .click();
    const s = await snapshot(p);
    assert.equal(s.language, lang);
    assert.equal(s.questions.length, 1);
    assert.equal(s.adaptive.version, 2);
    assert.equal(
      await p.getByTestId("vocabulary-difficulty").innerText(),
      "Frequency difficulty 2 / 4",
    );
    assert(
      await p
        .getByRole("button", { name: "Next word →", exact: true })
        .isDisabled(),
    );
    await p.locator('input[type=radio][value="unknown"]').check();
    const answered = await snapshot(p);
    await p.getByRole("button", { name: "Next word →", exact: true }).click();
    const progressed = await snapshot(p);
    assert.equal(
      await p.getByTestId("vocabulary-difficulty").innerText(),
      "Frequency difficulty 1 / 4",
    );
    await p
      .getByRole("button", { name: "← Previous word", exact: true })
      .click();
    assert(await p.getByRole("radio").first().isDisabled());
    await p.keyboard.press("1");
    assert.deepEqual((await snapshot(p)).answers, answered.answers);
    await p.getByRole("button", { name: "Next word →", exact: true }).click();
    await p.reload({ waitUntil: "networkidle" });
    await p
      .getByRole("button", { name: "Continue vocabulary test →", exact: true })
      .click();
    assert.equal((await snapshot(p)).id, s.id);
    assert.deepEqual((await snapshot(p)).questions, progressed.questions);
    assert.deepEqual((await snapshot(p)).adaptive, progressed.adaptive);
    assert.deepEqual((await snapshot(p)).answers, answered.answers);
    await fits(p);
    if (lang === "ja")
      await p.screenshot({
        path: `${output}/japanese-question.png`,
        fullPage: true,
      });
    await finish(p);
    assert(
      (await p.getByTestId("vocabulary-estimate").innerText()).includes(
        "No stable estimate",
      ),
    );
    assert.equal((await snapshot(p)).status, "finished");
    assert.equal(await p.getByTestId("vocabulary-range").count(), 0);
    assert.equal(await p.getByTestId("vocabulary-band-evidence").count(), 4);
    assert.equal(
      await p
        .locator(
          '[data-testid="vocabulary-band-evidence"][data-supported="true"]',
        )
        .count(),
      0,
    );
    assert.equal(
      await p.getByTestId("vocabulary-path").locator("li").count(),
      (await snapshot(p)).questions.length,
    );
    assert(
      (await snapshot(p)).questions.length >= 12 &&
        (await snapshot(p)).questions.length < 20,
    );
    await p.getByTestId("vocabulary-stopping").waitFor();
    await fits(p);
    await p.context().close();
  }
  passed.push(
    "All five languages preserve answers and test order across refresh; unknown answers complete without fabricated vocabulary counts",
  );
  const full = await pageFor();
  await full
    .getByRole("button", {
      name: "Detailed check 20–40 questions · more evidence per band",
      exact: true,
    })
    .click();
  await full
    .getByRole("button", { name: "Start vocabulary test →", exact: true })
    .click();
  assert.equal((await snapshot(full)).questions.length, 1);
  assert.equal((await snapshot(full)).mode, "full");
  await finish(full, true);
  assert((await full.locator("main").innerText()).includes("upper limit"));
  assert.equal(await full.getByTestId("vocabulary-range").count(), 1);
  assert.equal(
    await full
      .locator(
        '[data-testid="vocabulary-band-evidence"][data-supported="true"]',
      )
      .count(),
    4,
  );
  assert.equal(await full.locator("article").count(), 0);
  await full
    .getByRole("button", { name: "All tested words", exact: true })
    .click();
  const count = (await snapshot(full)).questions.length;
  assert(count >= 20 && count < 40);
  assert.equal(
    await full.getByTestId("vocabulary-stopping").getAttribute("data-reason"),
    "precision",
  );
  assert.equal(await full.locator("article").count(), count);
  const saved = await snapshot(full),
    download = full.waitForEvent("download");
  await full
    .getByRole("button", { name: "Download word list ↓", exact: true })
    .click();
  const text = await readFile(await (await download).path(), "utf8");
  assert(
    text.includes("CC-BY-SA-4.0") &&
      text.includes(`Correct: ${count}/${count}`) &&
      text.includes("Stopping: precision") &&
      text.includes("Difficulty path (1–4)"),
  );
  assert.equal(
    await full.getByTestId("vocabulary-path").locator("li").count(),
    count,
  );
  await full.evaluate(() => window.scrollTo(0, 0));
  await full.screenshot({ path: `${output}/result-overview.png` });
  await full.screenshot({ path: `${output}/full-result.png`, fullPage: true });
  await full
    .getByRole("button", { name: "← Back to vocabulary", exact: true })
    .click();
  await full
    .getByRole("button", { name: "Start vocabulary test →", exact: true })
    .click();
  await full.getByRole("dialog").waitFor();
  await full
    .getByRole("button", { name: "Keep current test", exact: true })
    .click();
  assert.deepEqual(await snapshot(full), saved);
  await full.context().close();
  passed.push(
    "Full test, bounded reference range, ceiling notice, word-list filtering/export and explicit draft replacement preserve results",
  );
  const mixed = await pageFor(320, "en", "ja");
  await mixed
    .getByRole("combobox", { name: "Definition language", exact: true })
    .selectOption("zh");
  await mixed
    .getByRole("button", { name: "Start vocabulary test →", exact: true })
    .click();
  await finish(mixed, "mixed");
  assert.equal(
    await mixed.getByTestId("vocabulary-stopping").getAttribute("data-reason"),
    "low_gain",
  );
  assert(
    (await mixed.getByTestId("vocabulary-stopping").innerText()).includes(
      "not reached",
    ),
  );
  assert(
    (await mixed.getByTestId("vocabulary-estimate").innerText()).includes(
      "No stable estimate",
    ),
  );
  assert.equal(await mixed.getByTestId("vocabulary-range").count(), 0);
  assert(
    (await mixed.getByTestId("vocabulary-insufficient").innerText()).includes(
      "does not mean your vocabulary is zero",
    ),
  );
  const weakDownload = mixed.waitForEvent("download");
  await mixed
    .getByRole("button", { name: "Download word list ↓", exact: true })
    .click();
  const weakText = await readFile(await (await weakDownload).path(), "utf8");
  assert(
    weakText.includes("Insufficient recognition evidence") &&
      !weakText.includes("reference range:") &&
      !weakText.includes("reference estimate:"),
  );
  await fits(mixed);
  await mixed.screenshot({
    path: `${output}/limited-result-320.png`,
    fullPage: true,
  });
  const weakSaved = await snapshot(mixed);
  assert(
    (await mixed.locator("main").innerText()).includes("may repeat words"),
  );
  await mixed
    .getByRole("button", { name: "Prepare a detailed test →", exact: true })
    .click();
  assert.equal(
    await mixed
      .getByRole("button", {
        name: "Detailed check 20–40 questions · more evidence per band",
        exact: true,
      })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    await mixed
      .getByRole("button", { name: "日本語", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    await mixed
      .getByRole("combobox", { name: "Definition language", exact: true })
      .inputValue(),
    "zh",
  );
  assert.deepEqual(await snapshot(mixed), weakSaved);
  await mixed
    .getByRole("button", { name: "Start vocabulary test →", exact: true })
    .click();
  await mixed
    .getByRole("button", { name: "Keep current test", exact: true })
    .click();
  assert.deepEqual(await snapshot(mixed), weakSaved);
  await mixed.context().close();
  passed.push(
    "Weak recognition evidence withholds counts/ranges in reports and exports; detailed-test preparation preserves language, definitions and the submitted attempt",
  );
  const unsupported = await pageFor(320, "en", "ar");
  await unsupported
    .getByText(
      "This test is not yet available for your selected learning language.",
      { exact: false },
    )
    .waitFor();
  assert(
    await unsupported
      .getByRole("button", { name: "Start vocabulary test →", exact: true })
      .isDisabled(),
  );
  await unsupported
    .getByRole("button", { name: "English", exact: true })
    .click();
  assert(
    !(await unsupported
      .getByRole("button", { name: "Start vocabulary test →", exact: true })
      .isDisabled()),
  );
  await unsupported.context().close();
  passed.push(
    "Unsupported target languages require explicit selection instead of silently serving English",
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      { base, passed, pageErrors: errors, screenshots: output },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}

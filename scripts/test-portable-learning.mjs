// Isolated guest browsers. Prints real PDFs and opens downloaded HTML with networking disabled.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  process.env.ENGLEARN_PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.ENGLEARN_TEST_URL || "http://127.0.0.1:31971",
  output = process.env.ENGLEARN_TEST_OUTPUT || "/tmp/englearn-v0120/exports";
await mkdir(output, { recursive: true });
const browser = await chromium.launch(),
  errors = [],
  passed = [];
async function pageFor(language = "en", locale = "en", width = 390) {
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
    ({ language, locale }) => {
      if (!localStorage.getItem("lingolearn:course"))
        localStorage.setItem("lingolearn:course", language);
      if (!localStorage.getItem("lingolearn:uiLocale"))
        localStorage.setItem("lingolearn:uiLocale", locale);
    },
    { language, locale },
  );
  const p = await c.newPage();
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept());
  return p;
}
const goto = (p, path) => p.goto(base + path, { waitUntil: "networkidle" });
const fits = async (p) =>
  assert(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "layout must fit",
  );
const journal = (p) =>
  p.evaluate(() =>
    JSON.parse(localStorage.getItem("lingolearn:learning:guest")),
  );
async function saveDownload(p, name, path) {
  const event = p.waitForEvent("download");
  await p.getByRole("button", { name, exact: true }).click();
  const d = await event;
  await d.saveAs(path);
  return path;
}
async function rate(p, value = 2) {
  await p.getByRole("button", { name: "Show answer", exact: true }).click();
  await p
    .getByTestId("recall-answer")
    .locator(`button[data-rating="${value}"]`)
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
    ["en", "en", 1440],
  ]) {
    const p = await pageFor(language, locale, width);
    await goto(p, "/learn?tab=materials");
    await p.getByTestId("material-option").first().waitFor();
    await fits(p);
    await p.screenshot({
      path: `${output}/materials-${language}-${width}.png`,
      fullPage: true,
    });
    await goto(p, "/learn?tab=review");
    await fits(p);
    await p.context().close();
  }
  passed.push(
    "Materials and recall pages fit 320–1440px in five primary interfaces and RTL fallback",
  );
  for (const language of ["en", "zh", "ja", "ko", "es"]) {
    const p = await pageFor(language);
    await goto(p, "/learn?tab=review");
    await p.getByRole("button", { name: "All cards", exact: true }).click();
    await p.getByLabel("Round size", { exact: true }).selectOption("6");
    await p
      .getByRole("button", { name: "Start recall practice (6)", exact: true })
      .click();
    await rate(p, 0);
    await p.reload({ waitUntil: "networkidle" });
    assert.equal((await journal(p)).reviewDraft.ratings.length, 1);
    for (let i = 1; i < 6; i++) await rate(p, 2);
    assert.equal((await journal(p)).reviews.length, 1);
    assert.equal((await journal(p)).reviewDraft, null);
    await p.getByText("Recall round complete", { exact: true }).waitFor();
    await goto(p, "/learn?tab=history");
    assert.equal(await p.getByTestId("recall-round").count(), 1);
    await p.getByTestId("recall-round").locator("summary").click();
    assert.equal(await p.getByTestId("recall-round").locator("li").count(), 6);
    await goto(p, "/learn?tab=materials");
    await p
      .getByRole("button", { name: "Use difficult cards", exact: true })
      .click();
    assert((await p.getByTestId("material-count").innerText()).includes("1 /"));
    await p.context().close();
  }
  passed.push(
    "Five languages: reveal-before-rating, checked-rating resume, finished history and targeted difficult-card packs",
  );
  const manifest = [];
  for (const [language, paper, layout] of [
    ["en", "A4", "workbook"],
    ["zh", "A5", "cards"],
    ["ja", "Letter", "reference"],
    ["ko", "A4", "workbook"],
    ["es", "A5", "cards"],
  ]) {
    const p = await pageFor(language);
    await goto(p, "/learn?tab=materials");
    await p.getByLabel("Paper size", { exact: true }).selectOption(paper);
    await p.getByLabel("Print layout", { exact: true }).selectOption(layout);
    await p
      .getByLabel("Explanation language in the pack", { exact: true })
      .selectOption("zh");
    const stem = `${output}/${language}-${paper}-${layout}`;
    await saveDownload(p, "Download offline HTML", stem + ".html");
    await saveDownload(p, "Download plain text", stem + ".txt");
    await saveDownload(p, "Download Anki TSV", stem + ".tsv");
    const html = await readFile(stem + ".html", "utf8");
    assert(!html.includes("lingolearn_session"));
    assert(!html.includes("https://radar."));
    const popup = p.waitForEvent("popup");
    await p
      .getByRole("button", { name: "Preview / print / save PDF", exact: true })
      .click();
    const print = await popup;
    print.on("pageerror", (e) => errors.push(e.message));
    await print.waitForLoadState("domcontentloaded");
    await print.pdf({
      path: stem + ".pdf",
      preferCSSPageSize: true,
      printBackground: false,
    });
    const data = await print.locator("#pack-data").textContent(),
      pack = JSON.parse(data).pack;
    manifest.push({
      file: stem + ".pdf",
      language,
      paper,
      layout,
      expected:
        layout === "reference"
          ? [pack.cards[0].title.zh, ...pack.cards[0].examples]
          : [pack.cards[0].front, pack.cards[0].answer.zh],
    });
    await p.context().close();
  }
  await writeFile(
    output + "/print-manifest.json",
    JSON.stringify(manifest, null, 2),
  );
  passed.push(
    "Actual A4/Letter/A5 PDFs, three print layouts, offline HTML, text and Anki TSV generated for all five languages",
  );
  // A fresh English pack makes offline result import reproducible.
  const p = await pageFor();
  await goto(p, "/learn?tab=materials");
  const htmlFile = await saveDownload(
    p,
    "Download offline HTML",
    output + "/offline-en.html",
  );
  const offline = await browser.newContext();
  await offline.setOffline(true);
  const f = await offline.newPage();
  f.on("pageerror", (e) => errors.push(e.message));
  await f.goto(pathToFileURL(htmlFile).href);
  await f.locator("#reveal").click();
  await f.locator('[data-rating="0"]').click();
  const partial = f.waitForEvent("download");
  await f.locator("#export").click();
  const pd = await partial;
  await pd.saveAs(output + "/partial.json");
  const partialData = JSON.parse(
    await readFile(output + "/partial.json", "utf8"),
  );
  assert.equal(partialData.draft.ratings.length, 1);
  assert.equal(partialData.rounds.length, 0);
  const device = await browser.newContext();
  await device.setOffline(true);
  const d = await device.newPage();
  d.on("pageerror", (e) => errors.push(e.message));
  await d.goto(pathToFileURL(htmlFile).href);
  await d.locator("#import").setInputFiles(output + "/partial.json");
  await d
    .getByText("Results restored. Duplicate rounds were skipped.", {
      exact: true,
    })
    .waitFor();
  assert((await d.locator("#round-status").innerText()).includes("1/12"));
  for (let i = 1; i < 12; i++) {
    await d.locator("#reveal").click();
    await d.locator('[data-rating="2"]').click();
  }
  const completed = d.waitForEvent("download");
  await d.locator("#export").click();
  await (await completed).saveAs(output + "/completed.json");
  const completedData = JSON.parse(
    await readFile(output + "/completed.json", "utf8"),
  );
  assert.equal(completedData.rounds.length, 1);
  assert.equal(completedData.rounds[0].ratings.length, 12);
  assert.equal(completedData.draft, null);
  await goto(p, "/learn?tab=review");
  await p.getByText("Bring back offline practice", { exact: true }).click();
  await p
    .getByLabel("Choose result file", { exact: true })
    .setInputFiles(output + "/partial.json");
  await p
    .getByLabel(
      "Also restore the unfinished recall round (replaces the current recall draft)",
      { exact: true },
    )
    .check();
  await p
    .getByRole("button", { name: "Import reviewed records", exact: true })
    .click();
  assert.equal((await journal(p)).reviewDraft.ratings.length, 1);
  await p
    .getByLabel("Choose result file", { exact: true })
    .setInputFiles(output + "/completed.json");
  await p
    .getByRole("button", { name: "Import reviewed records", exact: true })
    .click();
  assert.equal((await journal(p)).reviewDraft, null);
  assert.equal((await journal(p)).reviews.length, 1);
  const conflicting = structuredClone(completedData);
  conflicting.rounds.unshift({
    ...conflicting.rounds[0],
    id: "offline-new-before-conflict",
  });
  conflicting.rounds[1].ratings[0] = 2;
  const beforeConflict = await d.evaluate(() =>
    localStorage.getItem(
      Object.keys(localStorage).find((k) =>
        k.startsWith("lingolearn:portable:"),
      ),
    ),
  );
  await d.locator("#import").setInputFiles({
    name: "conflict.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(conflicting)),
  });
  await d
    .getByText(
      "This result file does not match this pack or contains invalid data.",
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await d.evaluate(() =>
      localStorage.getItem(
        Object.keys(localStorage).find((k) =>
          k.startsWith("lingolearn:portable:"),
        ),
      ),
    ),
    beforeConflict,
  );
  await p
    .getByLabel("Choose result file", { exact: true })
    .setInputFiles(output + "/completed.json");
  await p
    .getByRole("button", { name: "Import reviewed records", exact: true })
    .click();
  assert.equal((await journal(p)).reviews.length, 1);
  const invalid = {
    ...completedData,
    rounds: [{ ...completedData.rounds[0], ratings: [99] }],
  };
  await writeFile(output + "/invalid.json", JSON.stringify(invalid));
  await p
    .getByLabel("Choose result file", { exact: true })
    .setInputFiles(output + "/invalid.json");
  await p
    .getByText(
      "This file is invalid, too large, or uses unknown cards. No records were changed.",
      { exact: true },
    )
    .waitFor();
  assert.equal((await journal(p)).reviews.length, 1);
  await offline.close();
  await device.close();
  await p.context().close();
  passed.push(
    "Downloaded HTML works with networking disabled; unfinished recall crosses devices and imports safely, with completion, deduplication and corrupt-file protection",
  );
  const share = await pageFor();
  await goto(share, "/learn?tab=materials");
  await share.evaluate(() => {
    navigator.canShare = () => false;
  });
  const fallback = share.waitForEvent("download");
  await share
    .getByRole("button", { name: "Share offline file", exact: true })
    .click();
  assert((await fallback).suggestedFilename().endsWith(".html"));
  await share.evaluate(() => {
    navigator.canShare = () => true;
    navigator.share = async ({ files }) => {
      window.sharedMaterial = {
        name: files[0].name,
        body: await files[0].text(),
      };
    };
  });
  await share
    .getByRole("button", { name: "Share offline file", exact: true })
    .click();
  await share.waitForFunction(() =>
    window.sharedMaterial?.body.includes('id="pack-data"'),
  );
  await share.context().close();
  passed.push(
    "Native file sharing receives a complete offline file, with download fallback; conflicting offline imports are atomic",
  );
  const data = JSON.parse(
    (await readFile(htmlFile, "utf8")).match(
      /<script id="pack-data" type="application\/json">(.*?)<\/script>/s,
    )[1],
  );
  const key = "lingolearn:portable:" + data.pack.id;
  for (const blocked of [false, true]) {
    const c = await browser.newContext();
    await c.setOffline(true);
    await c.addInitScript(
      ({ blocked, key }) => {
        if (blocked)
          Object.defineProperty(window, "localStorage", {
            get() {
              throw new DOMException("Disabled", "SecurityError");
            },
          });
        else if (!sessionStorage.getItem("corrupt-seeded")) {
          localStorage.setItem(key, "{unreadable");
          sessionStorage.setItem("corrupt-seeded", "1");
        }
      },
      { blocked, key },
    );
    const f = await c.newPage();
    f.on("pageerror", (e) => errors.push(e.message));
    f.on("dialog", (d) => d.accept());
    await f.goto(pathToFileURL(htmlFile).href);
    if (blocked) {
      await f
        .getByText(
          "Device storage is unavailable. Export results before closing.",
          { exact: true },
        )
        .waitFor();
      await f.locator("#reveal").click();
      await f.locator('[data-rating="1"]').click();
    } else {
      assert.equal(
        await f.evaluate((key) => localStorage.getItem(key), key),
        "{unreadable",
      );
      assert(await f.locator("#all").isDisabled());
    }
    const event = f.waitForEvent("download");
    await f.locator("#export").click();
    const saved = await event;
    const raw = await readFile(await saved.path(), "utf8");
    if (blocked) assert.equal(JSON.parse(raw).draft.ratings[0], 1);
    else {
      assert.equal(raw, "{unreadable");
      await f.locator("#next").click();
      await f.locator("#reveal").waitFor();
    }
    await c.close();
  }
  passed.push(
    "Unavailable storage still permits result export; corrupt local history is preserved until explicit reset",
  );
  const vocabulary = await pageFor("ja");
  await goto(vocabulary, "/vocabulary");
  await vocabulary
    .getByRole("button", { name: "Start vocabulary test →", exact: true })
    .click();
  for (let i = 0; i < 40; i++) {
    await vocabulary.locator('input[type=radio][value="unknown"]').check();
    const last =
      (await vocabulary
        .getByTestId("vocabulary-next")
        .getAttribute("data-finish")) === "true";
    await vocabulary.getByTestId("vocabulary-next").click();
    if (last) break;
  }
  const snapshot = await vocabulary.evaluate(() =>
    JSON.parse(localStorage.getItem("lingolearn:vocabulary:guest")),
  );
  await vocabulary.getByTestId("vocabulary-materials").click();
  await vocabulary.getByTestId("material-option").first().waitFor();
  assert.equal(
    await vocabulary
      .getByLabel("Learning language", { exact: true })
      .inputValue(),
    "ja",
  );
  assert(
    (await vocabulary.getByTestId("material-count").innerText()).includes(
      `${snapshot.questions.length} /`,
    ),
  );
  const wordFile = await saveDownload(
    vocabulary,
    "Download offline HTML",
    output + "/vocabulary-ja.html",
  );
  const wordPack = JSON.parse(
    (await readFile(wordFile, "utf8")).match(
      /<script id="pack-data" type="application\/json">(.*?)<\/script>/s,
    )[1],
  ).pack;
  assert.deepEqual(
    wordPack.cards.map((c) => c.id),
    snapshot.questions.map((q) => "v:" + q.id),
  );
  await goto(vocabulary, "/learn?tab=library");
  await vocabulary.getByTestId("book-text").waitFor();
  assert.equal(
    await vocabulary
      .getByRole("link", { name: "CC BY-SA 4.0", exact: true })
      .getAttribute("href"),
    "https://creativecommons.org/licenses/by-sa/4.0/",
  );
  await vocabulary.context().close();
  passed.push(
    "Missed vocabulary becomes a pack in the correct language; the open textbook retains its licence link",
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed, pageErrors: errors, output }, null, 2));
} finally {
  await browser.close();
}

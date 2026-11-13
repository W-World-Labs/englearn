// Run against an already registered local test server. Uses existing Playwright tooling.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(
  process.env.ENGLEARN_PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.ENGLEARN_TEST_URL || "http://127.0.0.1:31971";
const output =
  process.env.ENGLEARN_TEST_OUTPUT || "/tmp/englearn-ielts-acceptance";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const passed = [];

async function pageFor(options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...options,
  });
  await context.route("**/platform/bootstrap.js", (route) =>
    route.fulfill({ status: 200, body: "" }),
  );
  await context.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { configured: false, user: null } }),
  );
  await context.addInitScript(() =>
    localStorage.setItem("lingolearn:uiLocale", "en"),
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`${base}/ielts`, { waitUntil: "networkidle" });
  return page;
}

async function start(page, mode) {
  await page
    .getByRole("button", { name: `Start ${mode}`, exact: true })
    .click();
  if (await page.getByRole("dialog").isVisible())
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByLabel("My details are correct.").check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  if (mode === "Listening" || mode === "Full test") {
    await page.locator("audio").evaluate(async (audio) => {
      await audio.play();
    });
    await page.getByLabel("I can hear the sound clearly.").check();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  }
  assert.equal(
    await page.getByRole("timer").count(),
    0,
    "Timer must not start before instructions are accepted",
  );
  await page.getByRole("button", { name: "Start test", exact: true }).click();
  await page.getByRole("timer").waitFor();
}

async function stored(page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) =>
      key.startsWith("lingolearn:ielts:"),
    );
    return key ? JSON.parse(localStorage.getItem(key)) : null;
  });
}

async function selectPassage(page, start, end) {
  await page.locator('.exam-material [lang="en"]').evaluate(
    (element, { start, end }) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let offset = 0,
        started = false;
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!started && start < offset + node.length) {
          range.setStart(node, start - offset);
          started = true;
        }
        if (started && end <= offset + node.length) {
          range.setEnd(node, end - offset);
          break;
        }
        offset += node.length;
      }
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    },
    { start, end },
  );
}

try {
  const page = await pageFor();
  await start(page, "Reading");
  await page
    .getByRole("button", {
      name: "iii A definition and where it occurs",
      exact: true,
    })
    .dragTo(
      page.getByRole("button", {
        name: "Answer 1: drop heading here",
        exact: true,
      }),
    );
  assert.equal((await stored(page)).answers.q1, "iii");
  await page
    .getByRole("button", { name: "Flag question 1", exact: true })
    .click();
  assert((await stored(page)).flags.includes("q1"));
  await page
    .getByRole("button", { name: "Question 10, unanswered", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Answer 10", exact: true })
    .fill("luciferin");
  await selectPassage(page, 3, 65);
  await page.getByRole("button", { name: "▰　Highlight", exact: true }).click();
  assert.equal((await stored(page)).highlights["passage-1"].length, 1);
  await selectPassage(page, 70, 100);
  await page.getByRole("button", { name: "✎　Note", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Notes for this part" })
    .fill("Find supporting evidence before answering.");
  await page.getByRole("button", { name: "Close notes", exact: true }).click();
  await page.getByRole("separator").focus();
  await page.keyboard.press("ArrowLeft");
  assert.equal(
    await page.getByRole("separator").getAttribute("aria-valuenow"),
    "48",
  );
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page.getByLabel("Yellow on black", { exact: true }).check();
  await page.getByLabel("Large", { exact: true }).check();
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .locator(".exam-panes")
      .evaluate((el) => getComputedStyle(el).fontSize),
    "20px",
  );
  assert(
    await page
      .locator(".ielts-exam")
      .evaluate((el) => el.classList.contains("contrast-yellow")),
  );
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page.getByLabel("Black on white", { exact: true }).check();
  await page.getByLabel("Regular", { exact: true }).check();
  await page.keyboard.press("Escape");
  const deadline = (await stored(page)).deadline;
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Resume test", exact: true }).click();
  assert.equal((await stored(page)).deadline, deadline);
  assert.equal((await stored(page)).answers.q10, "luciferin");
  assert.equal(
    (await stored(page)).notes["passage-1"],
    "Find supporting evidence before answering.",
  );
  await page.getByRole("button", { name: /Part 2/ }).click();
  await page.getByRole("button", { name: /Part 1/ }).click();
  assert.equal(await page.locator(".exam-material mark").count(), 2);
  await page.screenshot({ path: `${output}/reading-desktop.png` });
  passed.push(
    "Reading: drag/drop, completion, flags, notes, highlights, resize, contrast and refresh recovery",
  );

  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) =>
      key.startsWith("lingolearn:ielts:"),
    );
    const session = JSON.parse(localStorage.getItem(key));
    session.deadline = Date.now() + 1800;
    localStorage.setItem(key, JSON.stringify(session));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Resume test", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your test review", exact: true })
    .waitFor({ timeout: 6000 });
  assert.equal((await stored(page)).status, "finished");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download answers", exact: true })
    .click();
  const download = await downloadPromise;
  await download.saveAs(`${output}/reading-answers.txt`);
  passed.push(
    "Deadline automatically submits, locks answers and produces downloadable review",
  );

  const writing = await pageFor();
  await start(writing, "Writing");
  const task1 = writing.getByRole("textbox", {
    name: "Writing Task 1 response",
  });
  await task1.fill("Public transport increased while car journeys declined.");
  assert.equal(await task1.getAttribute("spellcheck"), "false");
  await writing.getByRole("button", { name: /Part 2/ }).click();
  await writing
    .getByRole("textbox", { name: "Writing Task 2 response" })
    .fill(
      "Cities should invest in reliable public transport.\n\nThis improves access to employment.",
    );
  await writing.getByRole("button", { name: /Part 1/ }).click();
  assert.equal(
    await task1.inputValue(),
    "Public transport increased while car journeys declined.",
  );
  await writing.screenshot({ path: `${output}/writing-desktop.png` });
  await writing
    .getByRole("button", { name: "Submit section", exact: true })
    .click();
  await writing.getByRole("button", { name: "Confirm", exact: true }).click();
  await writing
    .getByRole("heading", { name: "Your test review", exact: true })
    .waitFor();
  assert(await writing.getByText("Task 1 / 2 words · ungraded").isVisible());
  passed.push(
    "Writing: task switching, word counts, disabled spellcheck, submission and ungraded review",
  );

  const full = await pageFor();
  await full.clock.install({ time: new Date() });
  await start(full, "Full test");
  await full
    .getByRole("textbox", { name: "Answer 1", exact: true })
    .fill("Ironwood Artisans");
  await full.clock.fastForward(31000);
  await full.locator(".exam-material audio").waitFor({ state: "attached" });
  await full.waitForFunction(() => {
    const audio = document.querySelector(".exam-material audio");
    return audio && audio.readyState >= 2 && !audio.paused;
  });
  await full.getByRole("button", { name: /Part 4/ }).click();
  assert(
    (await full.locator(".exam-material audio").getAttribute("src")).endsWith(
      "audio?part=1",
    ),
  );
  // Closing/reopening the page advances to the exam clock position, not a saved playhead.
  await full.clock.fastForward(40000);
  await full.waitForFunction(
    () => document.querySelector(".exam-material audio")?.currentTime >= 40,
    undefined,
    { timeout: 5000 },
  );
  const secondsToReview = await full.evaluate(() => {
    const key = Object.keys(localStorage).find((key) =>
      key.startsWith("lingolearn:ielts:"),
    );
    return JSON.parse(localStorage.getItem(key)).deadline - Date.now() - 120000;
  });
  await full.clock.fastForward(secondsToReview);
  await full
    .getByText("You now have 120 seconds to check your answers.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await full.locator(".exam-material audio").count(), 0);
  await full.clock.fastForward(121000);
  await full
    .getByRole("heading", {
      name: "Bioluminescence: Living Light",
      exact: true,
    })
    .waitFor();
  assert.equal((await stored(full)).sectionIndex, 1);
  assert.equal((await stored(full)).answers.l1, "Ironwood Artisans");
  await full
    .getByRole("button", { name: "Submit section", exact: true })
    .click();
  await full.getByRole("button", { name: "Confirm", exact: true }).click();
  assert.equal((await stored(full)).sectionIndex, 2);
  await full
    .getByRole("textbox", { name: "Writing Task 1 response" })
    .waitFor();
  passed.push(
    "Full test: clock-aligned audio, independent navigation, exact 2-minute review and locked section transitions",
  );

  const unavailable = await pageFor();
  await unavailable.clock.install({ time: new Date() });
  await start(unavailable, "Listening");
  await unavailable.route("**/api/ielts/audio?part=1", (route) =>
    route.abort(),
  );
  await unavailable.clock.fastForward(31000);
  await unavailable
    .getByRole("button", { name: "Resume audio", exact: true })
    .waitFor();
  assert(
    await unavailable
      .getByRole("alert")
      .filter({ hasText: "Audio playback was interrupted" })
      .isVisible(),
  );
  await unavailable.unroute("**/api/ielts/audio?part=1");
  await unavailable
    .getByRole("button", { name: "Resume audio", exact: true })
    .click();
  await unavailable.waitForFunction(() => {
    const audio = document.querySelector(".exam-material audio");
    return audio && !audio.paused && audio.readyState >= 2;
  });
  passed.push(
    "Audio outage: visible failure and recovery at current test time",
  );

  const mobile = await pageFor({ viewport: { width: 390, height: 844 } });
  await start(mobile, "Reading");
  assert(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await mobile
    .getByRole("button", { name: "Question 10, unanswered", exact: true })
    .click();
  await mobile
    .getByRole("textbox", { name: "Answer 10", exact: true })
    .fill("luciferin");
  assert.equal(
    await mobile
      .locator(".exam-header")
      .evaluate((el) => el.getBoundingClientRect().top),
    0,
  );
  // Allow Chromium's compositor to repaint after the long question jump.
  await mobile.waitForTimeout(300);
  await mobile.screenshot({ path: `${output}/reading-mobile.png` });
  passed.push(
    "Mobile: no horizontal page overflow and question navigation remains usable",
  );

  const blocked = await pageFor();
  await blocked.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("lingolearn:ielts:"))
        throw new DOMException("Quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await start(blocked, "Writing");
  await blocked
    .getByRole("textbox", { name: "Writing Task 1 response" })
    .fill("My unsaved response remains editable.");
  assert(
    await blocked
      .getByRole("alert")
      .filter({ hasText: "Browser storage is unavailable" })
      .isVisible(),
  );
  passed.push(
    "Storage failure: explicit warning while answers remain editable",
  );

  assert.deepEqual(
    errors,
    [],
    `Unexpected browser errors: ${errors.join("; ")}`,
  );
  console.log(
    JSON.stringify({ passed, browserErrors: errors, output }, null, 2),
  );
} finally {
  await browser.close();
}

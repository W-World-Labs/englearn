import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.ENGLEARN_PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.ENGLEARN_TEST_URL || "http://127.0.0.1:31971";
const output =
  process.env.ENGLEARN_TEST_OUTPUT || "/tmp/englearn-v040/acceptance";
await mkdir(output, { recursive: true });
const manifest = JSON.parse(
  await readFile(new URL("../data/exams/audio.json", import.meta.url), "utf8"),
);
const browser = await chromium.launch({ headless: true }),
  errors = [],
  passed = [];
async function pageFor(path = "/topik", width = 1440, locale = "en") {
  const c = await browser.newContext({
    viewport: { width, height: 950 },
    reducedMotion: "reduce",
  });
  await c.route("**/platform/bootstrap.js", (r) => r.fulfill({ body: "" }));
  await c.route("**/api/auth/me", (r) =>
    r.fulfill({ json: { configured: true, user: null } }),
  );
  await c.route("**/api/progress", (r) => r.fulfill({ json: {} }));
  await c.addInitScript((locale) => {
    localStorage.setItem("lingolearn:uiLocale", locale);
    Object.defineProperty(window, "speechSynthesis", {
      value: { getVoices: () => [] },
    });
  }, locale);
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept());
  await p.goto(base + path, { waitUntil: "networkidle" });
  return p;
}
async function start(p, skill) {
  await p
    .getByRole("button", { name: `Start practice ${skill}`, exact: true })
    .click();
  await p.getByLabel("I understand the timing and submission rules.").check();
  await p
    .getByRole("button", { name: "Begin timed practice", exact: true })
    .click();
}
async function snapshot(p) {
  return p.evaluate(() =>
    JSON.parse(localStorage.getItem("lingolearn:exams:topik:guest")),
  );
}
try {
  const p = await pageFor();
  await start(p, "Reading");
  await p.getByRole("radio", { name: "A 에", exact: true }).check();
  await p
    .getByRole("button", { name: "Mark for review ⚑", exact: true })
    .click();
  await p.getByRole("button", { name: "Unanswered 7", exact: true }).click();
  assert.equal(
    await p
      .getByRole("navigation", { name: "Question navigation" })
      .getByRole("button")
      .count(),
    7,
  );
  await p.getByRole("button", { name: "Marked 1", exact: true }).click();
  assert.equal(
    await p
      .getByRole("navigation", { name: "Question navigation" })
      .getByRole("button")
      .count(),
    1,
  );
  await p.getByRole("button", { name: "All questions 8", exact: true }).click();
  await p.getByRole("button", { name: "Submit section", exact: true }).click();
  const dialog = p.getByRole("dialog");
  assert((await dialog.innerText()).includes("Unanswered: 7"));
  await dialog
    .getByRole("button", { name: "Go to first unanswered →", exact: true })
    .click();
  assert.equal((await snapshot(p)).questionIndex, 1);
  await p.getByRole("button", { name: "Larger text", exact: true }).click();
  assert.equal(
    await p
      .locator("main")
      .evaluate((el) =>
        getComputedStyle(el).getPropertyValue("--practice-font-size"),
      ),
    "21px",
  );
  await p.getByRole("radio").first().check();
  await p.screenshot({
    path: `${output}/question-navigation.png`,
    fullPage: true,
  });
  await p.getByRole("button", { name: "Submit section", exact: true }).click();
  await p
    .getByRole("button", { name: "Confirm submission", exact: true })
    .click();
  const original = await snapshot(p);
  await p.screenshot({ path: `${output}/review.png`, fullPage: true });
  await p
    .getByRole("button", { name: "Retry mistakes →", exact: true })
    .click();
  assert.equal(
    await p.getByText("Accepted answer:", { exact: false }).count(),
    0,
  );
  const answers = ["A", "C", "A", "A", "A", "C", "A"];
  for (let i = 0; i < answers.length; i++) {
    await p
      .getByRole("radio")
      .nth(answers[i].charCodeAt(0) - 65)
      .check();
    await p.getByRole("button", { name: "Check answer", exact: true }).click();
    assert(await p.getByRole("radio").first().isDisabled());
    if (i === 0) {
      assert(
        (await p.locator("main").getByRole("status").innerText()).includes(
          "Incorrect",
        ),
      );
      await p.screenshot({
        path: `${output}/correction-feedback.png`,
        fullPage: true,
      });
    }
    await p
      .getByRole("button", {
        name:
          i === answers.length - 1 ? "Correction round complete →" : "Next →",
        exact: true,
      })
      .click();
  }
  await p
    .getByRole("button", {
      name: "Repeat remaining mistakes (1) →",
      exact: true,
    })
    .click();
  await p.getByRole("radio").nth(1).check();
  await p.getByRole("button", { name: "Check answer", exact: true }).click();
  await p
    .getByRole("button", { name: "Correction round complete →", exact: true })
    .click();
  assert.equal(
    await p.getByRole("button", { name: /Repeat remaining mistakes/ }).count(),
    0,
  );
  assert.deepEqual(
    await snapshot(p),
    original,
    "Correction rounds cannot alter the original timed answer sheet",
  );
  await p.getByRole("button", { name: "Back to review", exact: true }).click();
  await p
    .getByRole("heading", { name: "Your practice review", exact: true })
    .waitFor();
  await p.context().close();
  passed.push(
    "Unanswered/marked navigation, submission jump-back, large text and repeatable correction rounds preserve the original answer sheet",
  );
  for (const width of [320, 390, 1440]) {
    const writing = await pageFor("/topik", width);
    await writing
      .getByRole("button", { name: "TOPIK II", exact: true })
      .click();
    await start(writing, "Writing");
    await writing.getByRole("button", { name: "Next →", exact: true }).click();
    const table = writing.getByRole("table");
    assert.equal(await table.getByRole("columnheader").count(), 3);
    assert.equal(await table.getByRole("rowheader").count(), 3);
    await writing.evaluate(() => window.scrollTo(0, 0));
    await writing.screenshot({
      path: `${output}/writing-${width}.png`,
      fullPage: true,
    });
    assert(
      await writing.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Writing table and toolbar fit the viewport",
    );
    await writing
      .getByRole("textbox", { name: "Your answer", exact: true })
      .fill("대중교통 이용 비율은 증가했습니다.");
    await writing.evaluate(() => window.scrollTo(0, 0));
    await writing.screenshot({
      path: `${output}/writing-${width}.png`,
      fullPage: true,
    });
    await writing.context().close();
  }
  passed.push(
    "Responsive TOPIK source table, writing input and separate material/answer panes at 320–1440 px",
  );
  const audio = await pageFor("/hsk");
  const count = await audio.evaluate(async (clips) => {
    const context = new AudioContext();
    let count = 0;
    try {
      for (const clip of clips) {
        const response = await fetch(
          `/api/exams/audio?paperId=${clip.paperId}&questionId=${clip.questionId}`,
        );
        if (!response.ok) throw new Error(`Missing clip ${clip.file}`);
        const decoded = await context.decodeAudioData(
          await response.arrayBuffer(),
        );
        if (Math.abs(decoded.duration - clip.duration) > 0.2)
          throw new Error(`Truncated clip ${clip.file}`);
        const samples = decoded.getChannelData(0);
        let energy = 0;
        for (let i = 0; i < samples.length; i += 100)
          energy += samples[i] * samples[i];
        if (Math.sqrt(energy / (samples.length / 100)) < 0.001)
          throw new Error(`Silent clip ${clip.file}`);
        count++;
      }
    } finally {
      await context.close();
    }
    return count;
  }, manifest.clips);
  assert.equal(count, manifest.clips.length);
  await audio.context().close();
  passed.push(
    "All bundled MP3s decode in Chromium with matching duration and non-silent waveforms",
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({ passed, browserErrors: errors, output }, null, 2),
  );
} finally {
  await browser.close();
}

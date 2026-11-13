// Local acceptance only. Start the registered server with W_ID_CLIENT_ID=ielts-local-test,
// W_ID_CLIENT_SECRET=test-only-client-secret, JWT_SECRET=test-only-jwt-secret-at-least-thirty-two-characters,
// W_ID_REDIRECT_URI=http://127.0.0.1:31971/api/auth/callback and a temporary ENGLEARN_DATA_DIR.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SsoConfig } from "@w-id/sdk";
const { chromium } = await import(
  process.env.ENGLEARN_PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.ENGLEARN_TEST_URL || "http://127.0.0.1:31971";
assert(
  ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
  "Test identities are only for loopback servers",
);
const exam = process.env.ENGLEARN_TEST_EXAM || "ielts";
assert(["ielts", "hsk", "topik", "jlpt"].includes(exam));
const attempts =
  exam === "ielts" ? "/api/ielts/attempts" : `/api/exams/${exam}/attempts`;
const names =
  exam === "ielts"
    ? {
        start: "Start Writing",
        answer: "Writing Task 1 response",
        resume: "Resume test",
        confirm: "Confirm",
        review: "Your test review",
        back: "Back to tests",
        open: "View answer sheet",
        answerId: "task-1",
      }
    : {
        start: "Start practice Writing",
        answer: "Your answer",
        resume: "Resume practice",
        confirm: "Confirm submission",
        review: "Your practice review",
        back: "← Back to module",
        open: "View review",
        answerId: "w1",
      };
if (exam === "jlpt") {
  names.start = "Start practice Vocabulary";
  names.answerId = "v1";
}
const samples =
  exam === "jlpt"
    ? {
        initial: "A",
        offline: "B",
        newer: "C",
        second: "D",
        expired: "A",
        review: "3 · かぜ",
      }
    : {
        initial: "My first answer is saved under my W-ID account.",
        offline: "My offline answer must not disappear.",
        newer: "A newer answer from the second device.",
        second: "This is my second test; the first remains in history.",
        expired: "Still retained locally after login expires.",
        review: "A newer answer from the second device.",
      };
function field(page) {
  return exam === "jlpt"
    ? page.locator('input[type="radio"]:checked')
    : page.getByRole("textbox", { name: names.answer, exact: true });
}
async function setAnswer(page, value) {
  if (exam === "jlpt")
    await page.locator(`input[type="radio"][value="${value}"]`).check();
  else await field(page).fill(value);
}
const cfg = new SsoConfig({
  clientId: "ielts-local-test",
  clientSecret: "test-only-client-secret",
  jwtSecret: "test-only-jwt-secret-at-least-thirty-two-characters",
  redirectUri: `${base}/api/auth/callback`,
});
const owner = `acceptance-${randomUUID()}`;
const browser = await chromium.launch({ headless: true });
const errors = [],
  passed = [];
async function pageFor(sub = owner) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const token = await cfg.signSessionClaims({
    sub,
    login: "Practice learner",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  await context.addCookies([
    {
      name: "lingolearn_session",
      value: token,
      url: base,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await context.route("**/platform/bootstrap.js", (route) =>
    route.fulfill({ status: 200, body: "" }),
  );
  await context.route("**/api/progress", (route) =>
    route.fulfill({ status: 200, json: {} }),
  );
  await context.addInitScript(() =>
    localStorage.setItem("lingolearn:uiLocale", "en"),
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`${base}/${exam}`, { waitUntil: "networkidle" });
  return page;
}
async function status(page, text = "Saved to your account") {
  await page
    .getByTestId("exam-cloud-status")
    .filter({ hasText: text })
    .waitFor({ timeout: 15000 });
}
async function start(page) {
  if (exam !== "ielts")
    await page
      .getByRole("button", {
        name:
          exam === "hsk" ? "HSK 5" : exam === "jlpt" ? "JLPT N5" : "TOPIK II",
        exact: true,
      })
      .click();
  await page.getByRole("button", { name: names.start, exact: true }).click();
  if (await page.getByRole("dialog").isVisible())
    await page
      .getByRole("button", { name: names.confirm, exact: true })
      .click();
  if (exam === "ielts") {
    await page.getByLabel("My details are correct.").check();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Start test", exact: true }).click();
  } else {
    await page
      .getByLabel("I understand the timing and submission rules.")
      .check();
    await page
      .getByRole("button", { name: "Begin timed practice", exact: true })
      .click();
  }
  await page.getByRole("timer").waitFor();
}
async function answer(page, value) {
  await setAnswer(page, value);
  await status(page);
  await page.waitForFunction(
    ({ value, answerId }) => {
      return Object.keys(localStorage)
        .filter((key) => key.endsWith(":cloud"))
        .some((key) => {
          try {
            return (
              JSON.parse(JSON.parse(localStorage.getItem(key)).signature)
                .answers[answerId] === value
            );
          } catch {
            return false;
          }
        });
    },
    { value, answerId: names.answerId },
  );
}
try {
  const first = await pageFor();
  await status(first);
  await start(first);
  await answer(first, samples.initial);
  const firstData = await (
    await first.request.get(`${base}${attempts}`)
  ).json();
  assert.equal(firstData.total, 1);
  const id = firstData.latest.session.id;
  assert.equal(
    firstData.latest.session.answers[names.answerId],
    samples.initial,
  );
  const second = await pageFor();
  await status(second);
  await second
    .getByRole("button", { name: names.resume, exact: true })
    .first()
    .click();
  assert.equal(
    await field(second).inputValue(),
    firstData.latest.session.answers[names.answerId],
  );
  passed.push(
    "Real SDK cookies and API: new browser restores answers and deadline from the same account",
  );

  await first.route(`**${attempts}`, (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await setAnswer(first, samples.offline);
  await status(first, "Account sync failed");
  await answer(second, samples.newer);
  await first.unroute(`**${attempts}`);
  await first.getByRole("button", { name: "Retry sync", exact: true }).click();
  await status(first, "Another device updated");
  assert.equal(await field(first).inputValue(), samples.offline);
  const download = first.waitForEvent("download");
  await first
    .getByRole("button", {
      name: "Back up and load account version",
      exact: true,
    })
    .click();
  assert((await download).suggestedFilename().endsWith(".json"));
  await status(first);
  assert.equal(await field(first).inputValue(), samples.newer);
  await second.context().close();
  passed.push(
    "Offline answers survive; simultaneous device edits show a conflict and export the local draft before loading server answers",
  );

  await first
    .getByRole("button", { name: "Submit section", exact: true })
    .click();
  await first.getByRole("button", { name: names.confirm, exact: true }).click();
  await first
    .getByRole("heading", { name: names.review, exact: true })
    .waitFor();
  await status(first);
  await first.getByRole("button", { name: names.back, exact: true }).click();
  await start(first);
  await answer(first, samples.second);
  const history = await (await first.request.get(`${base}${attempts}`)).json();
  assert.equal(history.total, 2);
  assert.equal(history.items.find((a) => a.id === id).status, "finished");
  await first.reload({ waitUntil: "networkidle" });
  await status(first);
  await first.getByRole("button", { name: names.open, exact: true }).click();
  await first
    .getByRole("heading", { name: names.review, exact: true })
    .waitFor();
  assert(await first.getByText(samples.review, { exact: true }).isVisible());
  passed.push(
    "Submission is acknowledged; another test preserves history and the old answer sheet remains reviewable",
  );

  const other = await pageFor(`other-${randomUUID()}`);
  await status(other);
  const isolated = await (await other.request.get(`${base}${attempts}`)).json();
  assert.equal(isolated.total, 0);
  assert.equal(
    (await other.request.get(`${base}${attempts}?id=${id}`)).status(),
    404,
  );
  passed.push(
    "A second W-ID account has empty history and cannot retrieve the first account's record by ID",
  );

  const resumed = await pageFor();
  await status(resumed);
  await resumed
    .getByRole("button", { name: names.resume, exact: true })
    .first()
    .click();
  const expired = await cfg.signSessionClaims({ sub: owner, exp: 1 });
  await resumed.context().addCookies([
    {
      name: "lingolearn_session",
      value: expired,
      url: base,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await setAnswer(resumed, samples.expired);
  await status(resumed, "Account sync failed");
  assert(
    await resumed
      .getByRole("button", { name: "Sign in again", exact: true })
      .isVisible(),
  );
  assert.equal(await field(resumed).inputValue(), samples.expired);
  passed.push(
    "Expired login stops cloud saves, retains local answers and offers sign-in recovery",
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ exam, passed, browserErrors: errors }, null, 2));
} finally {
  await browser.close();
}

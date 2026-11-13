// Actual local W-ID SDK signing and journal APIs. Only isolated loopback identities.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { SsoConfig } from "@w-id/sdk";
const { chromium } = await import(
  process.env.ENGLEARN_PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.ENGLEARN_TEST_URL || "http://127.0.0.1:31971";
assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const cfg = new SsoConfig({
  clientId: "ielts-local-test",
  clientSecret: "test-only-client-secret",
  jwtSecret: "test-only-jwt-secret-at-least-thirty-two-characters",
  redirectUri: base + "/api/auth/callback",
});
const owner = "learning-acceptance-" + randomUUID(),
  prefix = `lingolearn:learning:${encodeURIComponent("user:" + owner)}`;
const endpoint = "/api/learning/journal";
const course = JSON.parse(
    await readFile(
      new URL("../data/learning/grammar-v1.json", import.meta.url),
      "utf8",
    ),
  ),
  lesson = course.lessons[0];
const browser = await chromium.launch({ headless: true }),
  errors = [],
  passed = [];
async function pageFor(sub = owner) {
  const c = await browser.newContext({
    viewport: { width: 1440, height: 950 },
  });
  const token = await cfg.signSessionClaims({
    sub,
    login: "Learning acceptance",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  await c.addCookies([
    {
      name: "lingolearn_session",
      value: token,
      url: base,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await c.route("**/platform/bootstrap.js", (r) => r.fulfill({ body: "" }));
  await c.route("**/api/progress", (r) => r.fulfill({ json: {} }));
  await c.addInitScript(() => {
    localStorage.setItem("lingolearn:uiLocale", "en");
    localStorage.setItem("lingolearn:course", "en");
  });
  const p = await c.newPage();
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept());
  await p.goto(base + "/learn?tab=courses", { waitUntil: "networkidle" });
  await saved(p, sub);
  return p;
}
async function saved(p, sub = owner) {
  const key = `lingolearn:learning:${encodeURIComponent("user:" + sub)}`;
  await p.waitForFunction((key) => {
    const raw = localStorage.getItem(key),
      meta = JSON.parse(
        localStorage.getItem(key + ":grammar-v1:cloud") || "null",
      );
    return raw && meta?.signature === raw;
  }, key);
  await status(p, "Saved to your account");
}
async function status(p, text) {
  await p.getByTestId("exam-cloud-status").filter({ hasText: text }).waitFor();
}
const snapshot = (p) =>
  p.evaluate((key) => JSON.parse(localStorage.getItem(key)), prefix);
const api = async (p) => {
  const r = await p.request.get(base + endpoint);
  return { status: r.status(), data: await r.json() };
};
async function answer(p, i, choice = lesson.questions[i].answer) {
  await p.getByRole("radio").nth(choice).check();
  await p.getByRole("button", { name: "Check answer", exact: true }).click();
  await p
    .getByRole("button", {
      name: i === 3 ? "Finish lesson →" : "Next question →",
      exact: true,
    })
    .click();
}
try {
  const a = await pageFor();
  await a.goto(base + "/learn?lesson=en-be", { waitUntil: "networkidle" });
  await a
    .getByRole("button", { name: "Practise this lesson →", exact: true })
    .click();
  await answer(a, 0);
  await saved(a);
  const initial = await snapshot(a);
  assert.equal(initial.draft.answers.length, 1);
  assert.deepEqual((await api(a)).data.latest.session, initial);
  const b = await pageFor();
  assert.deepEqual(await snapshot(b), initial);
  await b.getByRole("link", { name: /Continue your lesson:/ }).click();
  assert.equal(await b.getByRole("radio").count(), 3);
  passed.push(
    "SDK-verified identity saves a checked-answer draft; a clean device restores it",
  );
  await b
    .context()
    .route("**/api/learning/journal", (r) =>
      r.request().method() === "POST" ? r.abort() : r.continue(),
    );
  await answer(b, 1, (lesson.questions[1].answer + 1) % 3);
  await status(b, "Account sync failed");
  const offline = await snapshot(b);
  for (let i = 1; i < 4; i++) await answer(a, i);
  await saved(a);
  const completed = await snapshot(a);
  assert.equal(completed.events.length, 1);
  await b.context().unroute("**/api/learning/journal");
  await b.getByRole("button", { name: "Retry sync", exact: true }).click();
  await status(b, "another device");
  const downloaded = b.waitForEvent("download");
  await b
    .getByRole("button", {
      name: "Back up and load account version",
      exact: true,
    })
    .click();
  const backup = await downloaded;
  assert.deepEqual(
    JSON.parse(await readFile(await backup.path(), "utf8")),
    offline,
  );
  await saved(b);
  assert.deepEqual(await snapshot(b), completed);
  passed.push(
    "Offline work survives failure; divergent devices resolve through backup then server restore",
  );
  await a.goto(base + "/learn?tab=library", { waitUntil: "networkidle" });
  await a.getByRole("spinbutton").fill("38");
  await a.getByRole("button", { name: "Go to page", exact: true }).click();
  await saved(a);
  const c = await pageFor();
  assert.equal((await snapshot(c)).bookPage, 38);
  await c.goto(base + "/learn?tab=history", { waitUntil: "networkidle" });
  await c.getByTestId("learning-round").locator("summary").click();
  assert.equal(await c.getByTestId("learning-round").locator("li").count(), 4);
  const otherSub = "learning-other-" + randomUUID(),
    other = await pageFor(otherSub);
  const otherJournal = (await api(other)).data.latest.session;
  assert.equal(otherJournal.events.length, 0);
  assert.equal(otherJournal.bookPage, 1);
  assert.equal(otherJournal.draft, null);
  passed.push(
    "Completed answer history and PDF bookmark follow the account; another account sees its own empty journal",
  );
  await c.goto(base + "/learn?lesson=en-present-simple", {
    waitUntil: "networkidle",
  });
  await c
    .getByRole("button", { name: "Practise this lesson →", exact: true })
    .click();
  await saved(c);
  const expired = await cfg.signSessionClaims({ sub: owner, exp: 1 });
  await c.context().addCookies([
    {
      name: "lingolearn_session",
      value: expired,
      url: base,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await c.getByRole("radio").first().check();
  await c.getByRole("button", { name: "Check answer", exact: true }).click();
  await status(c, "Account sync failed");
  assert.equal((await snapshot(c)).draft.answers.length, 1);
  assert.equal((await api(c)).status, 401);
  assert(
    await c
      .getByRole("button", { name: "Sign in again", exact: true })
      .isVisible(),
  );
  passed.push(
    "Expired sessions cannot save and retain the latest browser answer with sign-in recovery",
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed, pageErrors: errors }, null, 2));
} finally {
  await browser.close();
}

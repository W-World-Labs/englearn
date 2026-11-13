// Real SDK sessions and owner-scoped APIs; isolated loopback only.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { SsoConfig } from "@w-id/sdk";
const { chromium } = await import(
  process.env.ENGLEARN_PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.ENGLEARN_TEST_URL || "http://127.0.0.1:31971";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const config = new SsoConfig({
  clientId: "ielts-local-test",
  clientSecret: "test-only-client-secret",
  jwtSecret: "test-only-jwt-secret-at-least-thirty-two-characters",
  redirectUri: base + "/api/auth/callback",
});
const owner = "recall-acceptance-" + randomUUID(),
  key = "lingolearn:learning:" + encodeURIComponent("user:" + owner),
  browser = await chromium.launch(),
  errors = [];
async function device(sub = owner) {
  const c = await browser.newContext();
  await c.addCookies([
    {
      name: "lingolearn_session",
      value: await config.signSessionClaims({
        sub,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
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
  await p.goto(base + "/learn?tab=review", { waitUntil: "networkidle" });
  return p;
}
const snapshot = (p) =>
  p.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
async function saved(p) {
  await p.waitForFunction((key) => {
    const raw = localStorage.getItem(key),
      m = JSON.parse(localStorage.getItem(key + ":grammar-v1:cloud") || "null");
    return raw && m?.signature === raw;
  }, key);
}
async function rate(p, v) {
  await p.getByRole("button", { name: "Show answer", exact: true }).click();
  await p.locator(`[data-rating="${v}"]`).click();
}
try {
  const a = await device();
  await saved(a);
  const initial = await snapshot(a);
  assert(!initial.reviews);
  await a.getByRole("button", { name: "All cards", exact: true }).click();
  await a.getByLabel("Round size", { exact: true }).selectOption("6");
  await a
    .getByRole("button", { name: "Start recall practice (6)", exact: true })
    .click();
  await rate(a, 0);
  await saved(a);
  const draft = await snapshot(a),
    b = await device();
  await saved(b);
  assert.deepEqual(await snapshot(b), draft);
  await b
    .context()
    .route("**/api/learning/journal", (r) =>
      r.request().method() === "POST" ? r.abort() : r.continue(),
    );
  await rate(b, 1);
  await b
    .getByTestId("exam-cloud-status")
    .filter({ hasText: "Account sync failed" })
    .waitFor();
  const offline = await snapshot(b);
  for (let i = 1; i < 6; i++) await rate(a, 2);
  await saved(a);
  const complete = await snapshot(a);
  assert.equal(complete.reviews.length, 1);
  await b.context().unroute("**/api/learning/journal");
  await b.getByRole("button", { name: "Retry sync", exact: true }).click();
  await b
    .getByTestId("exam-cloud-status")
    .filter({ hasText: "another device" })
    .waitFor();
  const download = b.waitForEvent("download");
  await b
    .getByRole("button", {
      name: "Back up and load account version",
      exact: true,
    })
    .click();
  assert.deepEqual(
    JSON.parse(await readFile(await (await download).path(), "utf8")),
    offline,
  );
  await saved(b);
  assert.deepEqual(await snapshot(b), complete);
  const course = JSON.parse(
    await readFile(
      new URL("../data/learning/grammar-v1.json", import.meta.url),
      "utf8",
    ),
  );
  const rounds = ["zh", "ja", "ko", "es"].map((lang, i) => ({
    id: "offline-cloud-" + lang,
    startedAt: Date.now() - 20000 - i,
    at: Date.now() - 10000 - i,
    cards: [`g:${course.lessons.find((l) => l.language === lang).id}:0`],
    ratings: [i % 3],
  }));
  await b.getByText("Bring back offline practice", { exact: true }).click();
  await b
    .getByLabel("Choose result file", { exact: true })
    .setInputFiles({
      name: "results.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "lingolearn-review-results",
          version: 1,
          rounds,
        }),
      ),
    });
  await b
    .getByRole("button", { name: "Import reviewed records", exact: true })
    .click();
  await saved(b);
  assert.equal((await snapshot(b)).reviews.length, 5);
  const c = await device();
  await saved(c);
  assert.deepEqual(await snapshot(c), await snapshot(b));
  const response = await c.request.get(
    base + "/api/learning/journal?id=grammar-v1",
  );
  assert.deepEqual((await response.json()).attempt.session, await snapshot(c));
  const other = await device("recall-other-" + randomUUID());
  await other
    .getByRole("heading", { name: "Recall and reinforce", exact: true })
    .waitFor();
  assert.equal(await other.getByTestId("recall-card").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        passed: [
          "SDK recall draft resumes on a clean device",
          "Conflicting offline recall is backed up before account restore",
          "Five-language completed recall including historical imports survives clean-device account reload",
          "Other signed-in owner sees no recall draft",
        ],
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}

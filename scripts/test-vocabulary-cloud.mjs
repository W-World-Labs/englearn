// Requires the isolated local server configuration documented in test-ielts-cloud.mjs.
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
const cfg = new SsoConfig({
  clientId: "ielts-local-test",
  clientSecret: "test-only-client-secret",
  jwtSecret: "test-only-jwt-secret-at-least-thirty-two-characters",
  redirectUri: base + "/api/auth/callback",
});
const endpoint = "/api/vocabulary/attempts",
  owner = "vocabulary-acceptance-" + randomUUID();
const browser = await chromium.launch({ headless: true }),
  errors = [],
  passed = [];
async function pageFor(sub = owner) {
  const c = await browser.newContext({
    viewport: { width: 1440, height: 950 },
  });
  const token = await cfg.signSessionClaims({
    sub,
    login: "Vocabulary learner",
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
  await p.goto(base + "/vocabulary", { waitUntil: "networkidle" });
  await status(p);
  return p;
}
async function status(p, text = "Saved to your account") {
  await p.getByTestId("exam-cloud-status").filter({ hasText: text }).waitFor();
}
async function snapshot(p) {
  return p.evaluate(() =>
    JSON.parse(
      localStorage.getItem(
        Object.keys(localStorage).find(
          (k) =>
            k.startsWith("lingolearn:vocabulary:") && !k.endsWith(":cloud"),
        ),
      ),
    ),
  );
}
async function start(p) {
  await p
    .getByRole("button", { name: "Start vocabulary test →", exact: true })
    .click();
  if (await p.getByRole("dialog").isVisible())
    await p
      .getByRole("button", { name: "Start a new test", exact: true })
      .click();
  await p.getByRole("radio").first().waitFor();
}
async function answer(p, value, sync = true) {
  await p.locator(`input[type=radio][value="${value}"]`).check();
  if (sync) {
    const s = await snapshot(p);
    await p.waitForFunction(
      ({ id, value }) =>
        Object.keys(localStorage)
          .filter((k) => k.endsWith(":cloud"))
          .some((k) => {
            try {
              return (
                JSON.parse(JSON.parse(localStorage.getItem(k)).signature)
                  .answers[id] === value
              );
            } catch {
              return false;
            }
          }),
      { id: s.questions[s.index].id, value },
    );
    await status(p);
  }
}
async function api(p, query = "") {
  const r = await p.request.get(base + endpoint + query);
  return { status: r.status(), data: r.ok() ? await r.json() : null };
}
try {
  const a = await pageFor();
  await start(a);
  const original = await snapshot(a),
    q = original.questions[0];
  await answer(a, q.options[0]);
  const b = await pageFor();
  await b
    .getByRole("button", { name: "Continue vocabulary test →", exact: true })
    .first()
    .click();
  assert.equal(await b.locator("input:checked").inputValue(), q.options[0]);
  assert.deepEqual((await snapshot(b)).questions, original.questions);
  passed.push(
    "Real SDK cookies: a second device restores the same question sample, options and answers",
  );
  await a.route("**" + endpoint, (r) =>
    r.request().method() === "POST" ? r.abort() : r.continue(),
  );
  await answer(a, "unknown", false);
  await status(a, "Account sync failed");
  await answer(b, q.options[2]);
  await a.unroute("**" + endpoint);
  await a.getByRole("button", { name: "Retry sync", exact: true }).click();
  await status(a, "Another device updated");
  assert.equal(await a.locator("input:checked").inputValue(), "unknown");
  const backup = a.waitForEvent("download");
  await a
    .getByRole("button", {
      name: "Back up and load account version",
      exact: true,
    })
    .click();
  assert((await backup).suggestedFilename().endsWith(".json"));
  await status(a);
  assert.equal(await a.locator("input:checked").inputValue(), q.options[2]);
  await a.getByRole("button", { name: "Next word →", exact: true }).click();
  await answer(a, "unknown");
  const progressed = await snapshot(a);
  await b.reload({ waitUntil: "networkidle" });
  await status(b);
  await b
    .getByRole("button", { name: "Continue vocabulary test →", exact: true })
    .first()
    .click();
  assert.deepEqual((await snapshot(b)).questions, progressed.questions);
  assert.deepEqual((await snapshot(b)).adaptive, progressed.adaptive);
  assert.equal((await snapshot(b)).index, 1);
  await b.context().close();
  passed.push(
    "Offline edits are retained; revision conflicts export the local draft before restoring the account version",
  );
  for (let i = 0; i < 30; i++) {
    const s = await snapshot(a);
    if (!s.answers[s.questions[s.index].id]) await answer(a, "unknown", false);
    const last =
      (await a.getByTestId("vocabulary-next").getAttribute("data-finish")) ===
      "true";
    await a
      .getByRole("button", {
        name: last ? "Finish and view results →" : "Next word →",
        exact: true,
      })
      .click();
    if (last) break;
  }
  await a
    .getByRole("heading", { name: "Your vocabulary snapshot", exact: true })
    .waitFor();
  await status(a);
  const finished = (await api(a)).data.latest;
  assert.equal(finished.session.status, "finished");
  assert(
    finished.session.questions.length >= 12 &&
      finished.session.questions.length < 20,
  );
  assert.equal(finished.session.adaptive.version, 2);
  const summary = (await api(a)).data.items.find(
    (i) => i.id === finished.session.id,
  );
  assert.equal(summary.total, finished.session.questions.length);
  assert.equal(summary.answered, summary.total);
  await a
    .getByRole("button", { name: "← Back to vocabulary", exact: true })
    .click();
  await start(a);
  await answer(a, "unknown");
  const history = (await api(a)).data;
  assert.equal(history.total, 2);
  assert.equal(
    history.items.find((i) => i.id === original.id).status,
    "finished",
  );
  await a.reload({ waitUntil: "networkidle" });
  await status(a);
  await a
    .getByRole("button", { name: "View vocabulary report →", exact: true })
    .click();
  await a
    .getByRole("heading", { name: "Your vocabulary snapshot", exact: true })
    .waitFor();
  assert.deepEqual((await api(a, "?id=" + original.id)).data.attempt, finished);
  passed.push(
    "Submitted answer sheets stay immutable and reviewable while a new test remains in account history",
  );
  const other = await pageFor("vocabulary-other-" + randomUUID());
  assert.equal((await api(other)).data.total, 0);
  assert.equal((await api(other, "?id=" + original.id)).status, 404);
  const resumed = await pageFor();
  await resumed
    .getByRole("button", { name: "Continue vocabulary test →", exact: true })
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
  const latest = await snapshot(resumed);
  await answer(resumed, latest.questions[0].id, false);
  await status(resumed, "Account sync failed");
  assert(
    await resumed
      .getByRole("button", { name: "Sign in again", exact: true })
      .isVisible(),
  );
  passed.push(
    "Account isolation and expired-login recovery preserve browser answers without unauthorised saves",
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed, pageErrors: errors }, null, 2));
} finally {
  await browser.close();
}

// Real SDK sessions, assessment scoring and journal persistence; loopback only.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, mkdir } from "node:fs/promises";
import { SsoConfig } from "@w-id/sdk";
const { chromium } = await import(
  process.env.ENGLEARN_PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.ENGLEARN_TEST_URL || "http://127.0.0.1:31971";
assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const output =
  process.env.ENGLEARN_TEST_OUTPUT || "/tmp/englearn-v0130/browser";
await mkdir(output, { recursive: true });
const cfg = new SsoConfig({
  clientId: "ielts-local-test",
  clientSecret: "test-only-client-secret",
  jwtSecret: "test-only-jwt-secret-at-least-thirty-two-characters",
  redirectUri: base + "/api/auth/callback",
});
const owner = "plan-browser-" + randomUUID(),
  other = "plan-other-" + randomUUID();
const tokens = new Map();
for (const sub of [owner, other])
  tokens.set(
    sub,
    await cfg.signSessionClaims({
      sub,
      login: "Learning plan check",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
const course = JSON.parse(
  await readFile(
    new URL("../data/learning/grammar-v1.json", import.meta.url),
    "utf8",
  ),
);
async function api(path, sub = owner, body, method = body ? "POST" : "GET") {
  const r = await fetch(base + path, {
    method,
    headers: {
      Cookie: "lingolearn_session=" + tokens.get(sub),
      "Content-Type": "application/json",
      Origin: base,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(r.status, 200, path + " " + r.status);
  return r.json();
}
const sessions = [];
async function assess(language, correct) {
  const bank = JSON.parse(
    await readFile(
      new URL(`../data/packs/${language}/grammar.json`, import.meta.url),
      "utf8",
    ),
  );
  let s = await api("/api/session", owner, {
    learningLanguage: language,
    modules: ["grammar"],
  });
  const sessionId = s.sessionId;
  sessions.push(sessionId);
  for (let n = 0; !s.done; n++) {
    assert(n < 30 && s.item, "bounded grammar assessment");
    const item = bank.find((i) => i.id === s.item.id);
    assert(item);
    s = await api("/api/respond", owner, {
      sessionId,
      response: {
        itemId: item.id,
        selectedIndex: correct
          ? item.answerIndex
          : (item.answerIndex + 1) % item.options.length,
      },
    });
  }
  return api("/api/result?sessionId=" + sessionId);
}
const browser = await chromium.launch({ headless: true }),
  errors = [],
  passed = [];
async function pageFor(sub = owner, locale = "en", width = 390, course = "en") {
  const c = await browser.newContext({
    viewport: { width, height: 950 },
    reducedMotion: "reduce",
  });
  if (sub)
    await c.addCookies([
      {
        name: "lingolearn_session",
        value: tokens.get(sub),
        url: base,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  await c.route("**/platform/bootstrap.js", (r) => r.fulfill({ body: "" }));
  await c.route("**/api/progress", (r) => r.fulfill({ json: {} }));
  await c.addInitScript(
    ({ locale, course }) => {
      if (!localStorage.getItem("lingolearn:uiLocale"))
        localStorage.setItem("lingolearn:uiLocale", locale);
      if (!localStorage.getItem("lingolearn:course"))
        localStorage.setItem("lingolearn:course", course);
    },
    { locale, course },
  );
  const p = await c.newPage();
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
}
const goto = (p, path = "/learn?tab=courses") =>
  p.goto(base + path, { waitUntil: "networkidle" });
async function plan(p, language, stage) {
  await p
    .locator(
      `[data-testid="personal-plan"][data-status="ready"][data-language="${language}"][data-stage="${stage}"]`,
    )
    .waitFor();
}
async function saved(p, sub) {
  await p.waitForFunction(
    (key) => {
      const raw = localStorage.getItem(key),
        meta = JSON.parse(
          localStorage.getItem(key + ":grammar-v1:cloud") || "null",
        );
      return raw && meta?.signature === raw;
    },
    `lingolearn:learning:${encodeURIComponent("user:" + sub)}`,
  );
}
try {
  await assess("en", true);
  await assess("ja", false);
  const english = await api("/api/learning/plan?language=en"),
    japanese = await api("/api/learning/plan?language=ja");
  assert.equal(english.plan.stage, "advanced");
  assert.equal(japanese.plan.stage, "foundation");
  assert(english.evidence.grammar && japanese.evidence.grammar);
  assert.equal(
    (await api("/api/learning/plan?language=en&userId=" + owner, other)).plan
      .basis,
    "starter",
  );
  passed.push(
    "Actual adaptive grammar assessments produce separate English advanced and Japanese foundation practice stages; owner parameter cannot cross accounts",
  );

  const p = await pageFor();
  await goto(p, "/");
  await plan(p, "en", "advanced");
  assert.equal(await p.getByTestId("plan-lesson").count(), 1);
  await goto(p);
  await plan(p, "en", "advanced");
  assert.equal(await p.getByTestId("learning-lesson").count(), 8);
  await p.getByRole("button", { name: "All stages", exact: true }).click();
  assert.equal(await p.getByTestId("learning-lesson").count(), 24);
  await p.getByRole("button", { name: "For me", exact: true }).click();
  assert.equal(await p.getByTestId("learning-lesson").count(), 8);
  await p.locator('button[data-language="ja"]').first().click();
  await plan(p, "ja", "foundation");
  assert.equal(await p.getByTestId("learning-lesson").count(), 6);
  assert(
    (
      await p
        .getByTestId("plan-lesson")
        .evaluateAll((links) => links.map((a) => a.href))
    ).every((href) => href.includes("lesson=ja-")),
  );
  passed.push(
    "Home and courses use the account stage; manual selection remains available and switching languages recalculates",
  );

  // Deliberately release the old English response after switching to Japanese.
  let releaseOld, startedOld;
  const oldStarted = new Promise((resolve) => {
    startedOld = resolve;
  });
  const oldRelease = new Promise((resolve) => {
    releaseOld = resolve;
  });
  await p.context().route("**/api/learning/plan?language=en", async (r) => {
    startedOld();
    await oldRelease;
    await r.fulfill({ json: english }).catch(() => {});
  });
  await p.locator('button[data-language="en"]').first().click();
  await oldStarted;
  await p.locator('button[data-language="ja"]').first().click();
  await plan(p, "ja", "foundation");
  releaseOld();
  await p.context().unroute("**/api/learning/plan?language=en");
  await plan(p, "ja", "foundation");
  passed.push(
    "A delayed response from the previous learning language cannot replace the current plan",
  );

  let failure = 503;
  await p
    .context()
    .route("**/api/learning/plan?language=ja", (r) =>
      failure
        ? r.fulfill({ status: failure, json: { error: "unavailable" } })
        : r.continue(),
    );
  await goto(p);
  await p
    .locator('[data-testid="personal-plan"][data-status="error"]')
    .waitFor();
  assert.equal(
    await p.getByTestId("personal-plan").getAttribute("data-stage"),
    null,
  );
  assert.equal(await p.getByTestId("learning-lesson").count(), 24);
  failure = 0;
  await p.getByRole("button", { name: "Retry plan", exact: true }).click();
  await plan(p, "ja", "foundation");
  failure = 401;
  await goto(p);
  await p
    .locator('[data-testid="personal-plan"][data-status="expired"]')
    .waitFor();
  assert(
    await p
      .getByTestId("personal-plan")
      .getByRole("button", { name: "Sign in again", exact: true })
      .isVisible(),
  );
  await p.context().close();
  passed.push(
    "Unavailable evidence offers a retry and manual courses without an invented stage; expired sessions offer sign-in",
  );

  const fresh = await pageFor(other);
  await goto(fresh, "/");
  await plan(fresh, "en", "foundation");
  await fresh.getByTestId("plan-diagnostic").click();
  await fresh.getByRole("checkbox").first().waitFor();
  assert.equal(await fresh.getByRole("checkbox", { checked: true }).count(), 1);
  assert.deepEqual(
    JSON.parse(new URL(fresh.url()).searchParams.get("modules")),
    ["grammar"],
  );
  await fresh.context().close();

  // Two prior concepts on different dates; complete the third through the UI.
  const now = Date.now(),
    day = 86400000;
  const lessons = course.lessons
    .filter((l) => l.language === "en" && l.stage === "foundation")
    .slice(0, 3);
  await api("/api/learning/journal", other, {
    revision: null,
    session: {
      id: "grammar-v1",
      course: "grammar-v1",
      status: "running",
      startedAt: now - 5 * day,
      events: lessons.slice(0, 2).map((l, i) => ({
        id: randomUUID(),
        lessonId: l.id,
        at: now - (3 - i) * day,
        answers: l.questions.map((q) => q.answer),
      })),
      draft: null,
      bookPage: 1,
    },
  });
  const learner = await pageFor(other, "en", 1440);
  await goto(learner, "/learn?lesson=" + lessons[2].id);
  await learner
    .getByRole("button", { name: "Practise this lesson →", exact: true })
    .click();
  for (let i = 0; i < 4; i++) {
    await learner
      .getByRole("radio")
      .nth(lessons[2].questions[i].answer)
      .check();
    await learner
      .getByRole("button", { name: "Check answer", exact: true })
      .click();
    await learner
      .getByRole("button", {
        name: i === 3 ? "Finish lesson →" : "Next question →",
        exact: true,
      })
      .click();
  }
  await saved(learner, other);
  await goto(learner);
  await plan(learner, "en", "intermediate");
  const clean = await pageFor(other);
  await goto(clean);
  await plan(clean, "en", "intermediate");
  assert.equal(
    (await api("/api/learning/journal", other)).latest.session.events.length,
    3,
  );
  await clean.context().close();
  await learner.context().close();
  passed.push(
    "New accounts get a grammar-only diagnostic; three distinct successful concepts across dates advance the stage and a clean device restores it",
  );

  for (const [locale, width] of [
    ["en", 320],
    ["zh-CN", 390],
    ["ja", 390],
    ["ko", 390],
    ["es", 390],
    ["en", 1440],
  ]) {
    const q = await pageFor(owner, locale, width);
    await goto(q);
    await plan(q, "en", "advanced");
    assert(
      await q.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await q.screenshot({
      path: `${output}/plan-${locale}-${width}.png`,
      fullPage: true,
    });
    await q.context().close();
  }
  const guest = await pageFor(null);
  let guestPlanRequests = 0;
  guest.on("request", (r) => {
    if (r.url().includes("/api/learning/plan")) guestPlanRequests++;
  });
  await goto(guest);
  assert.equal(await guest.getByTestId("personal-plan").count(), 0);
  assert.equal(await guest.getByTestId("learning-lesson").count(), 24);
  assert.equal(guestPlanRequests, 0);
  passed.push(
    "Five interface translations fit 320–1440 px; guests retain manual learning without private plan requests",
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed, pageErrors: errors }, null, 2));
} finally {
  await browser.close();
  for (const id of sessions) {
    await api("/api/result?sessionId=" + id, owner, undefined, "DELETE");
    await api("/api/session?sessionId=" + id, owner, undefined, "DELETE");
  }
}

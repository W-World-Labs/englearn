// Real local SDK sessions; this script is intentionally restricted to loopback.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, mkdir } from "node:fs/promises";
import { SsoConfig } from "@w-id/sdk";
const { chromium } = await import(
  process.env.ENGLEARN_PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.ENGLEARN_TEST_URL || "http://127.0.0.1:31971";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const out =
  process.env.ENGLEARN_TEST_OUTPUT || "/tmp/englearn-workbench/browser";
await mkdir(out, { recursive: true });
const cfg = new SsoConfig({
  clientId: "ielts-local-test",
  clientSecret: "test-only-client-secret",
  jwtSecret: "test-only-jwt-secret-at-least-thirty-two-characters",
  redirectUri: base + "/api/auth/callback",
});
const owner = "workbench-" + randomUUID(),
  other = "workbench-other-" + randomUUID();
const tokens = {};
for (const sub of [owner, other])
  tokens[sub] = await cfg.signSessionClaims({
    sub,
    login: "Workbench verification",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
const variants = JSON.parse(
  await readFile(
    new URL("../data/learning/variants-v1.json", import.meta.url),
    "utf8",
  ),
).items;
const texts = JSON.parse(
  await readFile(
    new URL("../data/learning/readings-v1.json", import.meta.url),
    "utf8",
  ),
).items;
const browser = await chromium.launch({ headless: true });
const errors = [],
  passed = [];
async function api(path, sub = owner, body) {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      Cookie: "lingolearn_session=" + tokens[sub],
      Origin: base,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(r.status, 200, path);
  return r.json();
}
async function page(sub = owner, lang = "en", locale = "en", width = 390) {
  const c = await browser.newContext({
    viewport: { width, height: 950 },
    reducedMotion: "reduce",
  });
  if (sub)
    await c.addCookies([
      {
        name: "lingolearn_session",
        value: tokens[sub],
        url: base,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  await c.route("**/platform/bootstrap.js", (r) => r.fulfill({ body: "" }));
  await c.route("**/api/progress", (r) => r.fulfill({ json: {} }));
  await c.addInitScript(
    ({ lang, locale }) => {
      if (!localStorage.getItem("lingolearn:uiLocale"))
        localStorage.setItem("lingolearn:uiLocale", locale);
      if (!localStorage.getItem("lingolearn:course"))
        localStorage.setItem("lingolearn:course", lang);
    },
    { lang, locale },
  );
  const p = await c.newPage();
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
}
const goto = (p, path = "/learn") =>
  p.goto(base + path, { waitUntil: "networkidle" });
const journal = (p, sub = owner) =>
  p.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || "null"),
    "lingolearn:learning:" + encodeURIComponent(sub ? "user:" + sub : "guest"),
  );
async function saved(p, sub = owner) {
  await p.waitForFunction(
    (key) => {
      const raw = localStorage.getItem(key),
        meta = JSON.parse(
          localStorage.getItem(key + ":grammar-v1:cloud") || "null",
        );
      return raw && meta?.signature === raw;
    },
    "lingolearn:learning:" + encodeURIComponent("user:" + sub),
  );
}
async function answer(p, last = false) {
  const s = await journal(p);
  const d = s.workbench.draft,
    q =
      variants.find((q) => q.id === d.items[d.answers.length]) ||
      texts
        .flatMap((t) => t.questions)
        .find((q) => q.id === d.items[d.answers.length]);
  await p.getByRole("radio").nth(q.answer).check();
  await p.getByRole("button", { name: "Check answer →", exact: true }).click();
  await p
    .getByRole("button", {
      name: last ? "Finish practice →" : "Next question →",
      exact: true,
    })
    .click();
}
try {
  const p = await page();
  await goto(p);
  await p.getByRole("button", { name: "5 min", exact: true }).click();
  await p
    .getByRole("button", { name: "Start today’s learning →", exact: true })
    .click();
  await p.getByTestId("daily-lesson").waitFor();
  await saved(p);
  await p
    .getByRole("button", { name: "I have read the explanation →", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Start practice →", exact: true })
    .click();
  await answer(p);
  await saved(p);
  const second = await page();
  await goto(second);
  await second
    .getByRole("button", { name: "Continue today’s learning →", exact: true })
    .click();
  await second.getByRole("radio").first().waitFor();
  assert.equal((await journal(second)).workbench.draft.answers.length, 1);
  await answer(second, true);
  await second.getByTestId("daily-complete").waitFor();
  await saved(second);
  assert.equal(
    (await api("/api/learning/journal?id=grammar-v1")).attempt.session.workbench
      .rounds.length,
    1,
  );
  passed.push(
    "One-click daily plan, checked-answer persistence, clean-device continuation and actual completion",
  );
  await goto(
    second,
    "/learn?tab=reading&concept=en-foundation-text-v1&activity=reading",
  );
  await second.getByTestId("reading-text").waitFor();
  await second.locator("audio").evaluate(async (a) => {
    await a.play();
  });
  await second.waitForFunction(
    () => document.querySelector("audio")?.currentTime > 0.2,
  );
  await second.locator("audio").evaluate((a) => {
    a.pause();
    a.currentTime = 0;
  });
  await second
    .getByRole("button", { name: "Save for review", exact: true })
    .first()
    .click();
  await saved(second);
  await second
    .getByRole("link", { name: "Review saved words →", exact: true })
    .click();
  assert((await second.locator("main").innerText()).includes("Recall"));
  assert(
    (await journal(second)).workbench.words.includes(
      "r:en-foundation-text-v1:0",
    ),
  );
  passed.push(
    "Real audio playback/replay and contextual word saved into recall",
  );
  await goto(second, "/learn?tab=profile&concept=en-be&activity=practice");
  await second
    .getByRole("button", { name: "Start practice →", exact: true })
    .click();
  const nextDraft = (await journal(second)).workbench.draft;
  assert.equal(nextDraft.items.length, 2);
  assert(nextDraft.items.every((id) => !["en-be-v1", "en-be-v2"].includes(id)));
  await second
    .getByRole("button", { name: "Report this question", exact: true })
    .click();
  await second
    .getByRole("textbox")
    .fill("The plural explanation could be clearer.");
  let fail = true;
  await second.route("**/api/learning/feedback", (r) =>
    fail
      ? r.fulfill({ status: 503, json: { error: "test outage" } })
      : r.continue(),
  );
  await second
    .getByRole("button", { name: "Submit feedback", exact: true })
    .click();
  await second
    .getByRole("button", { name: "Retry submission", exact: true })
    .waitFor();
  fail = false;
  await second
    .getByRole("button", { name: "Retry submission", exact: true })
    .click();
  await second
    .getByText("Feedback saved. Your original answers are unchanged.", {
      exact: true,
    })
    .waitFor();
  assert.equal((await api("/api/learning/feedback")).total, 1);
  assert.equal((await api("/api/learning/feedback", other)).total, 0);
  passed.push(
    "Question feedback survives failed submission and is isolated by W-ID subject",
  );
  await answer(second);
  await answer(second, true);
  await saved(second);
  // A third short round reaches the remaining new practice items, not the old pair.
  await goto(second, "/learn?tab=profile&concept=en-be&activity=practice");
  await second
    .getByRole("button", { name: "Start practice →", exact: true })
    .click();
  await answer(second);
  await answer(second, true);
  await saved(second);
  assert.equal(
    new Set(
      (await journal(second)).workbench.rounds
        .filter((r) => r.target === "en-be")
        .flatMap((r) => r.items),
    ).size,
    6,
  );
  // Reading and listening share the question pool; a mode switch still selects fresh items.
  for (const kind of ["reading", "listening", "reading"]) {
    await goto(
      second,
      "/learn?tab=reading&concept=en-foundation-text-v1&activity=" + kind,
    );
    await second
      .getByRole("button", { name: "Start practice →", exact: true })
      .click();
    assert.equal((await journal(second)).workbench.draft.items.length, 2);
    await answer(second);
    await answer(second, true);
    await saved(second);
  }
  assert.equal(
    new Set(
      (await journal(second)).workbench.rounds
        .filter((r) => r.target === "en-foundation-text-v1")
        .flatMap((r) => r.items),
    ).size,
    6,
  );
  passed.push(
    "All six practice and comprehension items reached in two-question rounds without repeats",
  );
  const time = Date.now(),
    DAY = 86400000,
    items = variants
      .filter((q) => q.lessonId === "en-articles" && q.purpose === "practice")
      .slice(0, 2);
  let remote = (await api("/api/learning/journal?id=grammar-v1")).attempt;
  // Use another account for a legitimate dated fixture; never rewrite an existing result.
  const dated = {
    id: "grammar-v1",
    course: "grammar-v1",
    startedAt: time - 10 * DAY,
    status: "running",
    events: [],
    draft: null,
    bookPage: 1,
    workbench: {
      version: 1,
      preferences: {},
      rounds: [
        {
          id: "prior-practice",
          kind: "practice",
          target: "en-articles",
          items: items.map((q) => q.id),
          answers: items.map((q) => q.answer),
          startedAt: time - 5 * DAY,
          at: time - 5 * DAY + 100,
        },
      ],
      draft: null,
      days: [],
      difficulty: [],
      words: [],
    },
  };
  await api("/api/learning/journal", other, { session: dated, revision: null });
  const retest = await page(other);
  await goto(retest, "/learn?tab=profile&concept=en-articles&activity=retest");
  assert(!(await retest.locator("main").innerText()).includes("Use a before"));
  await retest
    .getByRole("button", { name: "Start practice →", exact: true })
    .click();
  for (let i = 0; i < 2; i++) {
    const s = await journal(retest, other),
      q = variants.find((q) => q.id === s.workbench.draft.items[i]);
    await retest.getByRole("radio").nth(q.answer).check();
    await retest
      .getByRole("button", { name: "Next question →", exact: true })
      .click();
    assert.equal(
      await retest.getByText("Accepted answer:", { exact: false }).count(),
      0,
    );
    if (i === 1)
      await retest
        .getByRole("button", { name: "Finish practice →", exact: true })
        .click();
  }
  await retest.getByTestId("activity-result").waitFor();
  await saved(retest, other);
  await goto(retest, "/learn?tab=profile&concept=en-articles&activity=retest");
  await retest
    .getByText("Delayed check available after", { exact: false })
    .waitFor();
  passed.push(
    "Legacy two-item practice, unseen retest, withheld feedback and next-batch waiting period",
  );
  const guest = await page(null);
  await goto(guest);
  assert.equal((await journal(guest, null)).workbench, undefined);
  const isolated = await page(other);
  await goto(isolated);
  assert(!(await journal(isolated, other)).workbench.words.length);
  passed.push(
    "Account/guest journals, preferences and saved words stay separate",
  );
  for (const lang of ["en", "zh", "ja", "ko", "es"]) {
    const a = await page(null, lang, lang, 320);
    await goto(a, "/learn?tab=reading");
    assert.equal(await a.locator("article").count(), 3);
    for (const tab of ["today", "profile", "week"]) {
      await goto(a, "/learn?tab=" + tab);
      assert(
        await a.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "no overflow " + lang + " " + tab,
      );
    }
    await a.screenshot({
      path: out + "/workbench-" + lang + "-320.png",
      fullPage: true,
    });
    const audioText = texts.find(
      (t) => t.language === lang && t.stage === "foundation",
    );
    await goto(
      a,
      "/learn?tab=reading&concept=" + audioText.id + "&activity=listening",
    );
    await a.locator("audio").evaluate(async (el) => {
      await el.play();
    });
    await a.waitForFunction(
      () => document.querySelector("audio")?.currentTime > 0.1,
    );
    await a.locator("audio").evaluate((el) => el.pause());
    await a.context().close();
  }
  passed.push(
    "Five interface/learning languages, 320px navigation and real audio playback in every language",
  );
  await goto(second, "/learn?tab=profile");
  await second.setViewportSize({ width: 1440, height: 1000 });
  await second.screenshot({
    path: out + "/knowledge-desktop.png",
    fullPage: true,
  });
  await goto(second, "/learn?tab=week");
  await second.screenshot({
    path: out + "/weekly-desktop.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(passed.map((x) => "PASS " + x).join("\n"));
} finally {
  await browser.close();
}

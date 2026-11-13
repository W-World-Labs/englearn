// Run against the registered local preview or an explicitly selected test origin.
// Uses real assessment APIs; creates and deletes only this run's guest session.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.ENGLEARN_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ENGLEARN_TEST_URL || 'http://127.0.0.1:38127';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: 'en-US', viewport: { width: 390, height: 844 } });
const page = await context.newPage();
let sessionId;
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(base + '/test?modules=%5B%22grammar%22%5D', { waitUntil: 'networkidle' });
  const created = page.waitForResponse(r => new URL(r.url()).pathname === '/api/session' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Start lesson →', exact: true }).click();
  let data = await (await created).json();
  sessionId = data.sessionId;
  const bank = JSON.parse(await readFile(new URL('../data/packs/en/grammar.json', import.meta.url), 'utf8'));
  for (const correct of [false, true]) {
    const item = bank.find(q => q.id === data.item.id);
    assert(item && !item.retired);
    const index = correct ? item.answerIndex : (item.answerIndex + 1) % item.options.length;
    await page.getByRole('radio').nth(index).locator('..').click();
    const answered = page.waitForResponse(r => new URL(r.url()).pathname === '/api/respond');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    data = await (await answered).json();
    assert.equal(data.lastGrade.correct, correct);
    const next = page.getByRole('button', { name: 'Continue →', exact: true });
    await next.waitFor();
    const feedback = page.locator('[role=status]').filter({ has: next });
    const message = await feedback.innerText();
    const progress = await page.evaluate(() => localStorage.getItem('lingolearn:progress'));
    assert(progress, 'practice XP must be persisted');
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(800); // Cross several one-second elapsed-time renders.
      assert.equal(await feedback.innerText(), message, 'feedback must not cycle with the clock');
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('lingolearn:progress')), progress, 'no repeated XP awards');
    assert.equal(await feedback.getByText('−1 attempt', { exact: true }).count(), correct ? 0 : 1);
    assert.equal(await page.getByRole('radio').count(), 0, 'wait for deliberate continuation');
    await next.click();
    await page.getByRole('radio').first().waitFor();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: real correct/wrong grading, stable feedback across clock ticks, one XP award, deliberate next question.');
} finally {
  if (sessionId) await page.request.delete(base + '/api/session?sessionId=' + encodeURIComponent(sessionId));
  await browser.close();
}

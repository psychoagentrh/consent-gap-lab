import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { app } from '../server.js';

const engines = { chromium, firefox, webkit };
const selected = process.env.CONSENT_GAP_BROWSER;
assert.ok(!selected || Object.hasOwn(engines, selected), 'unknown CONSENT_GAP_BROWSER; refusing to skip');
const dir = path.resolve(process.env.TEST_REPORT_DIR || path.join(tmpdir(), `consent-gap-cross-engine-${Date.now()}`));
const repository = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
assert.ok(dir !== repository && !dir.startsWith(repository + path.sep), 'TEST_REPORT_DIR must be outside the repository to keep reports private');
await mkdir(dir, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
  scope: 'Playwright Linux engines and CSS viewports, not physical devices or branded browser releases',
  clipboard: 'writeText deliberately denied; fallback tested, not native clipboard success',
  runs: [], failures: []
};
let server, base = process.env.CONSENT_GAP_BASE_URL;
if (!base) {
  server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}
base = base.replace(/\/$/, '');
const origin = new URL(base).origin;
assert.equal(base, origin, 'base must be a plain origin');
report.base = base;
const visible = (page, selector) => page.locator(selector).waitFor({ state: 'visible' });
const text = async (page, selector, pattern) => assert.match(await page.locator(selector).innerText(), pattern);
const hidden = async (page, selector) => assert.equal(await page.locator(selector).isVisible(), false, `stale ${selector}`);
async function layout(page) {
  const dimensions = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth]);
  assert.ok(dimensions[1] <= dimensions[0], JSON.stringify(dimensions));
  return dimensions;
}
function observe(page) {
  const requests = [], errors = [];
  page.on('request', r => requests.push({ method: r.method(), url: r.url() }));
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => errors.push(`request failed: ${r.url()}`));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`); });
  return { requests, errors };
}
function clean(observed) {
  assert.deepEqual(observed.errors, []);
  assert.ok(observed.requests.every(r => r.method === 'GET' && new URL(r.url).origin === origin), 'only same-origin GETs');
}
try {
  for (const name of selected ? [selected] : Object.keys(engines)) {
    let browser;
    try {
      browser = await engines[name].launch({ headless: true });
      for (const width of [1280, 390, 320]) {
        const run = { engine: name, version: browser.version(), width, checks: [], passed: false };
        report.runs.push(run);
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        try {
          await context.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
            writeText: async () => { throw new DOMException('Deliberate test denial', 'NotAllowedError'); }
          } }));
          const page = await context.newPage();
          page.setDefaultTimeout(10000);
          const observed = observe(page);
          await page.goto(`${base}/demo.html#spender-mismatch`, { waitUntil: 'networkidle' });
          const expectation = (await page.locator('#demo-expected-spender').innerText()).trim();
          assert.match(expectation, /^0x[0-9a-fA-F]{40}$/);
          await page.locator('#try-spender-demo').click();
          await page.waitForURL(`${base}/inspect.html`);
          await page.locator('[data-example="bounded"]').click();
          await page.locator('#expected-spender').fill(expectation);
          const before = observed.requests.length;
          await page.locator('button[type="submit"]').click();
          await visible(page, '#approval-result');
          await text(page, '#comparison-label', /Matches the amount you entered/);
          await text(page, '#spender-comparison-label', /Different spender than you entered/);
          await text(page, '#approval-details', /20000000000000000000/);
          assert.equal(await page.locator('#approval-title').evaluate(e => e === document.activeElement), true);
          run.layouts = [await layout(page)];
          await page.screenshot({ path: path.join(dir, `${name}-${width}-spender.png`), fullPage: true });
          run.checks.push('three-step lesson, independent comparisons, result focus, reflow');
          await page.locator('#copy-summary').click();
          await text(page, '#copy-status', /Copy unavailable.*no data was uploaded/);
          await page.locator('#expected-spender').fill(`0x${'1'.repeat(40)}`);
          await hidden(page, '#approval-result');
          await text(page, '#copy-status', /^$/);
          await page.locator('button[type="submit"]').click();
          await visible(page, '#approval-result');
          await text(page, '#spender-comparison-label', /Matches the spender you entered/);
          run.checks.push('clipboard denial, stale-state invalidation, address-match recovery');
          await page.locator('#claimed-amount').fill('20.0000000000000000001');
          await page.locator('button[type="submit"]').click();
          await visible(page, '#decode-error');
          await hidden(page, '#approval-result');
          await page.locator('#claimed-amount').fill('20');
          await page.locator('button[type="submit"]').click();
          await visible(page, '#approval-result');
          await text(page, '#comparison-label', /Matches the amount/);
          await page.locator('#calldata').fill('0x12345678');
          await page.locator('button[type="submit"]').click();
          await visible(page, '#decode-error');
          await hidden(page, '#approval-result');
          await page.locator('[data-example="bounded"]').click();
          await page.locator('button[type="submit"]').focus();
          await page.keyboard.press('Enter');
          await visible(page, '#approval-result');
          assert.equal(observed.requests.length, before, 'local interactions must not make requests');
          run.checks.push('overprecision and unsupported selector refusal, keyboard recovery, no interaction requests');
          await page.goto(`${base}/inspect.html?example=maximum-vs-20`, { waitUntil: 'networkidle' });
          await visible(page, '#approval-result');
          await text(page, '#comparison-label', /Request is larger than your entered amount/);
          await page.reload();
          await visible(page, '#approval-result');
          await text(page, '#comparison-label', /Request is larger/);
          await page.locator('#copy-example-link').click();
          await text(page, '#example-copy-status', /Copy unavailable.*contains no entered data/);
          const lessonRequests = observed.requests.length;
          await page.locator('#claimed-amount').fill('21');
          await page.waitForURL(`${base}/inspect.html`);
          await hidden(page, '#approval-result');
          await page.locator('#clear-data').click();
          for (const id of ['calldata', 'decimals', 'claimed-amount', 'expected-spender']) assert.equal(await page.locator(`#${id}`).inputValue(), '');
          assert.equal(await page.locator('#calldata').evaluate(e => e === document.activeElement), true);
          assert.equal(observed.requests.length, lessonRequests, 'lesson copy/edit/reset must not make requests');
          run.layouts.push(await layout(page));
          clean(observed);
          run.requests = observed.requests;
          run.checks.push('fixed lesson reload, copy fallback, query removal, reset and focus');
        } finally { await context.close(); }
        const fallback = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 900 } });
        try {
          const page = await fallback.newPage();
          const observed = observe(page);
          await page.goto(`${base}/spender-evidence.html#spender-mismatch`);
          await text(page, '#spender-match', /2026-10-15T18:43:34.676Z/);
          await text(page, '#spender-mismatch', /2026-10-15T18:49:28.601Z/);
          await page.locator('#spender-mismatch > summary').focus();
          await page.keyboard.press('Enter');
          assert.equal(await page.locator('#spender-mismatch').evaluate(e => e.open), false);
          await page.keyboard.press('Enter');
          assert.equal(await page.locator('#spender-mismatch').evaluate(e => e.open), true);
          run.layouts.push(await layout(page));
          await page.screenshot({ path: path.join(dir, `${name}-${width}-no-js-evidence.png`), fullPage: true });
          clean(observed);
          run.fallbackRequests = observed.requests;
          run.checks.push('JavaScript-disabled dated evidence, native keyboard details recovery, reflow');
          run.passed = true;
          console.log(JSON.stringify({ engine: name, width, passed: true, groups: run.checks.length }));
        } finally { await fallback.close(); }
      }
    } catch (error) {
      report.failures.push({ engine: name, message: error.stack || String(error) });
      console.error(`${name}: ${error.stack || error}`);
    } finally { await browser?.close(); }
  }
} finally {
  await new Promise(resolve => server ? server.close(resolve) : resolve());
  report.finishedAt = new Date().toISOString();
  report.passed = report.failures.length === 0 && report.runs.length === (selected ? 1 : 3) * 3 && report.runs.every(r => r.passed);
  await writeFile(path.join(dir, 'cross-engine.json'), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ passed: report.passed, successfulViewports: report.runs.filter(r => r.passed).length, report: path.join(dir, 'cross-engine.json') }));
if (!report.passed) process.exitCode = 1;

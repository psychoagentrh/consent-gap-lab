import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from 'playwright';
import { app } from '../server.js';
import { approvalExamples, decodeApproval } from '../public/approval.js';
import { examplePath, exampleURL, invalidExampleMessage } from '../public/inspector-link.js';

const server = http.createServer(app);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.CONSENT_GAP_BASE_URL || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const expected = decodeApproval(approvalExamples.maximum, '18', '20');
const reports = [];
async function waitResult(page) { await page.locator('#approval-result').waitFor({ state: 'visible' }); }
try {
  for (const width of [1280, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 920 } });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin });
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push({ url: request.url(), method: request.method(), data: request.postData() }));
    await page.goto(base + '/inspect.html', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#approval-result').isVisible(), false);
    await page.locator('#open-example-link').click();
    await waitResult(page);
    assert.equal(new URL(page.url()).search, '?example=maximum-vs-20');
    assert.equal(await page.locator('#calldata').inputValue(), approvalExamples.maximum);
    assert.equal(await page.locator('#claimed-amount').inputValue(), '20');
    assert.equal(await page.locator('#decimals').inputValue(), '18');
    assert.equal(await page.locator('#example-note').isVisible(), true);
    assert.match(await page.locator('#comparison-label').innerText(), /Request is larger/);
    assert.ok((await page.locator('#comparison-detail').innerText()).includes(expected.comparison.differenceAmount));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'approval-title');
    await page.reload({ waitUntil: 'networkidle' });
    await waitResult(page);
    const mark = requests.length;
    await page.locator('#copy-example-link').click();
    await page.waitForFunction(() => document.querySelector('#example-copy-status').textContent.includes('copied'));
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), exampleURL);
    const layout = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth, viewport: innerWidth,
      columns: getComputedStyle(document.querySelector('.inspect-grid')).gridTemplateColumns.split(' ').length,
      inputTop: document.querySelector('.input-panel').getBoundingClientRect().top,
      outputTop: document.querySelector('.output-panel').getBoundingClientRect().top
    }));
    assert.ok(layout.document <= width, JSON.stringify(layout));
    assert.equal(layout.columns, width > 760 ? 2 : 1);
    const capture = process.env.CAPTURE_EXAMPLE_LINK_DEMO === '1' && !process.env.CONSENT_GAP_BASE_URL && width !== 320;
    await page.screenshot({ path: capture ? `public/demo/example-link-${width}.png` : `/tmp/consent-gap-example-link-${width}.png`, fullPage: true });
    await page.locator('#copy-summary').click();
    await page.waitForFunction(() => document.querySelector('#copy-status').textContent.includes('copied'));
    assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Exact difference:/);

    // Edit each field independently: remove the preset URL and all stale output.
    for (const [field, value] of [['claimed-amount', '123'], ['decimals', '6'], ['calldata', approvalExamples.bounded]]) {
      await page.locator('#' + field).fill(value);
      await page.waitForURL(base + '/inspect.html');
      assert.equal(new URL(page.url()).search, '');
      assert.equal(await page.locator('#approval-result').isVisible(), false);
      assert.equal(await page.locator('#amount-comparison').isVisible(), false);
      assert.equal(await page.locator('#copy-status').innerText(), '');
      assert.equal(await page.locator('#example-copy-status').innerText(), '');
      assert.equal(await page.locator('#example-note').isVisible(), false);
    }
    await page.locator('#copy-example-link').click();
    await page.waitForFunction(() => document.querySelector('#example-copy-status').textContent.includes('copied'));
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), exampleURL);
    assert.equal(requests.length, mark, 'local edits/copies must not create requests');
    assert.deepEqual(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)]), [[], []]);

    // Failed copy offers the fixed link, never the visitor's current URL/data.
    await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async () => { throw new Error('Synthetic clipboard denial'); } }));
    await page.locator('#copy-example-link').click();
    await page.waitForFunction(() => document.querySelector('#example-copy-status').textContent.includes('Copy unavailable'));
    assert.equal(await page.locator('#open-example-link').getAttribute('href'), examplePath);
    assert.equal(requests.length, mark);
    // A pending clipboard promise cannot restore success/denial after clear.
    for (const fail of [false, true]) {
      await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: () => new Promise((resolve, reject) => { window.finishExampleCopy = { resolve, reject }; }) }));
      await page.locator('#copy-example-link').click();
      await page.locator('#clear-data').click();
      await page.evaluate(fail => { const done = window.finishExampleCopy; if (fail) done.reject(new Error('Synthetic delayed denial')); else done.resolve(); }, fail);
      assert.equal(await page.locator('#example-copy-status').innerText(), '');
      assert.equal(await page.locator('#calldata').inputValue(), '');
    }

    const invalid = ['?example=unknown', '?example=maximum-vs-20&example=maximum-vs-20', '?example=maximum-vs-20&spender=synthetic-do-not-echo', '?amount=99', '?example=maximum-vs-20#synthetic-do-not-echo'];
    for (const suffix of invalid) {
      await page.goto(base + '/inspect.html' + suffix, { waitUntil: 'networkidle' });
      assert.equal(new URL(page.url()).search, '');
      assert.equal(new URL(page.url()).hash, '');
      assert.equal(await page.locator('#example-link-error').innerText(), invalidExampleMessage);
      assert.equal(await page.locator('#calldata').inputValue(), '');
      assert.equal(await page.locator('#claimed-amount').inputValue(), '');
      assert.equal(await page.locator('#approval-result').isVisible(), false);
      assert.doesNotMatch(await page.locator('body').innerText(), /synthetic-do-not-echo/);
      await page.locator('[data-example="bounded"]').click();
      assert.equal(await page.locator('#example-link-error').isVisible(), false);
      await page.getByRole('button', { name: 'Decode locally', exact: true }).click();
      await waitResult(page);
      assert.match(await page.locator('#comparison-label').innerText(), /Matches/);
    }
    await page.goto(base + '/inspect.html', { waitUntil: 'networkidle' });
    await page.goto(base + examplePath, { waitUntil: 'networkidle' });
    await waitResult(page);
    await page.goBack({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#calldata').inputValue(), '');
    assert.equal(await page.locator('#approval-result').isVisible(), false);
    await page.goForward({ waitUntil: 'networkidle' });
    await waitResult(page);
    await page.locator('#clear-data').click();
    assert.equal(new URL(page.url()).search, '');
    assert.equal(await page.locator('#approval-result').isVisible(), false);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#calldata').inputValue(), '');
    assert.deepEqual(errors, []);
    assert.ok(requests.every(request => request.method === 'GET' && request.data === null));
    assert.ok(requests.every(request => !request.url.includes(approvalExamples.maximum) && !request.url.includes(approvalExamples.bounded)));
    reports.push({ width, layout, invalidLinksRefused: invalid.length, clipboard: 'success/denial/delayed-success/delayed-denial', privacy: 'no interaction requests, serialization or app storage', reloadAndHistory: 'pass', pageErrors: errors });
    await context.close();
  }
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(base + examplePath, { waitUntil: 'networkidle' });
  assert.match(await page.locator('noscript').innerText(), /example-link loading/);
  assert.equal(await page.locator('noscript a').getAttribute('href'), '/demo.html');
  assert.equal(await page.locator('#calldata').inputValue(), '');
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.locator('#calldata').fill('synthetic-private-not-for-upload');
  await page.getByRole('button', { name: 'Decode locally', exact: true }).click({ noWaitAfter: true });
  await page.evaluate(() => Promise.resolve());
  assert.deepEqual(requests, []);
  assert.equal(new URL(page.url()).search, '?example=maximum-vs-20');
  await context.close();
  console.log(JSON.stringify({ base, reports, noJavaScript: 'explicit gallery fallback; no form request' }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

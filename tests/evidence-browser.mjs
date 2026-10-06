import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { app } from '../server.js';

const server = http.createServer(app);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.CONSENT_GAP_BASE_URL || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const evidence = JSON.parse(await readFile(new URL('../public/owner-observations.json', import.meta.url), 'utf8'));

try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 920 } });
    const page = await context.newPage();
    const requests = [], errors = [];
    page.on('request', request => requests.push({ method: request.method(), url: request.url() }));
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/evidence.html', { waitUntil: 'networkidle' });
    await page.locator('#digest-status.match').waitFor();
    assert.equal(await page.locator('#observed-at').innerText(), evidence.observations[0].outputs.observedAt);
    assert.equal(await page.locator('#observed-digest').innerText(), evidence.observations[0].outputs.payloadDigest);
    assert.equal(await page.locator('#current-digest').innerText(), evidence.observations[0].outputs.payloadDigest);
    assert.equal(await page.locator('#fixture-schema').innerText(), 'consent-gap/v1');
    assert.match(await page.locator('#method').innerText(), /not browser automation/);
    assert.equal(await page.locator('#tested-revision').innerText(), evidence.testedWorkspaceRevision);
    assert.equal(await page.locator('#source-revision').innerText(), evidence.publicSourceRevision);
    assert.match(await page.locator('#source-link').getAttribute('href'), new RegExp(evidence.publicSourceRevision));
    const initialRequests = requests.length;
    await page.locator('[data-observation="bounded"]').focus();
    await page.keyboard.press('Enter');
    await page.locator('#digest-status.match').waitFor();
    assert.equal(await page.locator('#observed-at').innerText(), evidence.observations[1].outputs.observedAt);
    assert.equal(await page.locator('#scope').innerText(), 'No. Exactly 20 TEST in this fixture.');
    assert.equal(await page.locator('#current-digest').innerText(), evidence.observations[1].outputs.payloadDigest);
    assert.equal(await page.locator('[data-observation="bounded"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#observation-link').getAttribute('href'), '/evidence.html?case=bounded');
    assert.equal(requests.length, initialRequests);
    const layout = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      columns: getComputedStyle(document.querySelector('.evidence-grid')).gridTemplateColumns.split(' ').length
    }));
    assert.ok(layout.width <= layout.viewport + 1, JSON.stringify(layout));
    assert.equal(layout.columns, width === 1280 ? 2 : 1);
    if (process.env.CAPTURE_EVIDENCE_DEMO === '1') {
      await page.screenshot({ path: `public/demo/evidence-${width}.png`, fullPage: true });
    }
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#digest-status.match').waitFor();
    assert.equal(await page.locator('[data-observation="bounded"]').getAttribute('aria-pressed'), 'true');
    assert.ok(requests.every(request => request.method === 'GET' && new URL(request.url).origin === new URL(base).origin));
    assert.ok(!requests.some(request => /\/(api|jobs|run)(\/|\?|$)/.test(new URL(request.url).pathname)));
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ base, width, evidence: 'both historical outputs match local fixture digests', interactionRequests: 0, layout }));
    await context.close();
  }

  for (const failure of ['http', 'schema', 'json']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    let fail = true;
    await page.route('**/owner-observations.json', route => fail
      ? route.fulfill({
          status: failure === 'http' ? 503 : 200,
          contentType: 'application/json',
          body: failure === 'json' ? '{bad' : '{}'
        })
      : route.continue());
    await page.goto(base + '/evidence.html', { waitUntil: 'networkidle' });
    assert.match(await page.locator('#load-status').innerText(), /No result has been substituted/);
    assert.equal(await page.locator('#observation').isVisible(), false);
    assert.equal(await page.locator('[data-observation="bounded"]').isDisabled(), true);
    fail = false;
    await page.locator('#retry').click();
    await page.locator('#digest-status.match').waitFor();
    assert.equal(await page.locator('#observation').isVisible(), true);
    await context.close();
  }

  const mismatchContext = await browser.newContext();
  const mismatchPage = await mismatchContext.newPage();
  const changed = structuredClone(evidence);
  changed.observations[0].outputs.payloadDigest = '0'.repeat(64);
  await mismatchPage.route('**/owner-observations.json', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(changed)
  }));
  await mismatchPage.goto(base + '/evidence.html', { waitUntil: 'networkidle' });
  await mismatchPage.locator('#digest-status.mismatch').waitFor();
  assert.match(await mismatchPage.locator('#digest-status').innerText(), /Different bytes/);
  await mismatchContext.close();

  const hashContext = await browser.newContext();
  await hashContext.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: { digest: async () => { throw new Error('test: hashing unavailable'); } }
    });
  });
  const hashPage = await hashContext.newPage();
  await hashPage.goto(base + '/evidence.html', { waitUntil: 'networkidle' });
  await hashPage.locator('#digest-status.mismatch').waitFor();
  assert.equal(await hashPage.locator('#current-digest').innerText(), 'Unavailable');
  assert.match(await hashPage.locator('#digest-status').innerText(), /no fixture match has been established/);
  assert.equal(await hashPage.locator('#observed-digest').innerText(), evidence.observations[0].outputs.payloadDigest);
  await hashContext.close();

  const raceContext = await browser.newContext();
  await raceContext.addInitScript(() => {
    const original = crypto.subtle.digest.bind(crypto.subtle);
    let calls = 0;
    crypto.subtle.digest = async (...args) => {
      if (++calls === 1) {
        await new Promise(resolve => setTimeout(resolve, 700));
        const result = await original(...args);
        window.delayedDigestDone = true;
        return result;
      }
      return original(...args);
    };
  });
  const racePage = await raceContext.newPage();
  await racePage.goto(base + '/evidence.html', { waitUntil: 'domcontentloaded' });
  await racePage.locator('[data-observation="bounded"]:enabled').waitFor();
  await racePage.locator('[data-observation="bounded"]').click();
  await racePage.locator('#digest-status.match').waitFor();
  await racePage.waitForFunction(() => window.delayedDigestDone === true);
  assert.equal(await racePage.locator('#current-digest').innerText(), evidence.observations[1].outputs.payloadDigest);
  assert.equal(await racePage.locator('[data-observation="bounded"]').getAttribute('aria-pressed'), 'true');
  await raceContext.close();

  const fallbackContext = await browser.newContext();
  const fallbackPage = await fallbackContext.newPage();
  await fallbackPage.goto(base + '/evidence.html?case=wallet-private-data', { waitUntil: 'networkidle' });
  await fallbackPage.locator('#digest-status.match').waitFor();
  assert.equal(await fallbackPage.locator('[data-observation="unlimited"]').getAttribute('aria-pressed'), 'true');
  assert.equal(new URL(fallbackPage.url()).searchParams.get('case'), 'unlimited');
  await fallbackContext.close();

  const noScriptContext = await browser.newContext({ javaScriptEnabled: false });
  const noScriptPage = await noScriptContext.newPage();
  await noScriptPage.goto(base + '/evidence.html', { waitUntil: 'networkidle' });
  assert.match(await noScriptPage.locator('noscript').innerText(), /redacted JSON/);
  assert.equal(await noScriptPage.locator('noscript a[href="/owner-observations.json"]').getAttribute('href'), '/owner-observations.json');
  await noScriptContext.close();
  console.log('evidence HTTP/schema/JSON refusal and retry, digest mismatch/unavailability/race, permalink recovery and JS-disabled fallback passed');
} finally {
  await browser.close();
  server.close();
}

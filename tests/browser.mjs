import { chromium } from 'playwright';
import http from 'node:http';
import { app } from '../server.js';
import assert from 'node:assert/strict';

const server = http.createServer(app);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.CONSENT_GAP_BASE_URL || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless:true});
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({viewport:{width, height:850}, deviceScaleFactor:1});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    assert.doesNotMatch(await page.locator('.tabs, .fake-app').allInnerTexts().then(parts => parts.join(' ')), /Unlimited|Exact amount|allowance/i);
    await page.getByRole('button', {name:'Yes, it could'}).click();
    assert.match(await page.locator('#result').innerText(), /Unlimited TEST allowance/);
    assert.match(page.url(), /case=unlimited&answer=future/);
    await page.context().grantPermissions(['clipboard-read','clipboard-write'], {origin:new URL(base).origin});
    await page.getByRole('button', {name:'Copy result link'}).click();
    await page.getByRole('button', {name:'Copied ✓'}).waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), page.url());
    await page.reload();
    assert.match(await page.locator('#result').innerText(), /You spotted it/);
    await page.screenshot({path:`/tmp/consent-gap-${width}-unlimited.png`,fullPage:true});
    await page.getByRole('button', {name:'02 / Specimen B'}).click();
    await page.getByRole('button', {name:'Yes, it could'}).click();
    assert.match(await page.locator('#result').innerText(), /20 TEST allowance/);
    assert.match(await page.locator('#result').innerText(), /Surprise/);
    await page.getByRole('button', {name:'Try another prediction'}).click();
    await page.getByRole('button', {name:'No, capped at 20 TEST'}).click();
    assert.match(await page.locator('#result').innerText(), /You spotted it/);
    await page.screenshot({path:`/tmp/consent-gap-${width}.png`, fullPage:true});
    const metrics = await page.evaluate(() => ({documentWidth:document.documentElement.scrollWidth, viewportWidth:innerWidth, resultVisible:!document.querySelector('#result').hidden, heading:document.querySelector('h1').getBoundingClientRect().width}));
    assert.ok(metrics.documentWidth <= width, `horizontal overflow at ${width}: ${JSON.stringify(metrics)}`);
    assert.deepEqual(errors, []);
    console.log(`viewport ${width}: ${JSON.stringify(metrics)}, screenshot /tmp/consent-gap-${width}.png`);
    await page.close();
  }
  const page = await browser.newPage();
  await page.goto(base + '/?case=bad&answer=wallet');
  assert.equal(await page.locator('#choices').isVisible(), true);
  assert.equal(await page.locator('[data-case=unlimited]').getAttribute('aria-pressed'), 'true');
  console.log('malformed share URL falls back to a fresh synthetic case');
  await page.setViewportSize({width:390,height:850});
  await page.goto(base + '/demo.html');
  assert.equal(await page.locator('.demo-captures img').count(), 2);
  await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  for (const route of ['/demo/1280-unlimited.png','/demo/1280-bounded.png','/demo/390-unlimited.png','/demo/390-bounded.png']) {
    const response = await page.request.get(base + route);
    assert.equal(response.status(), 200);
    assert.match(response.headers()['content-type'], /image\/png/);
  }
  console.log('authentic gallery loads at mobile width; all four PNG captures served');
  await page.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

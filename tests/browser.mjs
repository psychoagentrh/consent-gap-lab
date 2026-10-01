import { chromium } from 'playwright';
import http from 'node:http';
import { app } from '../server.js';
import assert from 'node:assert/strict';

const server = http.createServer(app);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
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
    await page.reload();
    assert.match(await page.locator('#result').innerText(), /You spotted it/);
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
  await page.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

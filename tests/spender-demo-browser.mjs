import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { app } from '../server.js';

const server = http.createServer(app);
const external = process.env.CONSENT_GAP_BASE_URL;
if (!external) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = (external || `http://127.0.0.1:${server.address().port}`).replace(/\/$/, '');
const output = process.env.TEST_REPORT_DIR || '/workspace/product-checkpoints/spender-demo-browser';
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true});
const report = {base, checkedAt:new Date().toISOString(), checks:[], limitations:'Automated DOM/layout and axe checks, not human visual review, accessibility certification, wallet execution or Cloud proof.'};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  for (const width of [1280,390,320]) {
    const context = await browser.newContext({viewport:{width,height:900}});
    const page = await context.newPage();
    const requests = [], errors = [];
    page.on('request', request => requests.push({url:request.url(),method:request.method()}));
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/demo.html#spender-mismatch', {waitUntil:'networkidle'});
    const response = await page.request.get(base + '/demo/spender-capture.json');
    assert.equal(response.status(), 200);
    const record = await response.json();
    assert.equal(await page.locator('#spender-demo-steps li').count(), 3);
    const expected = await page.locator('#demo-expected-spender').innerText();
    assert.equal(expected, record.inputs.expectedSpender);
    const images = await page.locator('.spender-demo-grid img').all();
    assert.equal(images.length, record.captures.length);
    for (const [index, image] of images.entries()) {
      await image.evaluate(img => img.decode());
      const dimensions = await image.evaluate(img => ({width:img.naturalWidth,height:img.naturalHeight}));
      const capture = record.captures[index];
      assert.deepEqual(dimensions, {width:capture.pixelWidth,height:capture.pixelHeight});
      const bytesResponse = await page.request.get(base + '/demo/' + capture.filename);
      assert.equal(bytesResponse.status(), 200);
      assert.equal(hash(await bytesResponse.body()), capture.sha256);
    }
    assert.deepEqual(await page.locator('#spender-mismatch time').evaluateAll(nodes => nodes.map(node=>node.dateTime)), record.captures.map(capture=>capture.observedAt));
    const layout = await page.evaluate(() => ({viewport:innerWidth,document:document.documentElement.scrollWidth,overflowing:[...document.querySelectorAll('#spender-mismatch *')].filter(node=>{const rect=node.getBoundingClientRect();return rect.width && (rect.left < -1 || rect.right > innerWidth+1);}).map(node=>node.tagName)}));
    assert.ok(layout.document <= width);
    assert.deepEqual(layout.overflowing, []);
    const axe = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']).analyze();
    assert.deepEqual(axe.violations, [], JSON.stringify(axe.violations));
    await page.locator('#spender-mismatch').screenshot({path:output + `/demo-${width}.png`, animations:'disabled'});
    await page.locator('#try-spender-demo').focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(base + '/inspect.html');
    await page.waitForLoadState('networkidle');
    const initialRequests = requests.length;
    await page.getByRole('button',{name:'Example: 20 tokens',exact:true}).click();
    assert.equal(await page.locator('#calldata').inputValue(), record.inputs.calldata);
    await page.getByRole('textbox',{name:'Spender you expected'}).fill(expected);
    await page.getByRole('button',{name:'Decode locally',exact:true}).click();
    assert.equal(await page.locator('#comparison-label').innerText(), record.outputs.amountLabel);
    assert.equal(await page.locator('#spender-comparison-label').innerText(), record.outputs.spenderLabel);
    assert.ok((await page.locator('#spender-comparison-detail').innerText()).includes(record.outputs.decodedSpender));
    assert.equal(requests.length, initialRequests);
    assert.ok(requests.every(request=>request.method==='GET' && request.url.startsWith(base + '/')));
    assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length,cookies:document.cookie})), {local:0,session:0,cookies:''});
    report.checks.push({width,state:'demo-gallery-and-reproduction',layout,violations:axe.violations,incomplete:axe.incomplete,interactionRequests:requests.length-initialRequests,pageErrors:errors});
    await context.close();
  }
  const context = await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:900}});
  const page = await context.newPage();
  await page.goto(base + '/demo.html#spender-mismatch', {waitUntil:'networkidle'});
  assert.equal(await page.locator('#spender-demo-steps li').count(), 3);
  assert.equal(await page.locator('#demo-expected-spender').innerText(), '0x'+'2'.repeat(40));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
  assert.ok(await page.locator('.spender-demo-grid img').evaluateAll(nodes=>nodes.every(img=>img.complete && img.naturalWidth > 0)));
  await page.locator('#try-spender-demo').click();
  await page.waitForURL(base + '/inspect.html');
  assert.ok((await page.locator('noscript').innerText()).length > 0);
  report.noJavaScript = 'Static steps, images and inspector fallback available';
  await context.close();
  report.outcome = 'passed';
  console.log(JSON.stringify({base,outcome:report.outcome,checks:report.checks.length,incompleteRules:report.checks.reduce((sum,row)=>sum+row.incomplete.length,0),noJavaScript:report.noJavaScript}));
} finally {
  await writeFile(output + '/demo-report.json', JSON.stringify(report,null,2)+'\n');
  await browser.close();
  if (server.listening) await new Promise(resolve=>server.close(resolve));
}

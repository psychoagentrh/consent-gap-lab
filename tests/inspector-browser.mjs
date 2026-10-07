import { chromium } from 'playwright';
import http from 'node:http';
import assert from 'node:assert/strict';
import { app } from '../server.js';
import { approvalExamples, decodeApproval, MAX_UINT256 } from '../public/approval.js';
const server = http.createServer(app);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.CONSENT_GAP_BASE_URL || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless:true});
try {
  for (const width of [1280,390]) {
    const context = await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1});
    const page = await context.newPage();
    const requests = [];
    const errors = [];
    page.on('request', req => requests.push({url:req.url(),method:req.method()}));
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.getByRole('link', {name:/Have an approval request/}).click();
    await page.waitForLoadState('networkidle');
    const cleanURL = page.url();
    assert.equal(new URL(cleanURL).pathname, '/inspect.html');
    assert.equal(await page.locator('#approval-result').isVisible(), false);
    const evidenceLink = page.getByRole('link', {name:'dated owner-controlled HTTP JSON observations'});
    assert.equal(await evidenceLink.getAttribute('href'), '/evidence.html');
    assert.match(await page.locator('.inspection-note').innerText(), /Those observations do not test this local decoder or a wallet journey/);
    assert.doesNotMatch(await page.locator('body').innerText(), /proof[^.]*pending/i);
    await evidenceLink.click();
    await page.waitForLoadState('networkidle');
    assert.equal(new URL(page.url()).pathname, '/evidence.html');
    assert.match(await page.locator('.status').innerText(), /Not a live test or independent attestation/);
    await page.goBack();
    await page.waitForLoadState('networkidle');
    // Refuse all later network access: every interaction below must still work.
    const initialRequests = requests.length;
    await page.route('**/*', route => route.abort());
    await page.evaluate(() => {
      for (const method of ['getItem','setItem']) Object.defineProperty(Storage.prototype, method, {value:() => {throw new Error('App tried persistence');}});
      Object.defineProperty(window, 'fetch', {value:() => {throw new Error('App tried network');}});
    });
    const decode = () => page.getByRole('button', {name:'Decode locally',exact:true}).click();
    await page.getByRole('button', {name:'Example: 20 tokens',exact:true}).click();
    assert.equal(await page.locator('#calldata').inputValue(), approvalExamples.bounded);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'calldata');
    await decode();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'approval-title');
    assert.match(await page.locator('#allowance-label').innerText(), /Bounded amount request/);
    assert.match(await page.locator('#approval-details').innerText(), /20 tokens \(token identity unknown\)/);
    assert.match(await page.locator('#allowance-meaning').innerText(), /not a completed swap/i);
    assert.match(await page.locator('#approval-result').innerText(), /does not prove the target is an ERC-20/);
    // Real Chromium clipboard plus explicit denial fallback, no server upload.
    await context.grantPermissions(['clipboard-read','clipboard-write'], {origin:new URL(base).origin});
    await page.getByRole('button', {name:'Copy decoded summary'}).click();
    await page.getByText('Summary copied to clipboard. Not uploaded or linked publicly.', {exact:true}).waitFor();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(clipboard, /not a safety verdict/);
    assert.match(clipboard, /ERC-721 uses the same selector/);
    assert.match(await page.locator('#approval-result').innerText(), /token ID, not an allowance/);
    assert.ok(clipboard.includes(decodeApproval(approvalExamples.bounded).spender));
    assert.ok(clipboard.includes(decodeApproval(approvalExamples.bounded).rawAllowance));
    assert.doesNotMatch(clipboard, /calldata=|\?data=/);
    // Capture synthetic data only; never publish a visitor's pasted request.
    const columns = await page.locator('.inspect-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    assert.equal(columns, width > 760 ? 2 : 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const screenshot = process.env.CAPTURE_INSPECT_DEMO === '1' ? `public/demo/inspect-${width}.png` : `/tmp/consent-gap-inspect-${width}.png`;
    await page.screenshot({path:screenshot,fullPage:true});
    await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', {configurable:true,value:async () => {throw new Error('Clipboard denied');}}));
    await page.getByRole('button', {name:'Copy decoded summary'}).click();
    await page.getByText('Copy unavailable. Select the decoded text manually; no data was uploaded.', {exact:true}).waitFor();
    await page.locator('#decimals').fill('');
    assert.equal(await page.locator('#approval-result').isVisible(), false, 'editing invalidates stale result');
    await decode();
    assert.match(await page.locator('#approval-details').innerText(), /Unknown\. No token metadata lookup/);
    assert.doesNotMatch(await page.locator('#approval-details').innerText(), /20 tokens/);
    await page.getByRole('button', {name:'Example: max allowance'}).click();
    await decode();
    assert.ok((await page.locator('#approval-details').innerText()).includes(MAX_UINT256));
    assert.match(await page.locator('#allowance-label').innerText(), /Maximum uint256/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', {name:'Example: zero allowance'}).click();
    await decode();
    assert.match(await page.locator('#allowance-label').innerText(), /Zero amount/);
    assert.match(await page.locator('#allowance-meaning').innerText(), /does not prove a revocation succeeded/);
    for (const invalid of ['<script>alert(1)</script>', approvalExamples.bounded + '00', approvalExamples.bounded.replace('095ea7b3','a9059cbb')]) {
      await page.locator('#calldata').fill(invalid);
      await decode();
      assert.equal(await page.locator('#approval-result').isVisible(), false);
      assert.equal(await page.locator('#decode-error').isVisible(), true);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'calldata');
    }
    await page.locator('#calldata').fill(approvalExamples.bounded);
    await page.locator('#decimals').fill('1.5');
    await decode();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'decimals');
    assert.equal(await page.locator('#decimals').getAttribute('aria-invalid'), 'true');
    await page.locator('#decimals').fill('18');
    // Submit by keyboard and recover from previous errors.
    await page.keyboard.press('Enter');
    await page.locator('#approval-result').waitFor({state:'visible'});
    assert.equal(await page.locator('#decode-error').isVisible(), false);
    await page.getByRole('button', {name:'Clear form',exact:true}).click();
    assert.equal(await page.locator('#calldata').inputValue(), '');
    assert.equal(await page.locator('#decimals').inputValue(), '');
    assert.equal(await page.locator('#approval-details').innerText(), '');
    assert.equal(await page.locator('#approval-result').isVisible(), false);
    assert.equal(await page.locator('#copy-status').innerText(), '');
    assert.equal(page.url(), cleanURL);
    assert.equal(requests.length, initialRequests, 'zero requests after initial asset loading');
    assert.deepEqual(errors, []);
    assert.ok(requests.every(req => req.method === 'GET' && new URL(req.url).origin === new URL(base).origin));
    assert.ok(requests.every(req => !/private\/product|runs|calldata=|095ea7b3/.test(req.url)));
    console.log(JSON.stringify({width,columns,initialRequests,interactionRequests:requests.length-initialRequests,errors,screenshot,checks:'dated evidence link/boundary, exact/max/zero, unknown decimals, strict refusal, edit invalidation, clipboard success/denial, keyboard/reset, privacy, no overflow'}));
    await context.close();
  }
  // Without scripts, the fallback cannot submit pasted form data.
  const context = await browser.newContext({javaScriptEnabled:false});
  const page = await context.newPage();
  const noScriptRequests = [];
  page.on('request', req => noScriptRequests.push(req.url()));
  await page.goto(base + '/inspect.html');
  await page.waitForLoadState('networkidle');
  assert.equal(await page.getByRole('link', {name:'dated owner-controlled HTTP JSON observations'}).getAttribute('href'), '/evidence.html');
  const before = noScriptRequests.length;
  await page.locator('#calldata').fill(approvalExamples.bounded);
  await page.getByRole('button', {name:'Decode locally',exact:true}).click({noWaitAfter:true});
  await page.waitForTimeout(200);
  assert.equal(noScriptRequests.length, before);
  assert.equal(new URL(page.url()).search, '');
  console.log('noscript: CSP blocks form submission; no pasted data request');
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

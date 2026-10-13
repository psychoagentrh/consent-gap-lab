import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { app } from '../server.js';
import { approvalExamples } from '../public/approval.js';
const server = http.createServer(app);
if (!process.env.CONSENT_GAP_BASE_URL) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = (process.env.CONSENT_GAP_BASE_URL || `http://127.0.0.1:${server.address().port}`).replace(/\/$/, '');
const output = process.env.TEST_REPORT_DIR || '/workspace/product-checkpoints/spender-comparison-browser';
const browser = await chromium.launch({headless:true});
const match = '0x' + '1'.repeat(40), other = '0x' + '2'.repeat(40);
const report = {base, checkedAt:new Date().toISOString(), checks:[]};
await mkdir(output,{recursive:true});
try {
  for (const width of [1280,390,320]) {
    const context = await browser.newContext({viewport:{width,height:900}});
    await context.addInitScript(() => {
      globalThis.copiedSummary = '';
      globalThis.copyDenied = false;
      globalThis.deferCopy = false;
      Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:async text => {
        if (globalThis.copyDenied) throw new Error('Clipboard unavailable');
        if (globalThis.deferCopy) await new Promise(resolve => {globalThis.resolveCopy = resolve;});
        globalThis.copiedSummary = text;
      }});
    });
    const page = await context.newPage();
    const requests = [], errors = [];
    page.on('request', request => requests.push({url:request.url(),method:request.method()}));
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/inspect.html?example=maximum-vs-20',{waitUntil:'networkidle'});
    const initialRequests = requests.length;
    const field = page.getByRole('textbox',{name:'Spender you expected'});
    const decode = () => page.getByRole('button',{name:'Decode locally',exact:true}).click();
    const label = page.locator('#spender-comparison-label');
    const detail = page.locator('#spender-comparison-detail');
    assert.equal(await field.inputValue(),'');
    assert.equal(await page.locator('#spender-comparison').isVisible(),false);
    await field.fill(other);
    // Chromium can lag the synchronous history.replaceState protocol event.
    await page.waitForURL(base + '/inspect.html');
    assert.equal(new URL(page.url()).search,'');
    assert.equal(await page.locator('#approval-result').isVisible(),false);
    await decode();
    assert.equal(await label.innerText(),'Different spender than you entered');
    assert.match(await page.locator('#comparison-label').innerText(),/Request is larger/);
    // Existing examples clear expectations rather than carry visitor data into a lesson.
    await page.getByRole('button',{name:'Example: 20 tokens',exact:true}).click();
    assert.equal(await field.inputValue(),'');
    await field.fill(other);
    await decode();
    assert.equal(await page.locator('#comparison-label').innerText(),'Matches the amount you entered');
    assert.equal(await label.innerText(),'Different spender than you entered');
    assert.ok((await detail.innerText()).includes(other));
    assert.ok((await detail.innerText()).includes(match));
    assert.match(await page.locator('#spender-comparison').innerText(),/A match does not prove the right chain, contract, owner or a safe spender/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({path:output + `/mismatch-${width}.png`,fullPage:true});
    const audits = [];
    const audit = async state => {
      const result = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']).analyze();
      assert.deepEqual(result.violations,[],JSON.stringify(result.violations));
      audits.push({state,violations:result.violations,incomplete:result.incomplete,passes:result.passes.length});
    };
    await audit('amount-match-spender-mismatch');
    await page.getByRole('button',{name:'Copy decoded summary',exact:true}).click();
    const copied = await page.evaluate(() => globalThis.copiedSummary);
    assert.ok(copied.includes(other));
    assert.match(copied,/Matches the amount you entered/);
    assert.match(copied,/Different spender than you entered/);
    assert.match(copied,/No checksum, chain, contract or owner verification/);
    assert.doesNotMatch(copied,/\?data=|\?spender=/);
    await page.getByRole('button',{name:'Copy max vs 20 example link',exact:true}).click();
    assert.equal(await page.evaluate(() => globalThis.copiedSummary),'https://lab.psychoagent.com/inspect.html?example=maximum-vs-20');
    await field.fill(match);
    assert.equal(await label.innerText(),'');
    assert.equal(await detail.innerText(),'');
    assert.equal(await page.locator('#copy-status').innerText(),'');
    await field.press('Enter');
    assert.equal(await label.innerText(),'Matches the spender you entered');
    await audit('spender-match');
    for (const invalid of ['alice.eth','0x1234','<script>alert(1)</script>']) {
      await field.fill(invalid);
      await decode();
      assert.equal(await page.locator('#approval-result').isVisible(),false);
      assert.equal(await page.evaluate(() => document.activeElement.id),'expected-spender');
      assert.equal(await field.getAttribute('aria-invalid'),'true');
      assert.match(await page.locator('#decode-error').innerText(),/40 hex digits/);
      assert.ok(!(await page.locator('#decode-error').innerText()).includes(invalid));
    }
    await audit('invalid-spender');
    await field.fill(other);
    await decode();
    assert.equal(await field.getAttribute('aria-invalid'),null);
    // Spender comparison remains useful with unknown decimals and no amount claim.
    await page.locator('#claimed-amount').fill('');
    await page.locator('#decimals').fill('');
    await decode();
    assert.equal(await page.locator('#amount-comparison').isVisible(),false);
    assert.equal(await label.innerText(),'Different spender than you entered');
    await page.evaluate(() => {globalThis.copyDenied=true;});
    await page.getByRole('button',{name:'Copy decoded summary',exact:true}).click();
    await page.getByText('Copy unavailable. Select the decoded text manually; no data was uploaded.').waitFor();
    await page.evaluate(() => {globalThis.copyDenied=false;globalThis.deferCopy=true;});
    await page.getByRole('button',{name:'Copy decoded summary',exact:true}).click();
    await page.waitForFunction(() => typeof globalThis.resolveCopy === 'function');
    await field.fill(match);
    await page.evaluate(() => {globalThis.resolveCopy();globalThis.deferCopy=false;});
    assert.equal(await page.locator('#copy-status').innerText(),'');
    for (const name of ['Example: max allowance','Example: zero allowance']) {
      await field.fill(other);
      await page.getByRole('button',{name,exact:true}).click();
      assert.equal(await field.inputValue(),'');
      await decode();
      assert.equal(await page.locator('#spender-comparison').isVisible(),false);
    }
    await field.fill(other);
    await decode();
    await page.getByRole('button',{name:'Clear form',exact:true}).click();
    assert.equal(await field.inputValue(),'');
    assert.equal(await detail.innerText(),'');
    assert.equal(await page.locator('#spender-comparison').isVisible(),false);
    assert.equal(await page.evaluate(() => document.activeElement.id),'calldata');
    assert.equal(requests.length,initialRequests,'editing, decoding, copying and resetting remain local');
    assert.ok(requests.every(request => request.url.startsWith(base + '/') && request.method === 'GET'));
    assert.deepEqual(await page.evaluate(async () => ({local:localStorage.length,session:sessionStorage.length,cookies:document.cookie,databases:(await indexedDB.databases()).length})),{local:0,session:0,cookies:'',databases:0});
    assert.equal(new URL(page.url()).search,'');
    assert.deepEqual(errors,[]);
    report.checks.push({width,initialRequests,interactionRequests:requests.length-initialRequests,errors,audits,checks:'independent amount/spender outcomes, optional blank and unknown decimals, invalid focus/recovery, example/reset clearing, copy caveats/denial/race, fixed-share privacy, local-only/no-storage, no horizontal overflow'});
    await context.close();
  }
  const context = await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:850}});
  const page = await context.newPage();
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto(base + '/inspect.html',{waitUntil:'networkidle'});
  const initial = requests.length;
  await page.locator('#calldata').fill(approvalExamples.bounded);
  await page.locator('#decimals').fill('18');
  await page.locator('#claimed-amount').fill('20');
  await page.locator('#expected-spender').fill(other);
  await page.getByRole('button',{name:'Decode locally',exact:true}).click({noWaitAfter:true});
  assert.equal(requests.length,initial);
  assert.equal(new URL(page.url()).search,'');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await context.close();
  report.noJavaScriptCannotSubmit = true;
  report.passed = true;
  await writeFile(output + '/spender-report.json',JSON.stringify(report,null,2) + '\n');
  console.log(JSON.stringify({passed:true,base,viewports:report.checks.map(item => item.width),interactionRequests:report.checks.map(item => item.interactionRequests),axeViolations:report.checks.flatMap(item => item.audits).map(item => item.violations.length),noJavaScriptCannotSubmit:true,report:output + '/spender-report.json'}));
} finally {
  await browser.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}

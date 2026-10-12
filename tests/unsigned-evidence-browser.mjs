import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { app } from '../server.js';

const server = http.createServer(app);
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const base = (process.env.CONSENT_GAP_BASE_URL || `http://127.0.0.1:${server.address().port}`).replace(/\/$/, '');
const output = process.env.TEST_REPORT_DIR || '/workspace/product-checkpoints/unsigned-evidence-browser';
const browser = await chromium.launch({headless:true});
await mkdir(output, {recursive:true});
const report = {base, checkedAt:new Date().toISOString(), checks:[]};
try {
  const viewports = [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}],['narrow',{width:320,height:720}]];
  for (const [name,viewport] of viewports) {
    const context = await browser.newContext({viewport,javaScriptEnabled:false});
    const page = await context.newPage();
    const requests = [], failures = [], badResponses = [];
    page.on('request', request => requests.push({url:request.url(),method:request.method()}));
    page.on('requestfailed', request => failures.push({url:request.url(),error:request.failure()?.errorText}));
    page.on('response', response => { if(response.status() >= 400) badResponses.push({url:response.url(),status:response.status()}); });
    const response = await page.goto(base + '/unsigned-evidence.html', {waitUntil:'networkidle'});
    assert.equal(response.status(),200);
    assert.equal(await page.locator('h1').innerText(),'The bytes.\nNot the button.');
    for (const id of ['maximum','bounded']) {
      const details = page.locator('#' + id);
      assert.equal(await details.getAttribute('open'), '');
      assert.ok(await details.locator('time').isVisible());
      // Native details must collapse and recover without a script.
      await details.locator('summary').click();
      assert.equal(await details.getAttribute('open'),null);
      await details.locator('summary').click();
      assert.ok(await details.locator('time').isVisible());
    }
    const width = await page.evaluate(() => ({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(width.scroll <= width.viewport, `${name}: horizontal overflow ${JSON.stringify(width)}`);
    await page.screenshot({path:output + '/' + name + '-unsigned-evidence.png',fullPage:true});
    // A fresh share-link visit must expose the output even with JavaScript disabled.
    for (const id of ['maximum','bounded']) {
      await page.goto(base + '/unsigned-evidence.html#' + id,{waitUntil:'networkidle'});
      assert.ok(await page.locator('#' + id + ' time').isVisible());
      assert.equal(new URL(page.url()).hash,'#' + id);
    }
    // Inspect current read-only JSON; no write or job endpoint is used by this page.
    const recorded = await context.request.get(base + '/unsigned-owner-observations.json');
    assert.equal(recorded.status(),200);
    const evidence = await recorded.json();
    assert.equal(evidence.observations.length,2);
    for (const id of ['maximum','bounded']) {
      const fixture = await context.request.get(base + '/api/unsigned-approvals/' + id);
      assert.equal(fixture.status(),200);
      const body = await fixture.json();
      assert.equal(body.synthetic,true);
      assert.equal(body.transactionSubmitted,false);
      assert.equal(body.payloadDigest,evidence.observations.find(item => item.input.approvalCase === id).outputs.payloadDigest);
    }
    assert.equal(failures.length,0,JSON.stringify(failures));
    assert.equal(badResponses.length,0,JSON.stringify(badResponses));
    assert.ok(requests.every(({url,method}) => url.startsWith(base + '/') && method === 'GET'),JSON.stringify(requests));
    assert.ok(requests.every(({url}) => !/jobs|workflow|uipath|run\?/i.test(new URL(url).pathname)),JSON.stringify(requests));
    report.checks.push({name,viewport,width,javaScriptEnabled:false,nativeDetailsRecovery:true,shareTargetsVisible:true,recordedFixtureDigestsMatch:true,requests,failures,badResponses});
    await context.close();
  }
  report.accessibility = [];
  for (const [name,viewport] of viewports) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    await page.goto(base + '/unsigned-evidence.html',{waitUntil:'networkidle'});
    const audit = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']).analyze();
    assert.deepEqual(audit.violations,[],JSON.stringify(audit.violations));
    // Tab to the summary and exercise native keyboard collapse/recovery.
    for (let tab = 0; tab < 30; tab++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => document.activeElement === document.querySelector('#maximum summary'))) break;
    }
    assert.ok(await page.evaluate(() => document.activeElement === document.querySelector('#maximum summary')));
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#maximum').getAttribute('open'),null);
    await page.keyboard.press('Enter');
    assert.ok(await page.locator('#maximum time').isVisible());
    report.accessibility.push({name,violations:audit.violations,incomplete:audit.incomplete,passes:audit.passes.length,keyboardDetailsRecovery:true});
    await page.getByRole('link',{name:'Try the byte comparison'}).click();
    assert.equal(new URL(page.url()).pathname,'/inspect.html');
    assert.equal(new URL(page.url()).search,'?example=maximum-vs-20');
    await page.locator('#approval-result').waitFor({state:'visible'});
    assert.match(await page.locator('#comparison-label').innerText(), /Request is larger/);
    await context.close();
  }
  report.interactiveInspectorLinkPassed = true;
  await writeFile(output + '/report.json',JSON.stringify(report,null,2) + '\n');
  console.log(JSON.stringify({passed:true,...report}));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

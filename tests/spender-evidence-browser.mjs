import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdir,writeFile } from 'node:fs/promises';
import { app } from '../server.js';
const server=http.createServer(app);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=(process.env.CONSENT_GAP_BASE_URL||`http://127.0.0.1:${server.address().port}`).replace(/\/$/,'');
const output=process.env.TEST_REPORT_DIR||'/workspace/product-checkpoints/spender-evidence-browser';
const browser=await chromium.launch({headless:true});
const viewports=[['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}],['narrow',{width:320,height:720}]];
const report={base,checkedAt:new Date().toISOString(),checks:[],accessibility:[]};
await mkdir(output,{recursive:true});
try {
  for(const [name,viewport] of viewports) {
    const context=await browser.newContext({viewport,javaScriptEnabled:false});
    const page=await context.newPage();
    const requests=[],failures=[],badResponses=[];
    page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
    page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));
    page.on('response',r=>{if(r.status()>=400)badResponses.push({url:r.url(),status:r.status()});});
    assert.equal((await page.goto(base+'/spender-evidence.html',{waitUntil:'networkidle'})).status(),200);
    assert.equal(await page.locator('h1').innerText(),'Right amount.\nDifferent spender.');
    assert.equal(await page.locator('tbody tr').count(),2);
    assert.match(await page.locator('tbody tr').nth(0).innerText(),/equal.*equal/s);
    assert.match(await page.locator('tbody tr').nth(1).innerText(),/equal.*different/s);
    const boxes=[];
    for(const id of ['spender-match','spender-mismatch']) {
      const details=page.locator('#'+id);
      assert.equal(await details.getAttribute('open'),'');
      const summary=details.locator('summary');
      await summary.click();
      assert.equal(await details.getAttribute('open'),null);
      await summary.click();
      assert.ok(await details.locator('time').isVisible());
      await page.goto(base+'/spender-evidence.html#'+id,{waitUntil:'networkidle'});
      assert.equal(new URL(page.url()).hash,'#'+id);
      assert.ok(await page.locator('#'+id+' time').isVisible());
      const hash=page.locator('#'+id+' code').last();
      const rect=await hash.boundingBox();
      assert.ok(rect.x>=0 && rect.x+rect.width<=viewport.width,`${name} digest outside viewport`);
      boxes.push({id,digest:rect});
    }
    const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(width.scroll<=width.viewport,JSON.stringify(width));
    for(const link of await page.locator('a[href^="/"]').evaluateAll(links=>[...new Set(links.map(link=>link.getAttribute('href').split('#')[0]))])) {
      assert.equal((await context.request.get(base+link)).status(),200,link);
    }
    const recorded=await context.request.get(base+'/spender-owner-observations.json');
    const evidence=await recorded.json();
    for(const {input,outputs} of evidence.observations) {
      const response=await context.request.get(base+'/api/unsigned-approvals/'+input.approvalCase);
      assert.equal(response.status(),200);
      assert.equal((await response.json()).payloadDigest,outputs.payloadDigest);
    }
    await page.goto(base+'/spender-evidence.html',{waitUntil:'networkidle'});
    await page.screenshot({path:output+'/'+name+'-spender-evidence.png',fullPage:true});
    assert.deepEqual(failures,[]); assert.deepEqual(badResponses,[]);
    assert.ok(requests.every(r=>r.method==='GET' && r.url.startsWith(base+'/')));
    assert.ok(requests.every(r=>!/^\/(?:private|api\/(?:runs|jobs)|broker)(?:\/|$)/.test(new URL(r.url).pathname)));
    report.checks.push({name,viewport,width,boxes,javaScriptEnabled:false,nativeDetailsRecovery:true,shareTargetsVisible:true,readOnlyRequests:true,recordedFixtureDigestsMatch:true,requests,failures,badResponses});
    await context.close();
  }
  for(const [name,viewport] of viewports) {
    const context=await browser.newContext({viewport});
    const page=await context.newPage();
    await page.goto(base+'/spender-evidence.html',{waitUntil:'networkidle'});
    const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']).analyze();
    assert.deepEqual(audit.violations,[],JSON.stringify(audit.violations));
    for(let tab=0;tab<35;tab++) {
      await page.keyboard.press('Tab');
      if(await page.evaluate(()=>document.activeElement===document.querySelector('#spender-match summary'))) break;
    }
    assert.ok(await page.evaluate(()=>document.activeElement===document.querySelector('#spender-match summary')));
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#spender-match').getAttribute('open'),null);
    await page.keyboard.press('Enter');
    assert.ok(await page.locator('#spender-match time').isVisible());
    await page.getByRole('link',{name:'Try the three-step spender lesson'}).click();
    assert.equal(new URL(page.url()).pathname,'/demo.html');
    assert.equal(new URL(page.url()).hash,'#spender-mismatch');
    const expectedSpender=await page.locator('#demo-expected-spender').innerText();
    await page.locator('#try-spender-demo').click();
    assert.equal(new URL(page.url()).pathname,'/inspect.html');
    assert.equal(new URL(page.url()).search,'');
    await page.getByRole('button',{name:'Example: 20 tokens',exact:true}).click();
    await page.locator('#expected-spender').fill(expectedSpender);
    await page.getByRole('button',{name:'Decode locally',exact:true}).click();
    await page.locator('#approval-result').waitFor({state:'visible'});
    assert.match(await page.locator('#comparison-label').innerText(),/matches/i);
    assert.match(await page.locator('#spender-comparison-label').innerText(),/different/i);
    report.accessibility.push({name,violations:audit.violations,incomplete:audit.incomplete,passes:audit.passes.length,keyboardRecovery:true,localWalkthroughReproduced:true});
    await context.close();
  }
  report.passed=true;
  await writeFile(output+'/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:true,base,layouts:report.checks.map(c=>c.name),axe:report.accessibility.map(c=>({name:c.name,violations:c.violations.length,incomplete:c.incomplete.length})),report:output+'/report.json'}));
} finally {
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}

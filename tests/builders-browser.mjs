import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { reviewHeroGradient } from './gradient-contrast.mjs';
import { app } from '../server.js';

const server=http.createServer(app);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=process.env.CONSENT_GAP_BASE_URL||`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const results=[];
try {
  for(const width of [1280,390,320]) {
    const context=await browser.newContext({viewport:{width,height:920}});
    const page=await context.newPage();
    const requests=[],errors=[];
    page.on('request',r=>requests.push({method:r.method(),url:r.url()}));
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/build.html',{waitUntil:'networkidle'});
    const initialAudit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']).analyze();
    assert.deepEqual(initialAudit.violations.map(v=>({id:v.id,nodes:v.nodes.length})),[]);
    await page.locator('#step-http summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#step-http').evaluate(el=>el.open),true);
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#step-http').evaluate(el=>el.open),false);
    const details=page.locator('details');
    for(let i=0;i<await details.count();i++) {
      const item=details.nth(i);
      if(!await item.evaluate(el=>el.open)) await item.locator('summary').click();
      assert.equal(await item.evaluate(el=>el.open),true);
    }
    assert.equal(await details.count(),4);
    assert.equal(await page.locator('.table-wrap tbody tr').count(),2);
    const layout=await page.evaluate(()=>({
      viewport:innerWidth,
      documentWidth:document.documentElement.scrollWidth,
      details:[...document.querySelectorAll('summary')].map(el=>({height:el.getBoundingClientRect().height,text:el.innerText})),
      text:document.querySelector('main').innerText
    }));
    assert.ok(layout.documentWidth<=layout.viewport+1,'horizontal page overflow at '+width);
    assert.ok(layout.details.every(s=>s.height>=44),'summary tap target');
    assert.ok(layout.text.includes('cannot start a Cloud job'));
    assert.ok(layout.text.includes('not live guarantees'));
    assert.ok(layout.text.includes('does not independently recompute'));
    const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']).analyze();
    assert.deepEqual(audit.violations.map(v=>({id:v.id,nodes:v.nodes.length})),[]);
    const gradientBounds=await reviewHeroGradient(page);
    assert.ok(gradientBounds.length>0);
    assert.ok(gradientBounds.every(item=>item.pass));
    const incomplete=(audit)=>audit.incomplete.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary}))}));
    assert.deepEqual(errors,[]);
    assert.ok(requests.every(r=>r.method==='GET'&&r.url.startsWith(base+'/')),'walkthrough made nonlocal or mutating request');
    const lesson=await page.locator('a[href^="/demo.html"]').first().getAttribute('href');
    assert.match(lesson,/^\/demo\.html(?:\?case=unlimited)?$/);
    const response=await context.request.get(base+lesson);
    assert.equal(response.status(),200);
    const evidence=await context.request.get(base+'/evidence.html');
    assert.equal(evidence.status(),200);
    const home=await context.request.get(base+'/');
    assert.ok((await home.text()).includes('/build.html'));
    let screenshot='not requested';
    if(process.env.CONSENT_GAP_CAPTURE_SCREENSHOTS==='1') {
      try {
        await mkdir('/workspace/product-checkpoints/screens',{recursive:true});
        await page.screenshot({path:`/workspace/product-checkpoints/screens/builders-${width}.png`,fullPage:true,timeout:15000});
        screenshot='captured, not visually reviewed';
      } catch(error) { screenshot='capture unavailable: '+error.message.split('\n')[0]; }
    }
    results.push({width,layout:{viewport:layout.viewport,documentWidth:layout.documentWidth,summaryTargets:layout.details},axeViolations:audit.violations.length,initialAxeViolations:initialAudit.violations.length,axeIncomplete:{initial:incomplete(initialAudit),expanded:incomplete(audit)},gradientBounds,requests:requests.length,pageErrors:errors,screenshot});
    await context.close();
  }
  const noScript=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:920}});
  const page=await noScript.newPage();
  await page.goto(base+'/build.html',{waitUntil:'networkidle'});
  await page.locator('#step-http summary').click();
  assert.equal(await page.locator('#step-http').evaluate(el=>el.open),true);
  assert.ok((await page.locator('body').innerText()).includes('Button != permission'));
  await noScript.close();
  if(process.env.CONSENT_GAP_REPORT_PATH) await writeFile(process.env.CONSENT_GAP_REPORT_PATH,JSON.stringify({base,results,noJavaScript:true},null,2)+'\n');
  console.log(JSON.stringify({base,results,noJavaScript:true},null,2));
} finally {
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}

import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { app } from '../server.js';
import { approvalExamples } from '../public/approval.js';

// Capture the real UI, never inject text, alter CSS, or composite a result.
const server = http.createServer(app);
const external = process.env.CONSENT_GAP_BASE_URL;
if (!external) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = (external || `http://127.0.0.1:${server.address().port}`).replace(/\/$/, '');
const sourceRevision = external ? process.env.DEMO_SOURCE_REVISION : execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
assert.match(sourceRevision || '', /^[a-f0-9]{40}$/, 'Live capture requires an explicitly verified workspace source revision');
const localCheckoutDirty = Boolean(execFileSync('git', ['status', '--porcelain'], {encoding:'utf8'}).trim());
const publicSourceRevision = external ? process.env.DEMO_PUBLIC_REVISION : null;
if (external) assert.match(publicSourceRevision || '', /^[a-f0-9]{40}$/);
const directory = process.env.DEMO_OUTPUT_DIR ? pathToFileURL(resolve(process.env.DEMO_OUTPUT_DIR) + '/') : new URL('../public/demo/', import.meta.url);
await mkdir(directory, {recursive:true});
const browser = await chromium.launch({headless:true});
const expectedSpender = '0x' + '2'.repeat(40);
const decodedSpender = '0x' + '1'.repeat(40);
const receipt = {
  schemaVersion:1, kind:'synthetic-local-inspector-capture',
  capturedFrom:external ? base : 'local application', sourceRevision, publicSourceRevision, localCheckoutDirty,
  reproductionPath:'/inspect.html', firstAction:'Click Example: 20 tokens',
  inputs:{example:'bounded',calldata:approvalExamples.bounded,decimals:'18',claimedAmount:'20',expectedSpender},
  outputs:{amountLabel:'Matches the amount you entered',spenderLabel:'Different spender than you entered',decodedSpender},
  limitations:'Invented data. Address-byte comparison only, not checksum, chain, contract, owner or safety verification. No wallet, signing, transaction, or UiPath Cloud run. Screenshots are unedited result-panel crops, not whole-page or browser-chrome captures.',
  captures:[]
};
try {
  for (const width of [1280,390]) {
    const context = await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1});
    const page = await context.newPage();
    const requests = [], errors = [];
    page.on('request', request => requests.push({url:request.url(),method:request.method()}));
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + receipt.reproductionPath, {waitUntil:'networkidle'});
    const initialRequests = requests.length;
    await page.getByRole('button', {name:'Example: 20 tokens',exact:true}).click();
    assert.equal(await page.locator('#calldata').inputValue(), receipt.inputs.calldata);
    assert.equal(await page.locator('#decimals').inputValue(), '18');
    assert.equal(await page.locator('#claimed-amount').inputValue(), '20');
    await page.locator('#expected-spender').fill(expectedSpender);
    await page.getByRole('button', {name:'Decode locally',exact:true}).click();
    assert.equal(await page.locator('#comparison-label').innerText(), receipt.outputs.amountLabel);
    assert.equal(await page.locator('#spender-comparison-label').innerText(), receipt.outputs.spenderLabel);
    const detail = await page.locator('#spender-comparison-detail').innerText();
    assert.ok(detail.includes(expectedSpender) && detail.includes(decodedSpender));
    assert.match(await page.locator('.output-panel').innerText(), /ERC-721/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    assert.equal(requests.length, initialRequests, 'Reproduction makes no interaction requests');
    assert.ok(requests.every(request => request.url.startsWith(base + '/') && request.method === 'GET'));
    assert.deepEqual(await page.evaluate(() => ({local:localStorage.length,session:sessionStorage.length,cookies:document.cookie})), {local:0,session:0,cookies:''});
    const filename = `spender-result-${width}.png`;
    await page.locator('.output-panel').screenshot({path:new URL(filename,directory).pathname,animations:'disabled'});
    const png = await readFile(new URL(filename,directory));
    receipt.captures.push({viewportWidth:width,viewportHeight:900,filename,pixelWidth:png.readUInt32BE(16),pixelHeight:png.readUInt32BE(20),sha256:createHash('sha256').update(png).digest('hex'),observedAt:new Date().toISOString(),interactionRequests:requests.length-initialRequests,pageErrors:errors});
    await context.close();
  }
  await writeFile(new URL('spender-capture.json',directory), JSON.stringify(receipt,null,2) + '\n');
  console.log(JSON.stringify({passed:true,sourceRevision,publicSourceRevision,capturedFrom:receipt.capturedFrom,captures:receipt.captures}));
} finally {
  await browser.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}

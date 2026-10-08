import assert from 'node:assert/strict';
import http from 'node:http';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { app } from '../server.js';
import { reviewHeroGradient } from './gradient-contrast.mjs';

// This is an automated regression, not a WCAG certification or a screen-reader review.
const server = http.createServer(app);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.CONSENT_GAP_BASE_URL || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const audits = [];
const negativeControls = [];
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
async function audit(page, width, state) {
  const result = await new AxeBuilder({ page }).withTags(tags).analyze();
  const compact = rules => rules.map(rule => ({
    id: rule.id, impact: rule.impact,
    nodes: rule.nodes.map(node => ({ target: node.target, summary: node.failureSummary }))
  }));
  const layout = await page.evaluate(() => ({
    viewport: innerWidth, document: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll('body *')].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width && (rect.left < -1 || rect.right > innerWidth + 1);
    }).map(element => ({ tag: element.tagName, id: element.id, className: element.className })).slice(0, 12)
  }));
  const gradientContrast = await reviewHeroGradient(page);
  const row = { width, state, layout, gradientContrast, violations: compact(result.violations), incomplete: compact(result.incomplete) };
  audits.push(row);
  console.log(JSON.stringify({ base, width, state, layout, violations: row.violations, incompleteRules: row.incomplete.map(rule => rule.id), gradientTextNodes: gradientContrast.length,
    gradientContrastFloor: gradientContrast.length ? Math.min(...gradientContrast.map(node => node.ratio)) : null }));
}
try {
  if (!process.env.CONSENT_GAP_BASE_URL) {
    // Local-only CSS mutations prove the supplemental check refuses both an
    // actual contrast regression and a gradient outside its supported model.
    const controlContext = await browser.newContext();
    const controlPage = await controlContext.newPage();
    let mutation = '.intro .dek{color:rgb(51,75,57)!important}';
    await controlPage.route('**/style.css', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()) + '\n' + mutation });
    });
    await controlPage.goto(base, { waitUntil: 'networkidle' });
    await assert.rejects(() => reviewHeroGradient(controlPage), /Contrast below 4.5:1/);
    negativeControls.push('low-contrast-foreground-rejected');
    mutation = '.intro{background-image:radial-gradient(circle,red,green,transparent)!important}';
    await controlPage.reload({ waitUntil: 'networkidle' });
    await assert.rejects(() => reviewHeroGradient(controlPage), /Unsupported hero gradient/);
    negativeControls.push('unsupported-gradient-rejected');
    await controlContext.close();
  }
  // 320 CSS pixels is the narrow reflow target; 390 and 1280 retain phone/desktop coverage.
  for (const width of [1280, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 920 } });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    await audit(page, width, 'prediction');
    await page.locator('[data-choice="future"]').click();
    await audit(page, width, 'unlimited-reveal');
    await page.locator('[data-case="bounded"]').click();
    await page.locator('[data-choice="one"]').click();
    await audit(page, width, 'bounded-reveal');
    await page.getByRole('button', { name: 'Compare both permissions', exact: true }).click();
    await audit(page, width, 'permission-comparison');

    await page.goto(base + '/inspect.html', { waitUntil: 'networkidle' });
    await audit(page, width, 'inspector-empty');
    await page.getByRole('button', { name: 'Decode locally', exact: true }).click();
    await audit(page, width, 'inspector-error');
    for (const [example, state] of [
      ['maximum', 'maximum-larger'],
      ['bounded', 'bounded-equal'],
      ['zero', 'zero-equal']
    ]) {
      await page.locator(`[data-example="${example}"]`).click();
      await page.getByRole('button', { name: 'Decode locally', exact: true }).click();
      await audit(page, width, state);
    }
    await page.locator('#claimed-amount').fill('1');
    await page.getByRole('button', { name: 'Decode locally', exact: true }).click();
    await audit(page, width, 'zero-smaller');

    await page.goto(base + '/evidence.html', { waitUntil: 'networkidle' });
    await page.locator('#digest-status.match').waitFor();
    await audit(page, width, 'unlimited-evidence');
    await page.locator('[data-observation="bounded"]').click();
    await page.locator('#digest-status.match').waitFor();
    await audit(page, width, 'bounded-evidence');
    await page.goto(base + '/demo.html', { waitUntil: 'networkidle' });
    for (const image of await page.locator('img').all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(element => element.decode());
    }
    await audit(page, width, 'demo-gallery');
    await context.close();

    if (!process.env.CONSENT_GAP_BASE_URL) {
      const failureContext = await browser.newContext({ viewport: { width, height: 920 } });
      const failurePage = await failureContext.newPage();
      let fail = true;
      await failurePage.route('**/owner-observations.json', route => fail
        ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
        : route.continue());
      await failurePage.goto(base + '/evidence.html', { waitUntil: 'networkidle' });
      await failurePage.getByRole('button', { name: 'Retry loading evidence' }).waitFor();
      await audit(failurePage, width, 'evidence-load-failure');
      fail = false;
      await failurePage.getByRole('button', { name: 'Retry loading evidence' }).click();
      await failurePage.locator('#digest-status.match').waitFor();
      await audit(failurePage, width, 'evidence-recovered');
      await failureContext.close();
    }
  }
  if (process.env.ACCESSIBILITY_REPORT) {
    await writeFile(process.env.ACCESSIBILITY_REPORT, JSON.stringify({ base, checkedAt: new Date().toISOString(), tags, negativeControls, audits }, null, 2) + '\n');
  }
  const failed = audits.filter(audit => audit.violations.length || audit.layout.document > audit.layout.viewport + 1);
  assert.equal(failed.length, 0, `Automated accessibility violations or horizontal overflow in ${failed.length} of ${audits.length} audited states. See state reports above.`);
  console.log(JSON.stringify({ base, outcome: 'automated audit passed', states: audits.length, negativeControls,
    note: 'Hero text passed a conservative gradient contrast bound. Original axe incomplete rules remain retained; other manual reviews and WCAG conformance are not established.' }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

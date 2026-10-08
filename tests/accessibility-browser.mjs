import assert from 'node:assert/strict';
import http from 'node:http';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { app } from '../server.js';

// This is an automated regression, not a WCAG certification or a screen-reader review.
const server = http.createServer(app);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.CONSENT_GAP_BASE_URL || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const audits = [];
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
  const row = { width, state, layout, violations: compact(result.violations), incomplete: compact(result.incomplete) };
  audits.push(row);
  console.log(JSON.stringify({ base, width, state, layout, violations: row.violations, incompleteRules: row.incomplete.map(rule => rule.id) }));
}
try {
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
    await writeFile(process.env.ACCESSIBILITY_REPORT, JSON.stringify({ base, checkedAt: new Date().toISOString(), tags, audits }, null, 2) + '\n');
  }
  const failed = audits.filter(audit => audit.violations.length || audit.layout.document > audit.layout.viewport + 1);
  assert.equal(failed.length, 0, `Automated accessibility violations or horizontal overflow in ${failed.length} of ${audits.length} audited states. See state reports above.`);
  console.log(JSON.stringify({ base, outcome: 'automated audit passed', states: audits.length, note: 'Incomplete rules still require manual review; this does not certify WCAG conformance.' }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

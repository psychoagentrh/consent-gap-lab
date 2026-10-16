import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const families = [
  { name: 'spender', file: 'spender-owner-observations.json', start: '## Recorded spender-comparison evidence', end: '## Recorded unsigned approval-byte evidence' },
  { name: 'unsigned amount', file: 'unsigned-owner-observations.json', start: '## Recorded unsigned approval-byte evidence', end: '### Older JSON-label evidence is a separate family' },
  { name: 'legacy JSON-label', file: 'owner-observations.json', start: '### Older JSON-label evidence is a separate family', end: '## Run the application' },
];

function evidenceSection(document, family) {
  const start = document.indexOf(family.start);
  const end = document.indexOf(family.end, start + family.start.length);
  assert(start >= 0 && end > start, `missing or out-of-order ${family.name} evidence headings`);
  return document.slice(start, end);
}

function checkRevisions(section, evidence) {
  const expected = [evidence.testedWorkspaceRevision, evidence.publicSourceRevision];
  assert(expected.every(revision => /^[a-f0-9]{40}$/.test(revision)), 'observation revisions must be full immutable IDs');
  for (const revision of expected) {
    assert(section.includes('`' + revision + '`'), `README must name the recorded revision ${revision}`);
  }
  const actual = new Set(section.match(/\b[a-f0-9]{40}\b/g));
  assert.deepEqual(actual, new Set(expected), 'README evidence section includes an unrecorded revision');
}

for (const family of families) {
  test(`README ${family.name} revision IDs agree with its own published evidence family`, () => {
    const evidence = JSON.parse(readFileSync(new URL(`../public/${family.file}`, import.meta.url), 'utf8'));
    const section = evidenceSection(readme, family);
    checkRevisions(section, evidence);
    assert(section.includes(`public/${family.file}`), 'README must link to this evidence family');
  });
}

test('README evidence check rejects a changed ID, wrong-family ID and missing section', () => {
  const family = families[2];
  const evidence = JSON.parse(readFileSync(new URL(`../public/${family.file}`, import.meta.url), 'utf8'));
  const section = evidenceSection(readme, family);
  const changed = (evidence.testedWorkspaceRevision[0] === 'a' ? 'b' : 'a') + evidence.testedWorkspaceRevision.slice(1);
  assert.throws(() => checkRevisions(section.replaceAll(evidence.testedWorkspaceRevision, changed), evidence));
  const wrongFamily = JSON.parse(readFileSync(new URL('../public/spender-owner-observations.json', import.meta.url), 'utf8'));
  assert.throws(() => checkRevisions(section.replaceAll(evidence.testedWorkspaceRevision, wrongFamily.testedWorkspaceRevision), evidence));
  assert.throws(() => checkRevisions(section + '\n' + 'a'.repeat(40), evidence));
  assert.throws(() => evidenceSection(readme.replace(family.start, 'Missing heading'), family));
});

function checkSpenderProofStatus(section) {
  assert(section.includes('[October 15 owner-run spender evidence](https://lab.psychoagent.com/spender-evidence.html)'), 'current instructions must link the dated spender observations');
  assert(section.includes('two verified HTTP-fixture inputs'), 'proof must retain its bounded owner-input scope');
  assert(section.includes('not proof of the browser inspector or a wallet journey'), 'owner HTTP observations do not prove browser or wallet behavior');
  assert(section.includes('Public execution remains disabled.'), 'published owner proof does not enable public Cloud execution');
  assert.doesNotMatch(section, /local proof only|Cloud proof remains pending/i, 'current guidance must not contradict the published owner evidence');
}

test('current README and novelty guidance distinguish published spender proof from historical pending status', () => {
  const reproduction = evidenceSection(readme, { name: 'current reproduction', start: 'Local validation and packing require', end: '## Safety and operating boundaries' });
  const novelty = readFileSync(new URL('../NOVELTY.md', import.meta.url), 'utf8');
  const currentNovelty = evidenceSection(novelty, { name: 'current novelty', start: '2026-10-16 evidence publication:', end: '2026-10-15 portable-source update:' });
  for (const section of [reproduction, currentNovelty]) {
    checkSpenderProofStatus(section);
    assert.throws(() => checkSpenderProofStatus(section + ' Its expected-spender comparison has local proof only.'));
    assert.throws(() => checkSpenderProofStatus(section + ' Version 1.1.1 Cloud proof remains pending.'));
    assert.throws(() => checkSpenderProofStatus(section.replace('two verified HTTP-fixture inputs', 'a live wallet audit')));
    assert.throws(() => checkSpenderProofStatus(section.replace('not proof of the browser inspector or a wallet journey', 'proof of browser and wallet behavior')));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { unsignedApprovalFixture } from '../uipath/unsigned-approval-fixture.js';
import { evaluateUnsignedApproval } from '../uipath/evaluate-unsigned-approval.js';

const text = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const evidence = JSON.parse(await text('public/unsigned-owner-observations.json'));
const page = await text('public/unsigned-evidence.html');
// Pin the historical contract, not today's portable Flow. New End fields must not
// be retroactively inserted into the October 12 publication.
const outputs = ['approvalCaseObserved','spender','rawAllowance','claimedRawAmount','comparison','scopeExceedsButton','approvalIsSwap','verdict','fixtureSchema','payloadDigest','observedAt','method'].sort();
const observations = evidence.observations;

// These checks reproduce the published fixture interpretation, not a new Cloud run
// or authentication of the curated historical observations.
test('redacted unsigned evidence contains exactly two bounded inputs and twelve End outputs', () => {
  assert.equal(evidence.schema, 'consent-gap/unsigned-owner-observations-v1');
  assert.equal(evidence.workflow, 'unsigned-approval-observation');
  assert.match(evidence.testedWorkspaceRevision, /^[a-f0-9]{40}$/);
  assert.match(evidence.publicSourceRevision, /^[a-f0-9]{40}$/);
  assert.deepEqual(Object.keys(evidence).sort(), ['schema','workflow','testedWorkspaceRevision','publicSourceRevision','provenance','redaction','observations'].sort());
  assert.equal(outputs.length, 12);
  assert.deepEqual(observations.map(item => item.input), [{approvalCase:'maximum'},{approvalCase:'bounded'}]);
  for (const item of observations) {
    assert.deepEqual(Object.keys(item).sort(), ['input','outputs']);
    assert.deepEqual(Object.keys(item.outputs).sort(), outputs);
    assert.equal(item.outputs.approvalCaseObserved, item.input.approvalCase);
    assert.equal(item.outputs.approvalIsSwap, false);
  }
  assert.match(evidence.provenance, /not an independently verifiable UiPath attestation/);
  assert.match(evidence.redaction, /operation identifiers.*omitted/);
  assert.doesNotMatch(JSON.stringify(evidence) + page, /cloud\.uipath\.com|DefaultTenant|678807d0|cb436c79|unsigned-maximum-ce6fcac|unsigned-bounded-ce6fcac/);
});

test('recorded approval-byte outputs and digests agree with the unchanged owned fixtures', () => {
  const times = {maximum:'2026-10-12T06:16:21.688Z', bounded:'2026-10-12T06:17:12.198Z'};
  for (const {input, outputs:recorded} of observations) {
    const data = unsignedApprovalFixture(input.approvalCase);
    const payloadDigest = createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const reproduced = evaluateUnsignedApproval({...data,payloadDigest}, input.approvalCase);
    const {observedAt:actualTime, expectedSpender, spenderComparison, ...actual} = reproduced;
    assert.equal(expectedSpender, '');
    assert.equal(spenderComparison, 'not-provided');
    const {observedAt:recordedTime, ...historical} = recorded;
    assert.ok(Number.isFinite(Date.parse(actualTime)));
    assert.equal(recordedTime, times[input.approvalCase]);
    assert.deepEqual(historical, actual);
  }
});

test('static page exposes dated share targets, byte comparison, immutable source and limitations', () => {
  assert.doesNotMatch(page, /<script\b|<form\b|<iframe\b/i);
  assert.ok(page.includes('href="/inspect.html?example=maximum-vs-20"'));
  assert.ok(page.includes('href="/unsigned-owner-observations.json"'));
  for (const revision of [evidence.testedWorkspaceRevision,evidence.publicSourceRevision]) assert.ok(page.includes(revision));
  for (const {input,outputs:recorded} of observations) {
    const id = input.approvalCase;
    assert.ok(page.includes(`<details id="${id}" open>`));
    assert.ok(page.includes(`href="/unsigned-evidence.html#${id}"`));
    assert.ok(page.includes(`datetime="${recorded.observedAt}"`));
    for (const value of [recorded.rawAllowance,recorded.payloadDigest,recorded.verdict]) assert.ok(page.includes(value));
  }
  for (const limitation of ['not browser automation or a signed transaction','not an independently verifiable UiPath attestation','No swap','not a safe spender','cannot start a Cloud job']) assert.ok(page.includes(limitation), limitation);
});

test('current guide links new byte evidence while keeping historical JSON-label evidence separate', async () => {
  for (const path of ['public/build.html','public/index.html','README.md','BUILDERS.md','UNSIGNED-APPROVAL.md']) {
    const content = await text(path);
    assert.ok(content.includes('unsigned-evidence.html'), path);
    if (path === 'UNSIGNED-APPROVAL.md') {
      assert.ok(content.includes('Version 1.1.1 returned two distinct, verified owner-controlled Cloud observations'));
      assert.ok(content.includes('spender-evidence.html'));
      assert.doesNotMatch(content, /spender-aware Cloud proof is pending/);
      assert.ok(content.includes('Two distinct owner-controlled Cloud inputs succeeded'));
    } else {
      assert.doesNotMatch(content, /Cloud proof pending\.|Cloud proof is pending|run receipt is still pending|Its Cloud proof is\s+pending|Live UiPath proof is pending/i);
    }
  }
  const guide = await text('public/build.html');
  assert.ok(guide.includes('href="/evidence.html"'));
  assert.ok(guide.includes('October 12'));
});

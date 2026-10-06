import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateEvidence, compareFixture, fixtureDigest } from '../public/evidence-logic.js';
import { specimen } from '../public/logic.js';
const data = JSON.parse(await readFile(new URL('../public/owner-observations.json', import.meta.url)));
const manifest = JSON.parse(await readFile(new URL('../uipath/workflows.json', import.meta.url)));

test('curated observations retain two distinct inputs and exactly the allowlisted output fields', () => {
  assert.equal(validateEvidence(data), data);
  for (const item of data.observations) assert.deepEqual(Object.keys(item.outputs).sort(), [...manifest.workflows[0].outputs].sort());
  assert.equal(data.testedWorkspaceRevision, 'd85a1ddc7bb9cd1cc6a13b4d5db95474228f1fe9');
  assert.match(data.provenance, /unsigned, redacted publication/);
  assert.equal(data.observations[0].outputs.observedAt, '2026-10-06T09:06:48.685Z');
  assert.equal(data.observations[1].outputs.observedAt, '2026-10-06T09:49:01.425Z');
});
for (const id of ['unlimited', 'bounded']) {
  test(`published ${id} payload digest matches the current owned teaching fixture`, async () => {
    const observation = data.observations.find(item => item.input.specimenCase === id);
    const result = await compareFixture(specimen(id), observation.outputs.payloadDigest);
    assert.equal(result.matches, true);
    assert.equal(result.digest, observation.outputs.payloadDigest);
  });
}
test('changed teaching bytes cause a mismatch, not a refreshed historical success', async () => {
  const fixture = { ...specimen('unlimited'), button:'Changed fixture' };
  const result = await compareFixture(fixture, data.observations[0].outputs.payloadDigest);
  assert.equal(result.matches, false);
  assert.equal(result.digest, await fixtureDigest(fixture));
});
test('observation file fails closed on duplicate inputs, unexpected fields and invalid output types', () => {
  const mutations = [
    d => { d.observations[1] = structuredClone(d.observations[0]); },
    d => { d.observations[0].outputs.scopeExceedsButton = 'true'; },
    d => { d.observations[0].outputs.approvalIsSwap = true; },
    d => { d.observations[0].outputs.method = 'browser automation'; },
    d => { d.observations[0].outputs.observedAt = '2026-02-30T09:06:48.685Z'; },
    d => { d.observations[0].outputs.payloadDigest = 'not a digest'; },
    d => { d.observations[0].outputs.jobUrl = 'https://cloud.uipath.com/private'; },
    d => { d.publicSourceRevision = '../../branch'; },
    d => { d.schema = 'unknown'; },
    d => { d.observations = []; }
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(data);
    mutate(invalid);
    assert.throws(() => validateEvidence(invalid), /No result has been substituted/);
  }
  for (const invalid of [null, [], {}, 'not-json']) assert.throws(() => validateEvidence(invalid));
});
test('public artifact excludes tenant/job/operation identifiers and raw traces', () => {
  const serialized = JSON.stringify(data);
  assert.doesNotMatch(serialized, /bf486260|f66affe9|cg-d85a1dd|DefaultTenant|orchestrator_|operation_id|Bearer|access_token/);
});

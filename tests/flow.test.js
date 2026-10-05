import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { evaluateSpecimen } from '../uipath/evaluate-specimen.js';
import { specimen } from '../public/logic.js';
const flow = JSON.parse(await readFile(new URL('../uipath/ConsentGapSolution/ConsentGap/Psycho_ConsentGap.flow', import.meta.url)));
const script = flow.nodes.find(n => n.type === 'core.action.script');
const execute = new Function('$vars', script.inputs.script);
function fixture(id) {
  const data = specimen(id);
  return { ...data, payloadDigest: createHash('sha256').update(JSON.stringify(data)).digest('hex') };
}
for (const id of ['unlimited', 'bounded']) {
  test(`embedded Flow evaluator returns bounded observation for ${id} (local JS only)`, () => {
    const body = fixture(id);
    const output = execute({ start: { output: { specimenCase:id } }, readOwnedSyntheticSpecimen1: { output: { body } } });
    assert.equal(output.specimenCase, id);
    assert.equal(output.scopeExceedsButton, id === 'unlimited');
    assert.equal(output.approvalIsSwap, false);
    assert.equal(output.payloadDigest, body.payloadDigest);
    assert.ok(Number.isFinite(Date.parse(output.observedAt)));
    assert.match(output.method, /not browser automation/);
    assert.equal(evaluateSpecimen(JSON.stringify(body), id).verdict, output.verdict);
  });
}
test('graph connects start, HTTP, evaluator and real end outputs; faults remain faults', async () => {
  const http = flow.nodes.find(n => n.type === 'core.action.http.v2');
  const end = flow.nodes.find(n => n.type === 'core.control.end');
  assert.equal(flow.edges.length, 3);
  assert.deepEqual(flow.edges.map(e => [e.sourceNodeId,e.sourcePort,e.targetNodeId]), [
    ['start','output',http.id], [http.id,'default',script.id], [script.id,'success',end.id]
  ]);
  assert.notEqual(http.inputs.errorHandlingEnabled, true);
  assert.ok(script.inputs.script.includes('return evaluateSpecimen('));
  const manifest = JSON.parse(await readFile(new URL('../uipath/workflows.json', import.meta.url)));
  assert.deepEqual(manifest.workflows[0].inputs.specimenCase.enum, ['unlimited','bounded']);
  assert.deepEqual(Object.keys(end.outputs), manifest.workflows[0].outputs);
  await readFile(new URL('../' + manifest.workflows[0].package, import.meta.url));
  for (const value of Object.values(end.outputs)) assert.match(value.source, /^=js:\$vars\./);
});
test('rejects unexpected or tampered observations, never substitutes a result', () => {
  const valid = fixture('unlimited');
  for (const bad of [null, {}, 'not json', { ...valid, synthetic:false }, { ...valid, case:'bounded' }, { ...valid, swapExecuted:true }, { ...valid, allowanceAmount:20 }, { ...valid, payloadDigest:'bad' }]) {
    assert.throws(() => evaluateSpecimen(bad, 'unlimited'));
  }
  assert.throws(() => evaluateSpecimen(valid, 'arbitrary-url'));
});

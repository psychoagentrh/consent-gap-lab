import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { unsignedApprovalFixture, APPROVAL_CASES } from '../uipath/unsigned-approval-fixture.js';
import { evaluateUnsignedApproval } from '../uipath/evaluate-unsigned-approval.js';
import { UNSIGNED_APPROVAL_OUTPUTS } from '../uipath/unsigned-approval-contract.js';

const text = async path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const flow = JSON.parse(await text('uipath/ConsentGapSolution/Psycho_UnsignedApproval/Psycho_UnsignedApproval.flow'));
const script = flow.nodes.find(node => node.type === 'core.action.script');
const http = flow.nodes.find(node => node.type === 'core.action.http.v2');
const end = flow.nodes.find(node => node.type === 'core.control.end');
const execute = new Function('$vars', script.inputs.script);
const manifest = JSON.parse(await text('uipath/workflows.json'));
const registered = manifest.workflows.find(item => item.id === 'unsigned-approval-observation');
function fixture(id) {
  const payload = unsignedApprovalFixture(id);
  return { ...payload, payloadDigest:createHash('sha256').update(JSON.stringify(payload)).digest('hex') };
}
const vars = (id,body) => ({start:{output:{approvalCase:id}},readOwnedSyntheticSpecimen1:{output:{body}}});

for (const id of APPROVAL_CASES) {
  test('embedded unsigned-byte evaluator and all End mappings agree for ' + id + ' (local JS, not Cloud)', () => {
    const body = fixture(id);
    const scriptResult = execute(vars(id,JSON.stringify(body)));
    const outputVars = {[script.id]:{output:scriptResult}};
    const result = Object.fromEntries(Object.entries(end.outputs).map(([name,value]) => [name,new Function('$vars','return ' + value.source.slice(4))(outputVars)]));
    const separate = evaluateUnsignedApproval(body,id);
    const { observedAt, ...stable } = result;
    const { observedAt:otherTime, ...otherStable } = Object.fromEntries(UNSIGNED_APPROVAL_OUTPUTS.map(key => [key,separate[key]]));
    assert.deepEqual(stable,otherStable);
    assert.ok(Number.isFinite(Date.parse(observedAt)));
    assert.equal(result.approvalCaseObserved,id);
    assert.equal(result.scopeExceedsButton,id === 'maximum');
    assert.equal(separate.approvalIsSwap,false, 'local diagnostic remains validated without expanding the Cloud envelope');
    assert.equal(Object.hasOwn(result,'approvalIsSwap'),false);
    assert.equal(Object.hasOwn(result,'fixtureSchema'),false);
    assert.equal(result.payloadDigest,body.payloadDigest);
    assert.match(result.method,/not browser automation or a signed transaction/);

    const outputs = Object.fromEntries(Object.entries(end.outputs).map(([name,value]) => [name,new Function('$vars','return ' + value.source.slice(4))(outputVars)]));
    assert.equal(outputs.approvalCaseObserved,id);
    assert.equal(outputs.spender,result.spender);
    assert.equal(outputs.rawAllowance,result.rawAllowance);
    assert.equal(outputs.payloadDigest,body.payloadDigest);
    assert.deepEqual(Object.keys(outputs),registered.outputs);
  });
}

test('unsigned Flow is manual, fixed-host, bounded HTTP with no error-to-success path', async () => {
  assert.deepEqual(flow.nodes.map(n=>n.type),['core.trigger.manual','core.action.http.v2','core.action.script','core.control.end']);
  assert.deepEqual(flow.edges.map(e=>[e.sourceNodeId,e.sourcePort,e.targetNodeId]),[
    ['start','output',http.id],[http.id,'default',script.id],[script.id,'success',end.id]
  ]);
  assert.equal(http.inputs.detail.bodyParameters.method,'GET');
  assert.ok(http.inputs.detail.bodyParameters.url.includes('https://psycho-product.fly.dev/api/unsigned-approvals/'));
  assert.equal(http.inputs.timeout,'PT30S');
  assert.equal(http.inputs.retryCount,0);
  assert.notEqual(http.inputs.errorHandlingEnabled,true);
  assert.deepEqual(Object.keys(registered).sort(),['id','inputs','outputs','package']);
  assert.deepEqual(Object.keys(registered.inputs.approvalCase).sort(),['enum','type']);
  assert.deepEqual(registered.inputs.approvalCase.enum,APPROVAL_CASES);
  const input = flow.variables.globals.find(v=>v.id==='approvalCase');
  assert.equal(input.direction,'in');
  assert.equal(input.defaultValue,'maximum');
  await readFile(new URL('../'+registered.package,import.meta.url));
  for(const mapping of Object.values(end.outputs)) assert.match(mapping.source,/^=js:\$vars\./);
});

test('embedded byte evaluator rejects malformed, mismatched and broadened requests', () => {
  const valid = fixture('maximum');
  const mutated = structuredClone(valid);
  mutated.transaction.data=mutated.transaction.data.replace('095ea7b3','deadbeef');
  for(const body of [null,{},'{not json',mutated,{...valid,synthetic:false},{...valid,case:'bounded'},{...valid,payloadDigest:'bad'},{...valid,transactionSigned:true},{...valid,transactionSubmitted:true}]) {
    assert.throws(()=>execute(vars('maximum',body)));
  }
  assert.throws(()=>execute(vars('https://other.invalid',valid)));
  assert.throws(()=>execute({start:{output:{approvalCase:'maximum'}}}));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildUnsignedFlow } from '../uipath/build-unsigned-flow.mjs';
import { unsignedApprovalFixture } from '../uipath/unsigned-approval-fixture.js';
import { UNSIGNED_APPROVAL_OUTPUTS, SPENDER_APPROVAL_SCHEMA } from '../uipath/unsigned-approval-contract.js';
import { evaluateUnsignedApproval } from '../uipath/evaluate-unsigned-approval.js';

const flow = JSON.parse(fs.readFileSync(new URL('../uipath/ConsentGapSolution/Psycho_UnsignedApproval/Psycho_UnsignedApproval.flow', import.meta.url), 'utf8'));
const http = flow.nodes.find(node => node.type === 'core.action.http.v2');
const script = flow.nodes.find(node => node.type === 'core.action.script');
const execute = new Function('$vars', script.inputs.script);
const vars = (id, body) => ({start:{output:{approvalCase:id}}, [http.id]:{output:{body}}});
function run(id, body) {
  const internal = execute(vars(id, body));
  return Object.fromEntries(Object.entries(flow.nodes.at(-1).outputs).map(([key, mapping]) => [
    key, new Function('$vars', 'return ' + mapping.source.slice(4))({[script.id]:{output:internal}})
  ]));
}
const digest = payload => createHash('sha256').update(JSON.stringify(payload)).digest('hex');
const fixture = id => { const payload = unsignedApprovalFixture(id); return {...payload, payloadDigest:digest(payload)}; };

for (const id of ['spender-match', 'spender-mismatch']) {
  test('embedded Flow compares amount and explicit spender independently: ' + id, () => {
    const payload = fixture(id);
    const output = run(id, JSON.stringify(payload));
    assert.equal(payload.schema, SPENDER_APPROVAL_SCHEMA);
    assert.equal(output.spender, '0x1111111111111111111111111111111111111111');
    assert.equal(output.expectedSpender, payload.expectedSpender);
    assert.equal(output.spenderComparison, id === 'spender-match' ? 'equal' : 'different');
    assert.equal(output.comparison, 'equal');
    assert.equal(output.scopeExceedsButton, false, 'amount-only output does not certify full intent');
    assert.equal(output.approvalIsSwap, false);
    assert.match(output.verdict, id === 'spender-match' ? /not a safety verdict/ : /differs from/);
    assert.deepEqual(Object.keys(output), UNSIGNED_APPROVAL_OUTPUTS);
  });
}

test('spender relation follows bytes and supplied expectation, not the fixture label', () => {
  const payload = fixture('spender-mismatch');
  payload.expectedSpender = payload.expectedSpender.replaceAll('3', '1');
  assert.equal(run('spender-mismatch', payload).spenderComparison, 'equal');
  payload.expectedSpender = '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa';
  payload.transaction.data = '0x095ea7b3' + 'a'.repeat(40).padStart(64, '0') + payload.transaction.data.slice(-64);
  const output = run('spender-mismatch', payload);
  assert.equal(output.spenderComparison, 'equal');
  assert.equal(output.expectedSpender, '0x' + 'a'.repeat(40));
  payload.transaction.data = payload.transaction.data.slice(0, -64) + '0'.repeat(64);
  const smaller = run('spender-mismatch', payload);
  assert.equal(smaller.comparison, 'smaller');
  assert.equal(smaller.spenderComparison, 'equal');
});

test('v1 fixtures remain byte-identical and explicitly have no spender expectation', () => {
  const saved = {
    maximum:'0f3e8c73692e8448a59acfeeb0cea40ef54e9e39106de5e51ae13f977c74adde',
    bounded:'4ef4e18002bd22e1b8a9d179702319768dd628ca6dbfc0de9fcd25e8b0558085'
  };
  for (const [id, hash] of Object.entries(saved)) {
    assert.equal(digest(unsignedApprovalFixture(id)), hash);
    const output = run(id, fixture(id));
    assert.equal(output.expectedSpender, '');
    assert.equal(output.spenderComparison, 'not-provided');
    assert.doesNotMatch(output.verdict, /supplied synthetic expectation/);
    assert.throws(() => run(id, {...fixture(id), expectedSpender:'0x'+'1'.repeat(40)}));
  }
});

test('v2 rejects absent, malformed and broadened expectations; failures do not become equality', () => {
  for (const value of [undefined, null, 1, '', '0x1234', '0x'+'g'.repeat(40), ' 0x'+'1'.repeat(40), '0x'+'1'.repeat(40)+' ']) {
    assert.throws(() => run('spender-match', {...fixture('spender-match'), expectedSpender:value}));
  }
  const payload = fixture('spender-match');
  const mutations = [
    {...payload, schema:'consent-gap-unsigned-approval-v1'},
    {...payload, chainId:1},
    {...payload, transaction:{...payload.transaction, chainId:1}},
    {...payload, button:{...payload.button, expectedSpender:payload.expectedSpender}},
    {...payload, transactionSigned:true},
    {...payload, transactionSubmitted:true},
    {...payload, payloadDigest:'bad'},
    {...payload, transaction:{...payload.transaction, data:'0xdeadbeef'}}
  ];
  const missing = structuredClone(payload); delete missing.expectedSpender; mutations.push(missing);
  for (const body of mutations) assert.throws(() => run('spender-match', body));
  const oversized = ' '.repeat(8193) + JSON.stringify(payload);
  assert.throws(() => run('spender-match', oversized), /Oversized/);
  assert.throws(() => evaluateUnsignedApproval(oversized, 'spender-match'), /Oversized/);
});

test('Flow regeneration is deterministic and rejects arbitrary network targets', () => {
  assert.deepEqual(buildUnsignedFlow(), flow, 'regenerate embedded source before packing');
  const resolve = new Function('$vars', 'return ' + http.inputs.detail.bodyParameters.url.slice(4));
  for (const id of ['maximum', 'bounded', 'spender-match', 'spender-mismatch']) {
    assert.equal(resolve(vars(id, null)), 'https://psycho-product.fly.dev/api/unsigned-approvals/' + id);
  }
  for (const id of ['https://attacker.invalid', '../maximum', 'spender-match?target=x', '', null]) {
    assert.equal(resolve(vars(id, null)), 'https://psycho-product.fly.dev/api/unsigned-approvals/invalid');
  }
  assert.equal(flow.variables.globals.filter(v => v.direction === 'out').length, UNSIGNED_APPROVAL_OUTPUTS.length);
  assert.doesNotMatch(script.inputs.script, /approvalExamples|await fetch|eth_send|requestAccounts/);
});

test('manifest, typed End fields and builder instructions share the current contract', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../uipath/workflows.json', import.meta.url), 'utf8'));
  const workflow = manifest.workflows.find(item => item.id === 'unsigned-approval-observation');
  assert.deepEqual(workflow.inputs.approvalCase.enum, ['maximum','bounded','spender-match','spender-mismatch']);
  assert.deepEqual(workflow.outputs, UNSIGNED_APPROVAL_OUTPUTS);
  assert.equal(workflow.package, 'uipath/packages/Psycho.UnsignedApproval.flow.Flow.1.1.0.nupkg');
  assert.ok(fs.statSync(new URL('../' + workflow.package, import.meta.url)).size > 0);
  for (const variable of flow.variables.globals.filter(item => item.direction === 'out')) {
    assert.equal(variable.type, ['scopeExceedsButton','approvalIsSwap'].includes(variable.id) ? 'boolean' : 'string');
  }
  const guide = fs.readFileSync(new URL('../UNSIGNED-APPROVAL.md', import.meta.url), 'utf8');
  for (const name of UNSIGNED_APPROVAL_OUTPUTS) assert.ok(guide.includes('`' + name + '`'), name);
  for (const id of workflow.inputs.approvalCase.enum) assert.ok(guide.includes('`' + id + '`'), id);
  for (const text of ['--name Psycho.UnsignedApproval --version 1.1.0', 'build-unsigned-flow.mjs --check',
    'all four cases', 'does not independently verify the digest', 'not a safety verdict',
    'Version 1.1.0 spender-aware Cloud proof is pending', 'twelve-output publications remain unchanged']) {
    assert.ok(guide.includes(text), text);
  }
});

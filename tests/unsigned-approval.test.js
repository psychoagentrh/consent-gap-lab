import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { unsignedApprovalFixture } from '../uipath/unsigned-approval-fixture.js';
import { evaluateUnsignedApproval } from '../uipath/evaluate-unsigned-approval.js';
import { approvalExamples, MAX_UINT256 } from '../public/approval.js';

function fixture(id) {
  const data = unsignedApprovalFixture(id);
  return { ...data, payloadDigest:createHash('sha256').update(JSON.stringify(data)).digest('hex') };
}
for (const id of ['maximum', 'bounded']) {
  test(`unsigned ${id} fixture decodes actual approval bytes with integer comparison`, () => {
    const data = fixture(id);
    const output = evaluateUnsignedApproval(JSON.stringify(data), id);
    assert.equal(output.approvalCaseObserved, id);
    assert.equal(output.spender, '0x' + '1'.repeat(40));
    assert.equal(output.rawAllowance, id === 'maximum' ? MAX_UINT256 : '20000000000000000000');
    assert.equal(output.claimedRawAmount, '20000000000000000000');
    assert.equal(output.comparison, id === 'maximum' ? 'larger' : 'equal');
    assert.equal(output.scopeExceedsButton, id === 'maximum');
    assert.equal(output.approvalIsSwap, false);
    assert.equal(output.payloadDigest, data.payloadDigest);
    assert.ok(Number.isFinite(Date.parse(output.observedAt)));
    assert.match(output.method, /not browser automation or a signed transaction/);
    assert.deepEqual(Object.keys(output), ['approvalCaseObserved','spender','rawAllowance','claimedRawAmount','comparison','scopeExceedsButton','approvalIsSwap','verdict','fixtureSchema','payloadDigest','observedAt','method']);
  });
}
test('relation is derived from bytes, not the fixture case name or alleged scope', () => {
  const data = fixture('bounded');
  data.transaction.data = approvalExamples.maximum;
  assert.equal(evaluateUnsignedApproval(data, 'bounded').comparison, 'larger');
  data.transaction.data = approvalExamples.zero;
  const output = evaluateUnsignedApproval(data, 'bounded');
  assert.equal(output.comparison, 'smaller');
  assert.equal(output.scopeExceedsButton, false);
});
test('unsigned evaluator rejects malformed, unrelated, signed or mismatched fixtures', () => {
  const valid = fixture('maximum');
  const clone = () => structuredClone(valid);
  const changes = [
    x => x.schema = 'other', x => x.synthetic = false, x => x.case = 'bounded',
    x => x.transactionSigned = true, x => x.transactionSubmitted = true,
    x => x.button.label = 'Swap 200 SYN', x => x.button.claimedAmount = '1e2',
    x => x.button.assumedDecimals = '37', x => x.transaction.to = 'https://example.com',
    x => x.transaction.value = '1', x => x.payloadDigest = 'bad',
    x => x.transaction.data = '0xdeadbeef',
    x => x.transaction.data = x.transaction.data.replace('095ea7b3','deadbeef'),
    x => x.transaction.data = x.transaction.data + '00',
    x => x.transaction.data = null,
    x => x.transaction.data = x.transaction.data.slice(0,10) + '1' + x.transaction.data.slice(11)
  ];
  for (const change of changes) { const bad = clone(); change(bad); assert.throws(() => evaluateUnsignedApproval(bad, 'maximum')); }
  for (const bad of [null, {}, 'not JSON', ' '.repeat(8193)]) assert.throws(() => evaluateUnsignedApproval(bad, 'maximum'));
  assert.throws(() => evaluateUnsignedApproval(valid, 'arbitrary-url'));
  assert.throws(() => unsignedApprovalFixture('unknown'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeApproval, approvalExamples, ApprovalInputError } from '../public/approval.js';
const expected = '0x' + '1'.repeat(40);
const other = '0x' + '2'.repeat(40);
const decode = spender => decodeApproval(approvalExamples.bounded, '', '', spender);

test('blank expected spender preserves decoder and amount-only behavior', () => {
  for (const blank of ['', ' \n ']) {
    assert.deepEqual(decode(blank), decodeApproval(approvalExamples.bounded));
    assert.deepEqual(decodeApproval(approvalExamples.bounded, '18', '20', blank), decodeApproval(approvalExamples.bounded, '18', '20'));
  }
});
test('same amount can independently name a different spender', () => {
  const result = decodeApproval(approvalExamples.bounded, '18', '20', other);
  assert.equal(result.comparison.relation, 'equal');
  assert.deepEqual(result.spenderComparison, {relation:'different', enteredSpender:other});
  assert.equal(result.spender, expected);
});
test('spender comparison needs no decimals, token amount or metadata', () => {
  assert.deepEqual(decode(expected).spenderComparison, {relation:'equal', enteredSpender:expected});
  assert.equal(decode(expected).decimals, null);
  assert.equal(decode(expected).comparison, undefined);
});
test('address comparison is case-insensitive without asserting checksum validity', () => {
  const address = 'aBcD'.repeat(10);
  const calldata = '0x095ea7b3' + '0'.repeat(24) + address + '0'.repeat(64);
  const result = decodeApproval(calldata, '', '', ' 0x' + address.toUpperCase() + '\n');
  assert.equal(result.spender, '0x' + address.toLowerCase());
  assert.deepEqual(result.spenderComparison, {relation:'equal', enteredSpender:'0x' + address.toLowerCase()});
  assert.deepEqual(Object.keys(result.spenderComparison).sort(), ['enteredSpender','relation']);
});
test('unsupported expected-spender values fail closed on the correct field', () => {
  const invalid = [null, {}, [], 123, 'alice.eth', '0X' + '1'.repeat(40), '1'.repeat(40), '0x1234', '0x' + 'g'.repeat(40), other + '00', 'ethereum:' + other, JSON.stringify({to:other}), '<script>alert(1)</script>', ' '.repeat(129)];
  for (const input of invalid) {
    assert.throws(() => decode(input), error => error instanceof ApprovalInputError && error.field === 'expected-spender' && !(typeof input === 'string' && input.trim() && error.message.includes(input)));
  }
});
test('zero and maximum allowance requests retain independent spender comparisons', () => {
  for (const category of ['zero','maximum']) {
    const match = decodeApproval(approvalExamples[category], '', '', expected);
    const mismatch = decodeApproval(approvalExamples[category], '', '', other);
    assert.equal(match.category, category);
    assert.equal(match.spenderComparison.relation, 'equal');
    assert.equal(mismatch.spenderComparison.relation, 'different');
    assert.equal(mismatch.rawAllowance, match.rawAllowance);
  }
});
test('zero expected address is accepted as bytes, never declared safe or valid onchain', () => {
  const result = decode('0x' + '0'.repeat(40));
  assert.equal(result.spenderComparison.relation, 'different');
  assert.equal('safe' in result, false);
  assert.equal('verified' in result, false);
});

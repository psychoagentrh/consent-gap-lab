import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeApproval, approvalExamples, MAX_UINT256, ApprovalInputError } from '../public/approval.js';
const encode = n => '0x095ea7b3' + '0'.repeat(24) + '1'.repeat(40) + n.toString(16).padStart(64, '0');

test('optional button comparison preserves decoder-only behavior', () => {
  for (const blank of ['', ' \n ']) {
    assert.deepEqual(decodeApproval(approvalExamples.bounded, '', blank), decodeApproval(approvalExamples.bounded));
    assert.deepEqual(decodeApproval(approvalExamples.bounded, '18', blank), decodeApproval(approvalExamples.bounded, '18'));
  }
});
test('entered amounts yield exact larger, equal and smaller differences without floating point', () => {
  const compare = amount => decodeApproval(approvalExamples.bounded, '18', amount).comparison;
  assert.deepEqual(compare(' 20.000000000000000000 '), {
    relation:'equal', enteredRaw:'20000000000000000000', enteredAmount:'20', differenceRaw:'0', differenceAmount:'0'
  });
  assert.equal(compare('19.999999999999999999').relation, 'larger');
  assert.equal(compare('19.999999999999999999').differenceRaw, '1');
  assert.equal(compare('19.999999999999999999').differenceAmount, '0.000000000000000001');
  assert.equal(compare('20.000000000000000001').relation, 'smaller');
  assert.equal(compare('20.000000000000000001').differenceRaw, '1');
  assert.equal(compare('21').differenceAmount, '1');
  assert.equal(compare('0').differenceAmount, '20');
});
test('zero and maximum amounts compare as integers, including above Number precision', () => {
  assert.equal(decodeApproval(approvalExamples.zero, '18', '0').comparison.relation, 'equal');
  assert.equal(decodeApproval(approvalExamples.zero, '18', '20').comparison.relation, 'smaller');
  assert.equal(decodeApproval(approvalExamples.maximum, '0', MAX_UINT256).comparison.relation, 'equal');
  const max = decodeApproval(approvalExamples.maximum, '18', '20').comparison;
  assert.equal(max.relation, 'larger');
  assert.equal(max.differenceRaw, (BigInt(MAX_UINT256) - 20n * 10n ** 18n).toString());
  assert.equal(decodeApproval(encode(2n ** 53n + 1n), '0', (2n ** 53n).toString()).comparison.differenceRaw, '1');
});
test('comparisons reverse supplied decimal formatting across supported precision and uint256 extremes', () => {
  for (const raw of [0n, 1n, 2n ** 53n + 1n, 2n ** 255n + 99n, BigInt(MAX_UINT256)]) {
    for (const decimals of [0,1,6,18,36]) {
      const text = decodeApproval(encode(raw), String(decimals)).displayAmount;
      const result = decodeApproval(encode(raw), String(decimals), text).comparison;
      assert.equal(result.relation, 'equal');
      assert.equal(result.enteredRaw, raw.toString());
      assert.equal(result.differenceRaw, '0');
    }
  }
});
test('comparison requires supplied decimals rather than inferring token metadata', () => {
  assert.throws(() => decodeApproval(approvalExamples.bounded, '', '20'), error => error instanceof ApprovalInputError && error.field === 'decimals');
});
test('invalid button amounts fail closed and identify their own field', () => {
  for (const invalid of [null, {}, [], 20, '-1', '+1', '1e1', '1,000', 'NaN', 'Infinity', '.5', '1.', '01', '<script>', '1'.repeat(117), (BigInt(MAX_UINT256) + 1n).toString()]) {
    assert.throws(() => decodeApproval(approvalExamples.bounded, '0', invalid), error => error instanceof ApprovalInputError && error.field === 'claimed-amount');
  }
  assert.throws(() => decodeApproval(approvalExamples.bounded, '18', MAX_UINT256), /exceeds uint256/);
});
test('too much fractional precision is refused instead of rounding, even trailing zeros', () => {
  for (const [decimals, amount] of [['0','1.0'], ['6','0.0000001'], ['6','1.0000000'], ['18','0.0000000000000000001']]) {
    assert.throws(() => decodeApproval(approvalExamples.bounded, decimals, amount), error => error instanceof ApprovalInputError && error.field === 'claimed-amount' && /not be rounded/.test(error.message));
  }
  assert.equal(decodeApproval(encode(1n), '36', '0.' + '0'.repeat(35) + '1').comparison.relation, 'equal');
});

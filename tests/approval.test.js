import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeApproval, approvalExamples, MAX_UINT256, ApprovalInputError } from '../public/approval.js';
const spender = '0x' + '1'.repeat(40);
const encode = n => '0x095ea7b3' + '0'.repeat(24) + spender.slice(2) + n.toString(16).padStart(64, '0');
test('invented approval examples distinguish maximum, exact and zero requests', () => {
  assert.equal(decodeApproval(approvalExamples.maximum).rawAllowance, MAX_UINT256);
  assert.equal(decodeApproval(approvalExamples.maximum).category, 'maximum');
  assert.deepEqual(decodeApproval(approvalExamples.bounded, '18'), {
    method:'approve(address,uint256)', spender, rawAllowance:(20n * 10n ** 18n).toString(),
    decimals:18, displayAmount:'20', category:'bounded'
  });
  assert.equal(decodeApproval(approvalExamples.zero, '18').displayAmount, '0');
  assert.equal(decodeApproval(approvalExamples.zero).category, 'zero');
});
test('no decimals are inferred, including for the 20-token example', () => {
  const result = decodeApproval(approvalExamples.bounded);
  assert.equal(result.decimals, null);
  assert.equal(result.displayAmount, null);
});
test('large integers remain exact, including non-infinite near-maximum amounts', () => {
  assert.equal(decodeApproval(encode(2n ** 256n - 2n)).category, 'bounded');
  for (const n of [2n ** 53n + 1n, 2n ** 255n + 99n, 2n ** 256n - 1n]) {
    assert.equal(decodeApproval(encode(n), '0').displayAmount, n.toString());
  }
});
test('fractional formatting preserves small amounts and removes only trailing zeros', () => {
  assert.equal(decodeApproval(encode(1n), '18').displayAmount, '0.000000000000000001');
  assert.equal(decodeApproval(encode(1000100n), '6').displayAmount, '1.0001');
  assert.equal(decodeApproval(encode(1n), '36').displayAmount, '0.' + '0'.repeat(35) + '1');
});
test('decimal formatting reverses exactly across uint256 boundary cases', () => {
  for (const bit of [0,1,32,53,64,128,255]) {
    for (const decimals of [0,1,6,18,36]) {
      const n = 2n ** BigInt(bit) + 1n;
      const value = decodeApproval(encode(n), String(decimals)).displayAmount;
      const [whole, fraction = ''] = value.split('.');
      assert.equal(BigInt(whole + fraction.padEnd(decimals, '0')), n);
    }
  }
});
test('hex case and surrounding whitespace do not alter values; missing prefix is refused', () => {
  const mixed = '0x' + approvalExamples.maximum.slice(2).toUpperCase();
  assert.equal(decodeApproval(' \n' + mixed + '\n ').rawAllowance, MAX_UINT256);
  assert.throws(() => decodeApproval(approvalExamples.maximum.slice(2)), ApprovalInputError);
});
test('unsupported selectors and extra or truncated data fail closed', () => {
  for (const invalid of [
    approvalExamples.bounded.replace('095ea7b3','a9059cbb'), // transfer
    approvalExamples.bounded.replace('095ea7b3','a22cb465'), // setApprovalForAll
    approvalExamples.bounded.slice(0,-2), approvalExamples.bounded + '00',
    '0x095ea7b3', JSON.stringify({data:approvalExamples.bounded}),
    approvalExamples.bounded.replace('1111','11zz')
  ]) assert.throws(() => decodeApproval(invalid), ApprovalInputError);
});
test('non-canonical address padding is refused; zero address is decoded without endorsement', () => {
  assert.throws(() => decodeApproval(approvalExamples.bounded.slice(0,10) + '1' + approvalExamples.bounded.slice(11)), /padding/);
  assert.equal(decodeApproval('0x095ea7b3' + '0'.repeat(128)).spender, '0x' + '0'.repeat(40));
});
test('non-string and oversized data cannot reach bigint conversion', () => {
  for (const invalid of [null, undefined, {}, [], 123, 'x'.repeat(513), '<script>alert(1)</script>']) {
    assert.throws(() => decodeApproval(invalid), ApprovalInputError);
  }
});
test('invalid or unsupported supplied decimals identify the decimals field', () => {
  for (const invalid of ['-1','37','255','1.5','1e1','+18','018','NaN','<script>',null,18]) {
    assert.throws(() => decodeApproval(approvalExamples.bounded, invalid), error => error instanceof ApprovalInputError && error.field === 'decimals');
  }
  assert.equal(decodeApproval(approvalExamples.bounded, ' 18 ').displayAmount, '20');
});

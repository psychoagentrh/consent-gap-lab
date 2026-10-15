// The Flow embeds this evaluator and the canonical offline decoder. No wallet
// provider, signing, RPC or arbitrary URL is involved in this synthetic fixture.
import { decodeApproval } from '../public/approval.js';
import { APPROVAL_CASES, SPENDER_APPROVAL_CASES, UNSIGNED_APPROVAL_SCHEMA, SPENDER_APPROVAL_SCHEMA } from './unsigned-approval-contract.js';

export function evaluateUnsignedApproval(body, expectedCase) {
  if (!APPROVAL_CASES.includes(expectedCase)) throw new Error('Unknown unsigned approval fixture');
  if (typeof body === 'string' && body.length > 8192) throw new Error('Oversized fixture');
  const payload = typeof body === 'string' ? JSON.parse(body) : body;
  const hasExpectation = SPENDER_APPROVAL_CASES.includes(expectedCase);
  const hasKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
  const rootKeys = ['schema', 'synthetic', 'case', 'button', 'transaction', 'transactionSigned', 'transactionSubmitted', 'payloadDigest'];
  if (hasExpectation) rootKeys.push('expectedSpender');
  if (!hasKeys(payload, rootKeys) ||
      payload.schema !== (hasExpectation ? SPENDER_APPROVAL_SCHEMA : UNSIGNED_APPROVAL_SCHEMA) ||
      payload.synthetic !== true || payload.case !== expectedCase ||
      payload.transactionSigned !== false || payload.transactionSubmitted !== false ||
      !hasKeys(payload.button, ['label', 'claimedAmount', 'assumedDecimals']) ||
      payload.button.label !== 'Swap 20 SYN' || payload.button.claimedAmount !== '20' || payload.button.assumedDecimals !== '18' ||
      !hasKeys(payload.transaction, ['to', 'value', 'data']) ||
      payload.transaction.to !== '0x2222222222222222222222222222222222222222' || payload.transaction.value !== '0' ||
      typeof payload.payloadDigest !== 'string' || !/^[a-f0-9]{64}$/.test(payload.payloadDigest) ||
      (hasExpectation && (typeof payload.expectedSpender !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(payload.expectedSpender)))) {
    throw new Error('Invalid owned synthetic unsigned approval fixture');
  }
  // Derive both relations from actual bytes and the explicitly supplied expectation,
  // never the case name. The expectation is invented teaching data, not a registry.
  const expectedSpender = hasExpectation ? payload.expectedSpender : '';
  const decoded = decodeApproval(payload.transaction.data, payload.button.assumedDecimals, payload.button.claimedAmount, expectedSpender);
  const spenderComparison = decoded.spenderComparison ? decoded.spenderComparison.relation : 'not-provided';
  let verdict = decoded.comparison.relation === 'larger'
    ? 'Unsigned approval amount is larger than the synthetic button amount.'
    : decoded.comparison.relation === 'equal'
      ? 'Unsigned approval amount equals the synthetic button amount; no swap is proved.'
      : 'Unsigned approval amount is smaller than the synthetic button amount; no swap is proved.';
  if (spenderComparison === 'different') verdict += ' The decoded spender differs from the supplied synthetic expectation.';
  if (spenderComparison === 'equal') verdict += ' The decoded spender equals the supplied synthetic expectation; address equality is not a safety verdict.';
  return {
    approvalCaseObserved:expectedCase,
    spender:decoded.spender,
    expectedSpender:decoded.spenderComparison ? decoded.spenderComparison.enteredSpender : '',
    spenderComparison,
    rawAllowance:decoded.rawAllowance,
    claimedRawAmount:decoded.comparison.enteredRaw,
    comparison:decoded.comparison.relation,
    scopeExceedsButton:decoded.comparison.relation === 'larger',
    approvalIsSwap:false,
    verdict,
    fixtureSchema:payload.schema,
    payloadDigest:payload.payloadDigest,
    observedAt:new Date().toISOString(),
    method:'HTTP JSON fixture plus canonical approve calldata decoding; not browser automation or a signed transaction'
  };
}

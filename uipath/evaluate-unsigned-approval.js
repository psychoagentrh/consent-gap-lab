import { decodeApproval } from '../public/approval.js';

// Shared by local tests and the portable Flow's embedded script. It interprets
// owned synthetic bytes, not browser text, contract behavior or an onchain receipt.
export function evaluateUnsignedApproval(body, expectedCase) {
  if (expectedCase !== 'maximum' && expectedCase !== 'bounded') throw new Error('Unapproved approval case');
  if (typeof body === 'string' && body.length > 8192) throw new Error('Oversized fixture');
  const payload = typeof body === 'string' ? JSON.parse(body) : body;
  if (!payload || typeof payload !== 'object' || payload.schema !== 'consent-gap-unsigned-approval-v1' ||
      payload.synthetic !== true || payload.case !== expectedCase ||
      payload.transactionSigned !== false || payload.transactionSubmitted !== false ||
      !payload.button || payload.button.label !== 'Swap 20 SYN' ||
      payload.button.claimedAmount !== '20' || payload.button.assumedDecimals !== '18' ||
      !payload.transaction || payload.transaction.to !== '0x2222222222222222222222222222222222222222' ||
      payload.transaction.value !== '0' || !/^[a-f0-9]{64}$/.test(payload.payloadDigest || '')) {
    throw new Error('Invalid owned synthetic unsigned approval fixture');
  }
  // The relation comes from actual uint256 bytes, never the fixture's case name.
  const decoded = decodeApproval(payload.transaction.data, payload.button.assumedDecimals, payload.button.claimedAmount);
  return {
    approvalCaseObserved:expectedCase,
    spender:decoded.spender,
    rawAllowance:decoded.rawAllowance,
    claimedRawAmount:decoded.comparison.enteredRaw,
    comparison:decoded.comparison.relation,
    scopeExceedsButton:decoded.comparison.relation === 'larger',
    approvalIsSwap:false,
    verdict:decoded.comparison.relation === 'larger'
      ? 'Unsigned approval amount is larger than the synthetic button amount.'
      : decoded.comparison.relation === 'equal'
        ? 'Unsigned approval amount equals the synthetic button amount; no swap is proved.'
        : 'Unsigned approval amount is smaller than the synthetic button amount; no swap is proved.',
    fixtureSchema:payload.schema,
    payloadDigest:payload.payloadDigest,
    observedAt:new Date().toISOString(),
    method:'HTTP JSON fixture plus canonical approve calldata decoding; not browser automation or a signed transaction'
  };
}

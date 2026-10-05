// Shared, pure evaluator embedded verbatim into the Flow script node.
// The HTTP node performs I/O; this function rejects untrusted or unexpected data.
export function evaluateSpecimen(body, expectedCase) {
  const d = typeof body === 'string' ? JSON.parse(body) : body;
  if (!d || typeof d !== 'object' || d.schema !== 'consent-gap/v1' || d.synthetic !== true) throw new Error('Invalid synthetic specimen schema');
  if (!['unlimited','bounded'].includes(expectedCase) || d.case !== expectedCase) throw new Error('Unexpected specimen case');
  if (d.button !== 'Approve 20 TEST' || d.requestedAmount !== 20 || d.permissionType !== 'token-allowance' || d.swapExecuted !== false) throw new Error('Unexpected specimen permission');
  const unlimited = d.case === 'unlimited';
  if (d.allowanceType !== (unlimited ? 'unlimited' : 'exact') || d.allowanceAmount !== (unlimited ? null : 20)) throw new Error('Unexpected specimen allowance');
  if (typeof d.payloadDigest !== 'string' || !/^[a-f0-9]{64}$/.test(d.payloadDigest)) throw new Error('Missing payload digest');
  return {
    specimenCase:d.case,
    scopeExceedsButton:unlimited,
    approvalIsSwap:false,
    verdict:unlimited ? 'Button != permission' : 'Approval != swap',
    fixtureSchema:d.schema,
    payloadDigest:d.payloadDigest,
    observedAt:new Date().toISOString(),
    method:'HTTP JSON fixture observation, not browser automation'
  };
}

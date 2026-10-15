// Shared by the owned fixture service, evaluator and portable Flow generator.
export const UNSIGNED_APPROVAL_SCHEMA = 'consent-gap-unsigned-approval-v1';
export const SPENDER_APPROVAL_SCHEMA = 'consent-gap-unsigned-approval-spender-v2';
export const LEGACY_APPROVAL_CASES = Object.freeze(['maximum', 'bounded']);
export const SPENDER_APPROVAL_CASES = Object.freeze(['spender-match', 'spender-mismatch']);
export const APPROVAL_CASES = Object.freeze([...LEGACY_APPROVAL_CASES, ...SPENDER_APPROVAL_CASES]);
// Bounded Cloud envelope. The local evaluator retains schema/no-swap diagnostics;
// it still validates those properties before any of these outputs are emitted.
export const UNSIGNED_APPROVAL_OUTPUTS = Object.freeze([
  'approvalCaseObserved', 'spender', 'expectedSpender', 'spenderComparison',
  'rawAllowance', 'claimedRawAmount', 'comparison', 'scopeExceedsButton',
  'verdict', 'payloadDigest', 'observedAt', 'method'
]);

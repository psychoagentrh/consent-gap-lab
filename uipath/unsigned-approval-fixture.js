import { approvalExamples } from '../public/approval.js';
import { APPROVAL_CASES, UNSIGNED_APPROVAL_SCHEMA, SPENDER_APPROVAL_SCHEMA, SPENDER_APPROVAL_CASES } from './unsigned-approval-contract.js';
export { APPROVAL_CASES, UNSIGNED_APPROVAL_SCHEMA } from './unsigned-approval-contract.js';

// Entirely invented teaching data. No chain, account, signature or receipt.
// Keep legacy property order and bytes stable: historical observations use its digest.
export function unsignedApprovalFixture(approvalCase) {
  if (!APPROVAL_CASES.includes(approvalCase)) throw new Error('Unknown unsigned approval fixture');
  const hasExpectation = SPENDER_APPROVAL_CASES.includes(approvalCase);
  return {
    schema:hasExpectation ? SPENDER_APPROVAL_SCHEMA : UNSIGNED_APPROVAL_SCHEMA,
    synthetic:true,
    case:approvalCase,
    button:{ label:'Swap 20 SYN', claimedAmount:'20', assumedDecimals:'18' },
    transaction:{
      to:'0x2222222222222222222222222222222222222222',
      value:'0',
      data:approvalExamples[hasExpectation ? 'bounded' : approvalCase]
    },
    transactionSigned:false,
    transactionSubmitted:false,
    ...(hasExpectation ? {
      expectedSpender:approvalCase === 'spender-match'
        ? '0x1111111111111111111111111111111111111111'
        : '0x3333333333333333333333333333333333333333'
    } : {})
  };
}

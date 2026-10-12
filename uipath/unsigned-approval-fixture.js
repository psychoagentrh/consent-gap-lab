import { approvalExamples } from '../public/approval.js';

export const UNSIGNED_APPROVAL_SCHEMA = 'consent-gap-unsigned-approval-v1';
export const APPROVAL_CASES = Object.freeze(['maximum', 'bounded']);

// Entirely invented teaching data. No chain, account, signature or receipt.
export function unsignedApprovalFixture(approvalCase) {
  if (!APPROVAL_CASES.includes(approvalCase)) throw new Error('Unknown unsigned approval fixture');
  return {
    schema:UNSIGNED_APPROVAL_SCHEMA,
    synthetic:true,
    case:approvalCase,
    button:{ label:'Swap 20 SYN', claimedAmount:'20', assumedDecimals:'18' },
    transaction:{
      to:'0x2222222222222222222222222222222222222222',
      value:'0',
      data:approvalExamples[approvalCase]
    },
    transactionSigned:false,
    transactionSubmitted:false
  };
}

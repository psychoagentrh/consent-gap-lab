export const cases = Object.freeze({
  unlimited: { title:'Swap specimen A', action:'Swap 20 synthetic TEST for 1 synthetic DEMO', button:'Approve 20 TEST', request:'Token spending approval', scope:'Unlimited TEST allowance', aftermath:'The spender can request more TEST later until the allowance is revoked. This fixture contains no wallet or real token.', note:'The button describes today’s swap. The permission describes future spending.', safety:'Inspect the spender and allowance in your wallet. Consider an exact allowance if supported; revoke a permission you no longer want.', expectation:'Up to 20 TEST', gap:'Button ≠ permission' },
  bounded: { title:'Swap specimen B', action:'Swap 20 synthetic TEST for 1 synthetic DEMO', button:'Approve 20 TEST', request:'Token spending approval', scope:'20 TEST allowance', aftermath:'This fixture grants a bounded token allowance. It is still a separate permission, not proof that the swap executed.', note:'The amount matches, but the approval is not the swap.', safety:'Verify spender, chain, amount, and the later swap confirmation separately.', expectation:'Up to 20 TEST', gap:'Approval ≠ swap' }
});
export function chooseCase(id) { return Object.hasOwn(cases, id) ? id : 'unlimited'; }
// The read-only observation endpoint and teaching cards share this source.
export function specimen(id) {
 if (!Object.hasOwn(cases, id)) throw new RangeError('Unknown specimen');
 return { schema:'consent-gap/v1', synthetic:true, case:id, button:cases[id].button,
  requestedAmount:20, permissionType:'token-allowance',
  allowanceType:id === 'unlimited' ? 'unlimited' : 'exact',
  allowanceAmount:id === 'unlimited' ? null : 20, swapExecuted:false };
}
export function reveal(id, choice) {
 const selected = chooseCase(id);
 const c = cases[selected];
 if (!['one', 'future', 'unsure'].includes(choice)) throw new RangeError('Choose a valid prediction');
 return { ...c, choice, correct: choice === (selected === 'unlimited' ? 'future' : 'one'), caveat: selected === 'bounded' ? 'Even an exact approval is not a completed swap.' : 'This synthetic example does not assert any real application behaves this way.' };
}

// Comparison is entirely local. It does not observe a wallet or start a Cloud job.
export function comparePermissions() {
 return Object.keys(cases).map(id => {
  const c = cases[id];
  const request = specimen(id);
  return { id, title:c.title, rows:[
   { label:'Displayed button', value:request.button, different:false },
   { label:'Requested permission', value:c.request, different:false },
   { label:'Allowance', value:c.scope, different:true },
   { label:'Could exceed the displayed 20 TEST?', value:request.allowanceType === 'unlimited' ? 'Yes, within the granted allowance' : 'No, this approval caps spending at 20 TEST', different:true },
   { label:'Does approval execute the swap?', value:request.swapExecuted ? 'Yes' : 'No. Approval is a separate permission.', different:false }
  ] };
 });
}

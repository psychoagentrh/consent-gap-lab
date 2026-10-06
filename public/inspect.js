import { decodeApproval, approvalExamples } from './approval.js';
const $ = selector => document.querySelector(selector);
let decoded = null;
const meanings = {
  maximum:{label:'Maximum uint256 request', text:'This is the largest uint256 value, commonly used as an unlimited allowance by standard ERC-20 implementations. It is not a trust signal or proof that an allowance was granted.'},
  bounded:{label:'Bounded amount request', text:'For a standard ERC-20 contract, this requests an allowance of the amount shown, replacing the existing allowance. The spender may spend against it across multiple transfers. It is not a completed swap or a safety verdict.'},
  zero:{label:'Zero amount request', text:'For a standard ERC-20 contract, a successful approval of zero sets this spender’s allowance to zero. Decoding these bytes does not prove a revocation succeeded or revoke other permissions.'}
};
function resetResult() {
  decoded = null;
  $('#approval-result').hidden = true;
  $('#empty-result').hidden = false;
  $('#approval-details').replaceChildren();
  $('#allowance-label').textContent = '';
  $('#allowance-meaning').textContent = '';
  $('#copy-status').textContent = '';
  $('#decode-error').hidden = true;
  $('#decode-error').textContent = '';
  for (const field of ['calldata','decimals']) $('#' + field).removeAttribute('aria-invalid');
}
for (const field of ['calldata','decimals']) {
  $('#' + field).addEventListener('input', () => { resetResult(); $('#example-note').hidden = true; });
}
document.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => {
  resetResult();
  $('#calldata').value = approvalExamples[button.dataset.example];
  $('#decimals').value = '18';
  $('#example-note').hidden = false;
  $('#calldata').focus();
}));
$('#clear-data').addEventListener('click', () => {
  $('#inspect-form').reset();
  resetResult();
  $('#example-note').hidden = true;
  $('#calldata').focus();
});
$('#inspect-form').addEventListener('submit', event => {
  event.preventDefault();
  resetResult();
  try {
    decoded = decodeApproval($('#calldata').value, $('#decimals').value);
  } catch (error) {
    $('#decode-error').textContent = error.message;
    $('#decode-error').hidden = false;
    const field = $('#' + (error.field || 'calldata'));
    field.setAttribute('aria-invalid', 'true');
    field.focus();
    return;
  }
  const rows = [
    ['Layout decoded', decoded.method],
    ['Spender address (not verified)', decoded.spender],
    ['Raw allowance (assuming standard ERC-20)', decoded.rawAllowance],
    ['Token decimals', decoded.decimals === null ? 'Unknown. No token metadata lookup.' : String(decoded.decimals) + ' (supplied, not verified)']
  ];
  if (decoded.displayAmount !== null) rows.push(['Amount using supplied decimals', decoded.displayAmount + ' tokens (token identity unknown)']);
  for (const [label, value] of rows) {
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = label;
    detail.textContent = value;
    $('#approval-details').append(term, detail);
  }
  $('#allowance-label').textContent = meanings[decoded.category].label;
  $('#allowance-meaning').textContent = meanings[decoded.category].text;
  $('#empty-result').hidden = true;
  $('#approval-result').hidden = false;
  $('#approval-title').focus();
});
$('#copy-summary').addEventListener('click', async () => {
  if (!decoded) return;
  const result = decoded;
  const summary = [
    'Consent Gap Lab: local approval request decoding, not a safety verdict.',
    'Layout: ' + result.method,
    'Spender (not verified): ' + result.spender,
    'Raw allowance (assuming standard ERC-20): ' + result.rawAllowance,
    'Request type: ' + meanings[result.category].label,
    'Decimals: ' + (result.decimals === null ? 'unknown' : result.decimals + ' (supplied, not verified)'),
    ...(result.displayAmount === null ? [] : ['Amount using supplied decimals: ' + result.displayAmount + ' tokens (identity unknown)']),
    'Token standard unverified: ERC-721 uses the same selector but its second value is a token ID, not an allowance.',
    'Contract behavior, chain, token, live allowance and receipt not checked. No transaction executed.',
    'https://lab.psychoagent.com/inspect.html'
  ].join('\n');
  try {
    await navigator.clipboard.writeText(summary);
    if (decoded === result) $('#copy-status').textContent = 'Summary copied to clipboard. Not uploaded or linked publicly.';
  } catch {
    if (decoded === result) $('#copy-status').textContent = 'Copy unavailable. Select the decoded text manually; no data was uploaded.';
  }
});

import { decodeApproval, approvalExamples } from './approval.js';
import { readExampleLink, exampleURL, invalidExampleMessage } from './inspector-link.js';
const $ = selector => document.querySelector(selector);
let decoded = null;
let exampleCopyVersion = 0;
function comparisonText(comparison) {
  return comparison.relation === 'equal' ? 'Matches the amount you entered' : 'Request is ' + comparison.relation + ' than your entered amount';
}
const meanings = {
  maximum:{label:'Maximum uint256 request', text:'This is the largest uint256 value, commonly used as an unlimited allowance by standard ERC-20 implementations. It is not a trust signal or proof that an allowance was granted.'},
  bounded:{label:'Bounded amount request', text:'For a standard ERC-20 contract, this requests an allowance of the amount shown, replacing the existing allowance. The spender may spend against it across multiple transfers. It is not a completed swap or a safety verdict.'},
  zero:{label:'Zero amount request', text:'For a standard ERC-20 contract, a successful approval of zero sets this spender’s allowance to zero. Decoding these bytes does not prove a revocation succeeded or revoke other permissions.'}
};
function resetResult() {
  decoded = null;
  exampleCopyVersion++;
  $('#example-copy-status').textContent = '';
  $('#approval-result').hidden = true;
  $('#empty-result').hidden = false;
  $('#approval-details').replaceChildren();
  $('#allowance-label').textContent = '';
  $('#allowance-meaning').textContent = '';
  $('#amount-comparison').hidden = true;
  $('#comparison-label').textContent = '';
  $('#comparison-detail').textContent = '';
  $('#copy-status').textContent = '';
  $('#decode-error').hidden = true;
  $('#decode-error').textContent = '';
  for (const field of ['calldata','decimals','claimed-amount']) $('#' + field).removeAttribute('aria-invalid');
}
for (const field of ['calldata','decimals','claimed-amount']) {
  $('#' + field).addEventListener('input', () => { clearExampleLink(); resetResult(); $('#example-note').hidden = true; });
}
function clearExampleLink() {
  if (location.search || location.hash) history.replaceState(null, '', location.pathname);
  $('#example-link-error').hidden = true;
}
function fillExample(name) {
  resetResult();
  $('#calldata').value = approvalExamples[name];
  $('#decimals').value = '18';
  $('#claimed-amount').value = name === 'zero' ? '0' : '20';
  $('#example-note').hidden = false;
}
document.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => {
  clearExampleLink();
  fillExample(button.dataset.example);
  $('#calldata').focus();
}));
$('#clear-data').addEventListener('click', () => {
  clearExampleLink();
  $('#inspect-form').reset();
  resetResult();
  $('#example-note').hidden = true;
  $('#calldata').focus();
});
$('#inspect-form').addEventListener('submit', event => {
  event.preventDefault();
  decodeCurrent();
});
function decodeCurrent() {
  resetResult();
  try {
    decoded = decodeApproval($('#calldata').value, $('#decimals').value, $('#claimed-amount').value);
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
  if (decoded.comparison) {
    $('#comparison-label').textContent = comparisonText(decoded.comparison);
    $('#comparison-detail').textContent = 'Entered amount: ' + decoded.comparison.enteredAmount + ' tokens. Exact difference: ' + decoded.comparison.differenceAmount + ' tokens (using supplied decimals).';
    $('#amount-comparison').hidden = false;
  }
  $('#empty-result').hidden = true;
  $('#approval-result').hidden = false;
  $('#approval-title').focus();
}
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
    ...(result.comparison ? [
      'Button amount entered by visitor (not verified): ' + result.comparison.enteredAmount + ' tokens',
      comparisonText(result.comparison) + '. Exact difference: ' + result.comparison.differenceAmount + ' tokens (using supplied decimals).',
      'Comparison is numerical only. Button text, decimals and standard ERC-20 behavior are not verified. A match or smaller request is not a safety verdict or completed purchase.'
    ] : []),
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
$('#copy-example-link').addEventListener('click', async () => {
  const version = ++exampleCopyVersion;
  try {
    await navigator.clipboard.writeText(exampleURL);
    if (version === exampleCopyVersion) $('#example-copy-status').textContent = 'Invented example link copied. Your entered data is not included.';
  } catch {
    if (version === exampleCopyVersion) $('#example-copy-status').textContent = 'Copy unavailable. Use the max vs 20 example link above; it contains no entered data.';
  }
});
function loadExampleLink() {
  $('#inspect-form').reset();
  resetResult();
  $('#example-note').hidden = true;
  $('#example-link-error').hidden = true;
  try {
    const name = readExampleLink(location.href);
    if (name) { fillExample(name); decodeCurrent(); }
  } catch {
    clearExampleLink();
    $('#example-link-error').textContent = invalidExampleMessage;
    $('#example-link-error').hidden = false;
  }
}
window.addEventListener('popstate', loadExampleLink);
loadExampleLink();

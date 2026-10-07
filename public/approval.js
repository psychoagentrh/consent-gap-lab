// A strict, local ABI layout decoder. It does not verify contract behavior or a receipt.
export const APPROVE_SELECTOR = '095ea7b3';
export const MAX_UINT256 = (2n ** 256n - 1n).toString();
export class ApprovalInputError extends Error {
  constructor(message, field = 'calldata') { super(message); this.field = field; }
}

function formatAmount(raw, decimals) {
  if (decimals === 0) return raw;
  const digits = raw.padStart(decimals + 1, '0');
  const fraction = digits.slice(-decimals).replace(/0+$/, '');
  return digits.slice(0, -decimals) + (fraction ? '.' + fraction : '');
}

// Button text is supplied by the visitor, never discovered or authenticated.
function compareAmount(rawAllowance, decimals, input) {
  if (typeof input !== 'string' || input.length > 116) {
    throw new ApprovalInputError('Enter a plain non-negative token amount, or leave it blank. Scientific notation and commas are not supported.', 'claimed-amount');
  }
  const amount = input.trim();
  if (amount === '') return null;
  if (decimals === null) {
    throw new ApprovalInputError('Supply token decimals to compare a token amount. No metadata is looked up.', 'decimals');
  }
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(amount)) {
    throw new ApprovalInputError('Use a plain non-negative token amount such as 20 or 0.5, without commas, signs or scientific notation.', 'claimed-amount');
  }
  const [whole, fraction = ''] = amount.split('.');
  if (fraction.length > decimals) {
    throw new ApprovalInputError('The amount has more fractional digits than the supplied token decimals. It will not be rounded.', 'claimed-amount');
  }
  const claimed = BigInt(whole + fraction.padEnd(decimals, '0'));
  if (claimed > BigInt(MAX_UINT256)) {
    throw new ApprovalInputError('The entered amount exceeds uint256 using these decimals. Check the amount and decimals.', 'claimed-amount');
  }
  const requested = BigInt(rawAllowance);
  const difference = requested >= claimed ? requested - claimed : claimed - requested;
  return {
    relation:requested > claimed ? 'larger' : requested < claimed ? 'smaller' : 'equal',
    enteredRaw:claimed.toString(), enteredAmount:formatAmount(claimed.toString(), decimals),
    differenceRaw:difference.toString(), differenceAmount:formatAmount(difference.toString(), decimals)
  };
}

export function decodeApproval(input, decimalInput = '', amountInput = '') {
  if (typeof input !== 'string' || input.length > 512) {
    throw new ApprovalInputError('Paste only the 68-byte approval calldata, starting with 0x.');
  }
  const data = input.trim();
  if (!/^0x[0-9a-fA-F]{136}$/.test(data)) {
    throw new ApprovalInputError('Expected exactly 68 bytes: 0x, an 8-digit selector and two 64-digit words. Transaction JSON, signatures and extra bytes are not supported.');
  }
  if (data.slice(2, 10).toLowerCase() !== APPROVE_SELECTOR) {
    throw new ApprovalInputError('This is not the approve(address,uint256) selector. Permit, Permit2, NFT permission interpretation and multicalls are outside scope.');
  }
  const addressWord = data.slice(10, 74);
  if (!/^0{24}/.test(addressWord)) {
    throw new ApprovalInputError('Non-canonical address padding. The first 12 bytes of the spender word must be zero.');
  }
  if (typeof decimalInput !== 'string') {
    throw new ApprovalInputError('Leave decimals blank, or enter a whole number from 0 to 36. No token metadata is looked up.', 'decimals');
  }
  const decimalText = decimalInput.trim();
  if (decimalText !== '' && (!/^(0|[1-9][0-9]?)$/.test(decimalText) || Number(decimalText) > 36)) {
    throw new ApprovalInputError('Leave decimals blank, or enter a whole number from 0 to 36. No token metadata is looked up.', 'decimals');
  }
  const rawAllowance = BigInt('0x' + data.slice(74)).toString();
  const decimals = decimalText === '' ? null : Number(decimalText);
  const displayAmount = decimals === null ? null : formatAmount(rawAllowance, decimals);
  const comparison = compareAmount(rawAllowance, decimals, amountInput);
  return {
    method:'approve(address,uint256)',
    spender:'0x' + addressWord.slice(24).toLowerCase(),
    rawAllowance, decimals, displayAmount,
    category:rawAllowance === MAX_UINT256 ? 'maximum' : rawAllowance === '0' ? 'zero' : 'bounded',
    ...(comparison ? {comparison} : {})
  };
}

// Invented teaching address, not a recommendation or a verified contract.
const sample = amount => '0x' + APPROVE_SELECTOR + '0'.repeat(24) + '1'.repeat(40) + amount.toString(16).padStart(64, '0');
export const approvalExamples = Object.freeze({
  maximum:sample(2n ** 256n - 1n),
  bounded:sample(20n * 10n ** 18n),
  zero:sample(0n)
});

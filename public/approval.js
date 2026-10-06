// A strict, local ABI layout decoder. It does not verify contract behavior or a receipt.
export const APPROVE_SELECTOR = '095ea7b3';
export const MAX_UINT256 = (2n ** 256n - 1n).toString();
export class ApprovalInputError extends Error {
  constructor(message, field = 'calldata') { super(message); this.field = field; }
}

export function decodeApproval(input, decimalInput = '') {
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
  let displayAmount = null;
  if (decimals !== null) {
    if (decimals === 0) displayAmount = rawAllowance;
    else {
      const digits = rawAllowance.padStart(decimals + 1, '0');
      const fraction = digits.slice(-decimals).replace(/0+$/, '');
      displayAmount = digits.slice(0, -decimals) + (fraction ? '.' + fraction : '');
    }
  }
  return {
    method:'approve(address,uint256)',
    spender:'0x' + addressWord.slice(24).toLowerCase(),
    rawAllowance, decimals, displayAmount,
    category:rawAllowance === MAX_UINT256 ? 'maximum' : rawAllowance === '0' ? 'zero' : 'bounded'
  };
}

// Invented teaching address, not a recommendation or a verified contract.
const sample = amount => '0x' + APPROVE_SELECTOR + '0'.repeat(24) + '1'.repeat(40) + amount.toString(16).padStart(64, '0');
export const approvalExamples = Object.freeze({
  maximum:sample(2n ** 256n - 1n),
  bounded:sample(20n * 10n ** 18n),
  zero:sample(0n)
});

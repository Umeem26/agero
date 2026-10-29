// XLM <-> stroops with BigInt only (1 XLM = 10^7 stroops). No floats anywhere.
export const STROOPS_PER_XLM = 10_000_000n;
const XLM_DECIMALS = 7;
const XLM_PATTERN = /^\d+(\.\d{1,7})?$/;
// Contract amounts are i128
const I128_MAX = (1n << 127n) - 1n;

// "12.5" -> 125000000n. Throws RangeError on anything that is not a plain non-negative decimal.
export function xlmToStroops(input) {
  const text = String(input ?? '').trim();
  if (!XLM_PATTERN.test(text)) {
    throw new RangeError('Enter an XLM amount such as 10 or 10.5 (up to 7 decimals).');
  }
  const [whole, frac = ''] = text.split('.');
  const stroops = BigInt(whole) * STROOPS_PER_XLM + BigInt(frac.padEnd(XLM_DECIMALS, '0'));
  if (stroops > I128_MAX) throw new RangeError('Amount is too large.');
  return stroops;
}

// 125000000n -> "12.5". Accepts bigint, integer number or digit string.
export function stroopsToXlm(stroops) {
  const value = BigInt(stroops);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / STROOPS_PER_XLM;
  const frac = (abs % STROOPS_PER_XLM).toString().padStart(XLM_DECIMALS, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
}

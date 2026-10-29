import { describe, expect, it } from 'vitest';
import { STROOPS_PER_XLM, stroopsToXlm, xlmToStroops } from './units';

describe('xlmToStroops', () => {
  it('converts whole and fractional XLM exactly', () => {
    expect(xlmToStroops('1')).toBe(STROOPS_PER_XLM);
    expect(xlmToStroops('12.5')).toBe(125_000_000n);
    expect(xlmToStroops('0.0000001')).toBe(1n);
    expect(xlmToStroops(' 800 ')).toBe(8_000_000_000n);
    expect(xlmToStroops('0')).toBe(0n);
  });

  it('does not lose precision where floats would', () => {
    // 0.1 + 0.2 style inputs and amounts beyond Number.MAX_SAFE_INTEGER stroops
    expect(xlmToStroops('0.3')).toBe(3_000_000n);
    expect(xlmToStroops('922337203685.4775807')).toBe(9_223_372_036_854_775_807n);
  });

  it('rejects malformed input', () => {
    for (const bad of ['', '-1', '1e3', '1.', '.5', '1.12345678', 'abc', '1,5', null, undefined]) {
      expect(() => xlmToStroops(bad)).toThrow(RangeError);
    }
  });

  it('rejects amounts above i128', () => {
    expect(() => xlmToStroops('99999999999999999999999999999999999')).toThrow(/too large/);
  });
});

describe('stroopsToXlm', () => {
  it('formats without trailing zeros', () => {
    expect(stroopsToXlm(10_000_000n)).toBe('1');
    expect(stroopsToXlm(125_000_000n)).toBe('12.5');
    expect(stroopsToXlm(1n)).toBe('0.0000001');
    expect(stroopsToXlm(0n)).toBe('0');
    expect(stroopsToXlm(-10_502_769n)).toBe('-1.0502769');
    expect(stroopsToXlm('99989497231')).toBe('9998.9497231');
  });

  it('round-trips', () => {
    for (const s of ['1', '0.5', '123.4567891', '0.0000001', '100000000']) {
      expect(stroopsToXlm(xlmToStroops(s))).toBe(s);
    }
  });
});

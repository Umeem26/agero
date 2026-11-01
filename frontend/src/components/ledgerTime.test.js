import { describe, expect, it } from 'vitest';
import { formatSpan, remainingShare } from './ledgerTime';

describe('formatSpan', () => {
  it('shows hours and minutes between 1 h and 48 h', () => {
    expect(formatSpan(31 * 3600 + 12 * 60 + 5)).toBe('31 h 12 m');
    expect(formatSpan(3600)).toBe('1 h 0 m');
  });
  it('shows days and hours from 48 h', () => {
    expect(formatSpan(72 * 3600)).toBe('3 d 0 h');
    expect(formatSpan(30 * 86400 + 5 * 3600)).toBe('30 d 5 h');
  });
  it('shows minutes and seconds under an hour, never negative', () => {
    expect(formatSpan(125)).toBe('2 m 5 s');
    expect(formatSpan(-10)).toBe('0 m 0 s');
  });
  it('accepts bigint seconds', () => {
    expect(formatSpan(7200n)).toBe('2 h 0 m');
  });
});

describe('remainingShare', () => {
  it('is the fraction of the window left, clamped to 0..1', () => {
    expect(remainingShare(0n, 100n, 25n)).toBe(0.75);
    expect(remainingShare(0n, 100n, -5n)).toBe(1);
    expect(remainingShare(0n, 100n, 150n)).toBe(0);
  });
  it('is 0 for an empty window', () => {
    expect(remainingShare(10n, 10n, 10n)).toBe(0);
  });
});

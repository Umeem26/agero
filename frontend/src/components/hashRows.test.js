import { describe, expect, it } from 'vitest';
import { hashRows } from './hashRows';

describe('hashRows', () => {
  it('splits 64 hex characters into 4 rows of 4 groups of 4, lower case', () => {
    const hash = `${'AB12'.repeat(4)}${'cd34'.repeat(4)}${'0000'.repeat(4)}${'ffff'.repeat(4)}`;
    const rows = hashRows(hash);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual(['ab12', 'ab12', 'ab12', 'ab12']);
    expect(rows[3].join('')).toBe('f'.repeat(16));
  });
  it('returns null for anything that is not 64 hex characters', () => {
    expect(hashRows('abc')).toBeNull();
    expect(hashRows(`${'g'.repeat(64)}`)).toBeNull();
    expect(hashRows(null)).toBeNull();
  });
});

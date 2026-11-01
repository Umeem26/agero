import { describe, expect, it } from 'vitest';
import { glyphCells } from './glyph';

const A = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI';
const B = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ';

describe('glyphCells', () => {
  it('is deterministic for an address', () => {
    expect(glyphCells(A)).toEqual(glyphCells(A));
  });
  it('differs between addresses', () => {
    expect(glyphCells(A)).not.toEqual(glyphCells(B));
  });
  it('is a 5 x 5 grid, mirrored around the middle column, with values 0-2', () => {
    const rows = glyphCells(B);
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row).toHaveLength(5);
      expect(row[0]).toBe(row[4]);
      expect(row[1]).toBe(row[3]);
      row.forEach((v) => expect([0, 1, 2]).toContain(v));
    }
    expect(rows[2][2]).toBe(2);
  });
});

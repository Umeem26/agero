// Address glyph: a 5 x 5 pattern mirrored around the middle column, derived only from the owner
// address (FNV-1a hash, then xorshift for more bits). Same address -> same glyph, on every device.
// Cell values: 0 empty, 1 brand teal, 2 light teal.
export function glyphCells(address) {
  let h = 0x811c9dc5;
  for (const ch of String(address)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  if (h === 0) h = 1;
  const next = () => {
    h ^= h << 13; h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5; h >>>= 0;
    return h;
  };
  const rows = [];
  for (let r = 0; r < 5; r++) {
    const half = [next() % 3, next() % 3, next() % 3];
    rows.push([half[0], half[1], half[2], half[1], half[0]]);
  }
  rows[2][2] = 2; // never blank: the centre cell is always set
  return rows;
}

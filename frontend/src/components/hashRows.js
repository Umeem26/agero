// 64 hex characters -> 4 rows of 16, each split into groups of 4, so two hashes can be compared
// row by row at a glance. Anything else (still computing, malformed) is shown as plain text.
export function hashRows(hash) {
  if (!/^[0-9a-f]{64}$/i.test(hash ?? '')) return null;
  const rows = [];
  for (let r = 0; r < 4; r++) {
    const row = hash.slice(r * 16, r * 16 + 16).toLowerCase();
    rows.push([0, 4, 8, 12].map((i) => row.slice(i, i + 4)));
  }
  return rows;
}

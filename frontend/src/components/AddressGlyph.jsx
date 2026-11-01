import { shortAddress } from '../agents';
import { glyphCells } from './glyph';

// Small symmetric pattern derived from the owner address, so the same owner is recognisable
// across cards, the detail page and the dashboard. Palette colours only.
export default function AddressGlyph({ address, size = 40 }) {
  const rows = glyphCells(address);
  return (
    <svg className="glyph" width={size} height={size} viewBox="0 0 28 28" role="img" aria-label={`Address glyph for ${shortAddress(address)}`}>
      <title>Pattern derived from the owner address {shortAddress(address)}</title>
      <rect className="glyph-bg" x="0.5" y="0.5" width="27" height="27" rx="5.5" />
      {rows.flatMap((row, r) => row.map((v, c) => (v ? <rect key={`${r}-${c}`} className={v === 2 ? 'glyph-hi' : 'glyph-lo'} x={4 + c * 4} y={4 + r * 4} width="4" height="4" /> : null)))}
    </svg>
  );
}

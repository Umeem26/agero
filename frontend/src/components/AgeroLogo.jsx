// Agero mark: a value (filled square) held inside the escrow (outline). Same drawing as public/favicon.svg.
export default function AgeroLogo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="4" stroke="var(--accent-text)" strokeWidth="1.5" />
      <rect x="8" y="8" width="8" height="8" rx="1.5" fill="var(--brand)" />
      <path d="M8 19h8" stroke="var(--accent-text)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

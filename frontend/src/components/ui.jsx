import { Star, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';

export function Stars({ average, count, size = 13 }) {
  const r = Math.round(average);
  return (
    <div className="star-row" title="On-chain rating: average of 1-5 star ratings from clients of completed jobs">
      {[...Array(5)].map((_, i) => (
        <Star key={i} size={size} className={i < r ? 'star-filled' : 'star-empty'} style={{ fill: i < r ? '#fcd34d' : 'none' }} />
      ))}
      <span style={{ fontSize: '12px', color: 'var(--text-dim)', marginLeft: '5px' }}>
        {count > 0 ? average.toFixed(1) : '—'}
      </span>
      <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '2px' }}>({count})</span>
    </div>
  );
}

export function SampleBadge({ style }) {
  return (
    <span className="sample-badge" title="Sample agent registered by the project's seed script; its endpoint is a placeholder" style={style}>Sample</span>
  );
}

export function ExplorerLink({ href, children }) {
  return (
    <a className="explorer-link" href={href} target="_blank" rel="noreferrer">
      {children} <ExternalLink size={12} />
    </a>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card empty-state" role="alert">
      <div className="empty-icon"><AlertCircle size={24} /></div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>Could not read from Stellar Testnet</p>
      <p style={{ color: 'var(--text-dim)', marginBottom: '16px', fontSize: '13px' }}>{message}</p>
      {onRetry && <button className="btn btn-outline" onClick={onRetry}><RefreshCw size={14} /> Try again</button>}
    </div>
  );
}

export function SkeletonCards({ count = 3 }) {
  return (
    <div className="agent-grid" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card skeleton-card">
          <div className="skeleton" style={{ height: '18px', width: '60%' }} />
          <div className="skeleton" style={{ height: '12px', width: '90%' }} />
          <div className="skeleton" style={{ height: '12px', width: '75%' }} />
          <div className="skeleton" style={{ height: '16px', width: '35%', marginTop: '12px' }} />
        </div>
      ))}
    </div>
  );
}

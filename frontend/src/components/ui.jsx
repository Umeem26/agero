import { Star, AlertCircle, RefreshCw, ExternalLink, Shield } from 'lucide-react';

export function Stars({ average, count, size = 14 }) {
  const r = Math.round(average);
  if (count === 0) {
    return <span className="star-row star-none" title="Rating stored in the contract: no client has rated this agent yet">No ratings yet</span>;
  }
  return (
    <span className="star-row" title="Rating stored in the contract: average of 1-5 star ratings from clients of completed jobs">
      {[...Array(5)].map((_, i) => <Star key={i} size={size} aria-hidden="true" className={i < r ? 'star-filled' : 'star-empty'} />)}
      <span className="star-value">{average.toFixed(1)}</span>
      <span className="star-count">({count})</span>
    </span>
  );
}

export function SampleBadge() {
  return <span className="sample-badge" title="Sample agent registered by the project's seed script; its endpoint is a placeholder">Sample</span>;
}

// Marks values read from the Agero contract, as opposed to metadata kept only in this frontend
export function ContractMark() {
  return <span className="src-chain" title="Read from the Agero contract on Stellar Testnet">on contract</span>;
}

// One source marker for a whole agent list, so the cards themselves only flag UI-only fields
export function ListSourceNote() {
  return (
    <p className="list-source">
      <span className="src-chain">All listed values are read from the contract</span>, except fields marked <span className="src-ui-flag">UI-only</span>.
    </p>
  );
}

// The category exists only in this frontend; the contract does not store it
export function CategoryChip({ category }) {
  return (
    <span className="src-ui" title="Category is set in this frontend; the contract does not store it">
      {category}<span className="src-ui-flag"> UI-only</span>
    </span>
  );
}

export function ExplorerLink({ href, children }) {
  return (
    <a className="explorer-link" href={href} target="_blank" rel="noreferrer">
      {children} <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}

export function EmptyState({ icon: Icon, title, children, action, role }) {
  return (
    <div className="card empty-state" role={role}>
      {Icon && <div className="empty-icon"><Icon size={24} aria-hidden="true" /></div>}
      {title && <p className="empty-title">{title}</p>}
      {children && <p className="empty-text">{children}</p>}
      {action}
    </div>
  );
}

export function ConnectPrompt({ children, onConnect }) {
  return (
    <EmptyState icon={Shield} action={<button className="btn btn-primary" onClick={onConnect}>Connect Freighter</button>}>
      {children}
    </EmptyState>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <EmptyState
      icon={AlertCircle}
      role="alert"
      title="Could not read from Stellar Testnet"
      action={onRetry && <button className="btn btn-outline" onClick={onRetry}><RefreshCw size={14} aria-hidden="true" /> Try again</button>}
    >
      {message}
    </EmptyState>
  );
}

export function StatCard({ label, value, unit, mark }) {
  return (
    <div className="card stat-card">
      <div className="stat-label">{label}{mark}</div>
      <div className="stat-val">{value}{unit && <span className="stat-unit"> {unit}</span>}</div>
    </div>
  );
}

// [[label, value], ...] as a definition list
export function KeyValueList({ items, className = '' }) {
  return (
    <dl className={`kv ${className}`}>
      {items.filter(Boolean).map(([label, value]) => (
        <div key={label} className="kv-row"><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
}

export function SkeletonCards({ count = 3 }) {
  return (
    <div className="agent-grid" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card skeleton-card">
          <div className="skeleton" /><div className="skeleton" /><div className="skeleton" /><div className="skeleton" />
        </div>
      ))}
    </div>
  );
}

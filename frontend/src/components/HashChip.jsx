import { useEffect, useState } from 'react';
import { Check, Copy, Lock } from 'lucide-react';
import { hashRows } from './hashRows';

export default function HashChip({ hash, label = 'SHA-256', sealed = false }) {
  const [copied, setCopied] = useState('');
  const rows = hashRows(hash);

  useEffect(() => {
    if (!copied) return undefined;
    const id = setTimeout(() => setCopied(''), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied('Copied');
    } catch {
      setCopied('Copy failed');
    }
  };

  return (
    <div className={`hash-chip ${sealed ? 'is-sealed' : ''}`}>
      <div className="hash-chip-head">
        <span className="hash-chip-label">{sealed && <Lock size={12} aria-label="Recorded in the contract" />}{label}</span>
        <button type="button" className="hash-copy" onClick={copy} aria-label={`Copy ${label}`}>
          {copied === 'Copied' ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          <span aria-live="polite">{copied || 'Copy'}</span>
        </button>
      </div>
      {rows ? (
        <code className="hash-grid" aria-label={hash}>
          {rows.map((groups, r) => (
            <span key={r} className="hash-row" aria-hidden="true">
              {groups.map((g, i) => <span key={i}>{g}</span>)}
            </span>
          ))}
        </code>
      ) : (
        <code className="hash-plain">{hash}</code>
      )}
    </div>
  );
}

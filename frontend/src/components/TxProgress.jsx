import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { explorerTxUrl } from '../chain/config';
import { ExplorerLink } from './ui';

const STEPS = [
  { id: 'simulate', label: 'Simulating the call on Testnet' },
  { id: 'sign', label: 'Waiting for your signature in Freighter' },
  { id: 'submit', label: 'Submitting the transaction' },
  { id: 'confirm', label: 'Waiting for the ledger to confirm' },
];

// Progress of a real contract call: { title, step, hash, error, done, successText, action }
export default function TxProgress({ tx, onClose }) {
  const busy = !tx.done && !tx.error;
  const current = STEPS.findIndex((s) => s.id === tx.step);

  return (
    <div className="drawer-bg" onClick={() => { if (!busy) onClose(); }}>
      <div className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={tx.title}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <span className="drawer-title">{tx.title}</span>
            {!busy && <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>}
          </div>

          {busy && (
            <ol className="tx-steps">
              {STEPS.map((s, i) => (
                <li key={s.id} className={i < current ? 'tx-step done' : i === current ? 'tx-step active' : 'tx-step'}>
                  {i === current ? <span className="spinner tx-step-spinner" /> : <span className="tx-step-dot" />}
                  {s.label}
                </li>
              ))}
            </ol>
          )}

          {tx.done && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <CheckCircle size={44} style={{ color: 'var(--green)', marginBottom: '12px' }} />
              <p style={{ fontWeight: 600, marginBottom: '6px' }}>Confirmed on Stellar Testnet</p>
              {tx.successText && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{tx.successText}</p>}
            </div>
          )}

          {tx.error && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <AlertCircle size={44} style={{ color: 'var(--red)', marginBottom: '12px' }} />
              <p style={{ fontWeight: 600, marginBottom: '6px' }}>Not completed</p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{tx.error}</p>
            </div>
          )}

          {tx.hash && (
            <div className="drawer-info">
              <div className="drawer-row">
                <span className="drawer-row-label">Transaction</span>
                <span className="drawer-row-val"><ExplorerLink href={explorerTxUrl(tx.hash)}>{tx.hash.slice(0, 10)}…</ExplorerLink></span>
              </div>
            </div>
          )}
        </div>

        {!busy && (
          <div style={{ display: 'flex', gap: '10px' }}>
            {tx.done && tx.action && <button className="btn btn-primary" style={{ flex: 1 }} onClick={tx.action.onClick}>{tx.action.label}</button>}
            <button className="btn btn-outline" style={{ flex: tx.done && tx.action ? 0 : 1 }} onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

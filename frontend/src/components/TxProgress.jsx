import { useId, useRef } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { explorerTxUrl } from '../chain/config';
import { ExplorerLink, KeyValueList } from './ui';
import { useDialog } from './Modal';

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
  const panelRef = useRef(null);
  const titleId = useId();
  // Cannot be closed (Escape, overlay, button) while the transaction is in flight
  useDialog(panelRef, { onClose, canClose: !busy });

  return (
    <div className="drawer-bg" onClick={() => { if (!busy) onClose(); }}>
      <div ref={panelRef} className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy} tabIndex={-1}>
        <div>
          <div className="modal-head">
            <h2 id={titleId} className="drawer-title">{tx.title}</h2>
            {!busy && <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} aria-hidden="true" /></button>}
          </div>

          {busy && (
            <ol className="tx-steps">
              {STEPS.map((s, i) => (
                <li key={s.id} className={i < current ? 'tx-step done' : i === current ? 'tx-step active' : 'tx-step'}>
                  {i === current ? <span className="spinner" aria-hidden="true" /> : <span className="tx-step-dot" aria-hidden="true" />}
                  {s.label}
                </li>
              ))}
            </ol>
          )}

          {tx.done && (
            <div className="tx-result ok">
              <CheckCircle size={40} aria-hidden="true" />
              <p className="tx-result-title">Confirmed on Stellar Testnet</p>
              {tx.successText && <p className="tx-result-text">{tx.successText}</p>}
            </div>
          )}

          {tx.error && (
            <div className="tx-result bad">
              <AlertCircle size={40} aria-hidden="true" />
              <p className="tx-result-title">Not completed</p>
              <p className="tx-result-text">{tx.error}</p>
            </div>
          )}

          {tx.hash && (
            <KeyValueList items={[['Transaction', <ExplorerLink key="tx" href={explorerTxUrl(tx.hash)}>{tx.hash.slice(0, 10)}…</ExplorerLink>]]} />
          )}
        </div>

        {!busy && (
          <div className="btn-row">
            {tx.done && tx.action && <button className="btn btn-primary btn-grow" onClick={tx.action.onClick}>{tx.action.label}</button>}
            <button className={`btn btn-outline ${tx.done && tx.action ? '' : 'btn-grow'}`} onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

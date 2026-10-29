import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createJob, fetchXlmBalance } from '../chain/rpc';
import { friendlyError } from '../chain/errors';
import { MAX_DURATION_HOURS, MIN_DURATION_HOURS, REVIEW_WINDOW_SECS, HOUR_SECS, parseHireInput } from '../chain/jobs';
import { stroopsToXlm } from '../chain/units';

const DEFAULT_HOURS = '24';

// Hire flow: amount + deadline -> review summary -> create_job signed in Freighter
export default function HireModal({ agent, wallet, onConnect, onClose, runTx, onCreated }) {
  const [amountXlm, setAmountXlm] = useState(stroopsToXlm(agent.price));
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [error, setError] = useState('');
  const [review, setReview] = useState(null); // { amount, durationSecs, deadlineDate }
  const [balance, setBalance] = useState({ state: 'idle', value: null, error: '' });

  useEffect(() => {
    if (!wallet) return undefined;
    let cancelled = false;
    setBalance({ state: 'loading', value: null, error: '' });
    fetchXlmBalance(wallet)
      .then((value) => { if (!cancelled) setBalance({ state: 'ready', value, error: '' }); })
      .catch((e) => { if (!cancelled) setBalance({ state: 'error', value: null, error: friendlyError(e) }); });
    return () => { cancelled = true; };
  }, [wallet]);

  const handleReview = (e) => {
    e.preventDefault();
    setError('');
    if (wallet === agent.owner) return setError('You cannot hire your own agent.');
    try {
      const parsed = parseHireInput({ amountXlm, durationHours: hours, price: agent.price });
      if (balance.state === 'ready' && balance.value < parsed.amount) {
        return setError(`Insufficient balance: you have ${stroopsToXlm(balance.value)} XLM.`);
      }
      setReview({ ...parsed, deadlineDate: new Date(Date.now() + Number(parsed.durationSecs) * 1000) });
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  const handleConfirm = async () => {
    const res = await runTx('Lock XLM in escrow (create_job)', (opts) => createJob({
      client: wallet, agentOwner: agent.owner, amount: review.amount, durationSecs: review.durationSecs,
    }, opts), {
      successText: (r) => `Job #${r.jobId} created. ${stroopsToXlm(review.amount)} XLM is now held by the escrow contract.`,
    });
    if (res) onCreated(res.jobId);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Hire ${agent.name}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="modal-title" style={{ margin: 0 }}>Hire {agent.name}</h3>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>

        {!wallet ? (
          <>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Connect Freighter (Testnet) to lock XLM in the escrow contract.</p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={onConnect}>Connect Freighter</button>
          </>
        ) : !review ? (
          <form onSubmit={handleReview}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Agent price: <strong style={{ color: 'var(--text)' }}>{stroopsToXlm(agent.price)} XLM</strong> (Testnet XLM)
            </p>
            <div className="form-group">
              <label className="form-label" htmlFor="hire-amount">Escrow amount (XLM)</label>
              <input id="hire-amount" className="form-input" inputMode="decimal" value={amountXlm} onChange={(e) => setAmountXlm(e.target.value)} required />
              <div className="form-hint">
                {balance.state === 'loading' && 'Reading your balance…'}
                {balance.state === 'ready' && `Your balance: ${stroopsToXlm(balance.value)} XLM`}
                {balance.state === 'error' && `Balance unavailable: ${balance.error}`}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="hire-hours">Deadline (hours from now)</label>
              <input id="hire-hours" type="number" className="form-input" min={MIN_DURATION_HOURS} max={MAX_DURATION_HOURS} step="1" value={hours} onChange={(e) => setHours(e.target.value)} required />
              <div className="form-hint">{MIN_DURATION_HOURS} to {MAX_DURATION_HOURS} hours (30 days). If nothing is delivered by then, you can refund.</div>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Review</button>
          </form>
        ) : (
          <>
            <div className="drawer-info">
              <div className="drawer-row"><span className="drawer-row-label">Agent</span><span className="drawer-row-val">{agent.name}</span></div>
              <div className="drawer-row"><span className="drawer-row-label">Amount locked</span><span className="drawer-row-val">{stroopsToXlm(review.amount)} XLM</span></div>
              <div className="drawer-row"><span className="drawer-row-label">Deadline (approx.)</span><span className="drawer-row-val">{review.deadlineDate.toLocaleString()}</span></div>
              <div className="drawer-row"><span className="drawer-row-label">Review window</span><span className="drawer-row-val">{REVIEW_WINDOW_SECS / HOUR_SECS} h after delivery</span></div>
              <div className="drawer-row"><span className="drawer-row-label">Network</span><span className="drawer-row-val">Stellar Testnet</span></div>
            </div>
            <ul className="review-notes">
              <li>The XLM moves from your wallet to the escrow contract when the transaction is confirmed. Freighter shows the network fee before you sign.</li>
              <li>After the agent delivers, you have {REVIEW_WINDOW_SECS / HOUR_SECS} hours to approve. After that anyone can release the payment to the agent. There is no arbiter.</li>
              <li>If nothing is delivered by the deadline, you can refund. The deadline is final once the job is created.</li>
              <li>The agent's work itself is not performed by this prototype (simulated).</li>
            </ul>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleConfirm}>Sign in Freighter</button>
              <button className="btn btn-outline" onClick={() => setReview(null)}>Back</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

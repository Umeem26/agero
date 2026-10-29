import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Clock, Info, RefreshCw, Shield, X, Zap } from 'lucide-react';
import { MAX_JOB_SCAN, deliverJob, fetchAgent, fetchAgentJobs, refundJob, releaseJob } from '../chain/rpc';
import { friendlyError } from '../chain/errors';
import { HOUR_SECS, JobStatus, REVIEW_WINDOW_SECS, agentActions, agentEarnings, formatDuration, reviewEndsAt } from '../chain/jobs';
import { profileActions } from '../chain/profile';
import { stroopsToXlm } from '../chain/units';
import { CONFIG, explorerAccountUrl, explorerContractUrl } from '../chain/config';
import { shortAddress } from '../agents';
import { ErrorState, ExplorerLink } from './ui';
import { HashSource, JobListSkeleton, JobProgress, StatusBadge } from './jobUi';
import { toDate, useLedgerNow } from './ledgerTime';
import AgentProfileForm from './AgentProfileForm';

const REVIEW_HOURS = REVIEW_WINDOW_SECS / HOUR_SECS;

function OffAppNotice() {
  return (
    <div className="card notice-card">
      <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
      <span>
        <strong>Agero does not run your agent.</strong> You do the work outside this app and send the result to the client through your own channel.
        The contract records only a SHA-256 hash of the result when you deliver, plus the escrow payment. Nothing else about the work is checked.
      </span>
    </div>
  );
}

// Agent-side view of the deadline and review window
function AgentTimeInfo({ job, now }) {
  if (now == null) return null;
  if (job.status === JobStatus.PENDING) {
    return now <= job.deadline
      ? <span>Deadline in {formatDuration(job.deadline - now)} ({toDate(job.deadline)}). After it passes the client can refund.</span>
      : <span>Deadline passed {formatDuration(now - job.deadline)} ago. You can still deliver until the client refunds; whichever transaction lands first wins.</span>;
  }
  if (job.status === JobStatus.DELIVERED) {
    const end = reviewEndsAt(job);
    return now < end
      ? <span>Delivered. Client review window: {formatDuration(end - now)} left ({toDate(end)}). After that anyone, including you, can release the payment.</span>
      : <span>Review window ended. You can release the payment to your wallet now.</span>;
  }
  if (job.status === JobStatus.COMPLETED) return <span>Paid to your wallet.</span>;
  return <span>Refunded to the client.</span>;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="modal-title" style={{ margin: 0 }}>{title}</h3>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Pick file / text / hash -> SHA-256 shown -> owner confirms -> deliver_job
function DeliverModal({ job, now, onSubmit, onClose }) {
  const [hash, setHash] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const onHash = (h) => { setHash(h); setConfirmed(false); };
  const late = now != null && now > job.deadline;
  return (
    <Modal title={`Deliver job #${job.id}`} onClose={onClose}>
      <div className="notice-card notice-inline">
        <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>The result itself is not stored in Agero or on the blockchain; only its hash is. Send the result to the client through your own channel.</span>
      </div>
      {late && <p className="form-hint" style={{ marginBottom: '12px' }}>The deadline has passed. Delivery is still accepted unless the client refunds first.</p>}
      <HashSource sources={['file', 'text', 'hash']} idPrefix={`deliver-${job.id}`} onHash={onHash} />
      <label className="check-row">
        <input type="checkbox" checked={confirmed} disabled={!hash} onChange={(e) => setConfirmed(e.target.checked)} />
        <span>This hash matches the exact file or text I am sending to the client. Delivering cannot be undone; the client then has {REVIEW_HOURS} h to approve.</span>
      </label>
      <button className="btn btn-primary" style={{ width: '100%' }} disabled={!hash || !confirmed} onClick={() => onSubmit(hash)}>Sign deliver_job in Freighter</button>
    </Modal>
  );
}

function RefundConfirm({ job, onConfirm, onClose }) {
  return (
    <Modal title={`Refund job #${job.id}?`} onClose={onClose}>
      <ul className="review-notes">
        <li><strong>{stroopsToXlm(job.amount)} XLM</strong> goes back from the escrow contract to the client <ExplorerLink href={explorerAccountUrl(job.client)}>{shortAddress(job.client)}</ExplorerLink>.</li>
        <li>This cannot be undone. The job ends as Refunded and you will not be paid for it{job.status === JobStatus.DELIVERED ? ', even though you already delivered' : ''}.</li>
        <li>You pay the network fee for this transaction.</li>
      </ul>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button className="btn btn-red" style={{ flex: 1 }} onClick={onConfirm}>Refund in Freighter</button>
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

export default function AgentDashboard({ wallet, runTx, onConnect, onChanged, onBrowse }) {
  const [state, setState] = useState({ status: 'idle', agent: null, jobs: [], total: 0n, scanned: 0, error: '', base: null });
  const [editing, setEditing] = useState(false);
  const [deliverFor, setDeliverFor] = useState(null);
  const [refundFor, setRefundFor] = useState(null);
  const now = useLedgerNow(state.base);

  const load = useCallback(async () => {
    if (!wallet) return;
    setState((s) => ({ ...s, status: 'loading', error: '' }));
    try {
      const agent = await fetchAgent(wallet);
      // create_job requires a registered agent, so without one there are no incoming jobs to scan
      const scan = agent ? await fetchAgentJobs(wallet) : null;
      setState({
        status: 'ready', agent, jobs: scan?.jobs ?? [], total: scan?.total ?? 0n, scanned: scan?.scanned ?? 0, error: '',
        base: scan ? { ledgerTime: scan.ledgerTime, readAt: Date.now() } : null,
      });
    } catch (e) {
      setState((s) => ({ ...s, status: 'error', error: friendlyError(e) }));
    }
  }, [wallet]);

  useEffect(() => { setEditing(false); load(); }, [load]);

  const act = async (title, call, successText) => {
    const res = await runTx(title, call, { successText: () => successText });
    if (res) { load(); onChanged(); }
  };

  const handleDeliver = (hash) => {
    const job = deliverFor;
    setDeliverFor(null);
    act('Deliver result hash (deliver_job)', (opts) => deliverJob({ agent: wallet, jobId: job.id, resultHash: hash }, opts),
      `Job #${job.id} delivered. The client now has ${REVIEW_HOURS} h to approve; remember to send them the result.`);
  };

  const handleRefund = () => {
    const job = refundFor;
    setRefundFor(null);
    act('Refund client (refund_job)', (opts) => refundJob({ caller: wallet, jobId: job.id }, opts),
      `Job #${job.id} refunded: ${stroopsToXlm(job.amount)} XLM returned to the client.`);
  };

  const handleRelease = (job) =>
    act('Release payment (release_job)', (opts) => releaseJob({ caller: wallet, jobId: job.id }, opts),
      `Job #${job.id} released: ${stroopsToXlm(job.amount)} XLM paid to your wallet.`);

  if (!wallet) {
    return (
      <>
        <OffAppNotice />
        <div className="card empty-state">
          <div className="empty-icon"><Shield size={24} /></div>
          <p style={{ color: 'var(--text-dim)', marginBottom: '16px' }}>Connect Freighter (Testnet) with the wallet that owns, or will own, your agent.</p>
          <button className="btn btn-primary" onClick={onConnect}>Connect Freighter</button>
        </div>
      </>
    );
  }

  if (state.status === 'error') return <><OffAppNotice /><ErrorState message={state.error} onRetry={load} /></>;
  if (state.status !== 'ready' && !state.agent) {
    return <><OffAppNotice /><div className="card" style={{ padding: '24px' }}><div className="skeleton" style={{ height: '18px', width: '40%', marginBottom: '12px' }} /><div className="skeleton" style={{ height: '12px', width: '70%' }} /></div></>;
  }

  const { agent } = state;
  const can = profileActions(agent, wallet);
  const earnings = agentEarnings(state.jobs);
  const scanNote = `${state.scanned} of ${String(state.total)} jobs scanned${state.total > BigInt(MAX_JOB_SCAN) ? ` (newest ${MAX_JOB_SCAN} only)` : ''}`;

  return (
    <>
      <OffAppNotice />

      <div className="card dev-form-card" style={{ marginBottom: '24px' }}>
        <h3 className="card-heading"><Zap size={18} style={{ color: 'var(--accent)' }} /> {can.register ? 'Register your agent' : 'Your agent'}</h3>
        {can.register && (
          <>
            <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '18px' }}>No agent is registered for {shortAddress(wallet)} on contract <ExplorerLink href={explorerContractUrl()}>{shortAddress(CONFIG.contractId)}</ExplorerLink>. Registering lists it in the marketplace.</p>
            <AgentProfileForm mode="register" wallet={wallet} runTx={runTx} onSaved={() => { load(); onChanged(); }} onAlreadyRegistered={load} />
          </>
        )}
        {can.update && !editing && (
          <>
            <div className="drawer-info">
              <div className="drawer-row"><span className="drawer-row-label">Name</span><span className="drawer-row-val">{agent.name}</span></div>
              <div className="drawer-row"><span className="drawer-row-label">Price</span><span className="drawer-row-val">{stroopsToXlm(agent.price)} XLM</span></div>
              <div className="drawer-row"><span className="drawer-row-label">Completed jobs</span><span className="drawer-row-val">{agent.totalJobs}</span></div>
              <div className="drawer-row"><span className="drawer-row-label">Rating</span><span className="drawer-row-val">{agent.ratingCount > 0 ? `${(Number(agent.ratingSum) / agent.ratingCount).toFixed(1)} (${agent.ratingCount})` : 'none yet'}</span></div>
            </div>
            {agent.description && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>{agent.description}</p>}
            <div className="field-caption">API URL (label only, never called by Agero)</div>
            <div className="mono-box" style={{ marginBottom: '18px' }}>{agent.apiUrl || '(none)'}</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={() => setEditing(true)}>Edit profile</button>
              <button className="btn btn-outline" onClick={onBrowse}>View in marketplace</button>
            </div>
          </>
        )}
        {can.update && editing && (
          <AgentProfileForm mode="update" wallet={wallet} agent={agent} runTx={runTx} onSaved={() => { setEditing(false); load(); onChanged(); }} onCancel={() => setEditing(false)} />
        )}
      </div>

      {agent && (
        <>
          <div className="stat-row">
            <div className="card stat-card green-stat">
              <div className="stat-label">Paid to you</div>
              <div className="stat-val" style={{ color: 'var(--green)' }}>{stroopsToXlm(earnings.paid)} <span className="stat-unit">XLM</span></div>
            </div>
            <div className="card stat-card blue">
              <div className="stat-label">Delivered, awaiting payment</div>
              <div className="stat-val">{stroopsToXlm(earnings.awaitingRelease)} <span className="stat-unit">XLM</span></div>
            </div>
            <div className="card stat-card rose">
              <div className="stat-label">Pending, not delivered</div>
              <div className="stat-val" style={{ color: 'var(--rose)' }}>{stroopsToXlm(earnings.pending)} <span className="stat-unit">XLM</span></div>
            </div>
          </div>
          <p className="form-hint" style={{ margin: '-8px 0 20px' }}>Totals are sums of job amounts found by scanning the contract ({scanNote}): Completed jobs (approved or released), Delivered and Pending. Network fees are not included.</p>

          <div className="list-toolbar">
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Incoming jobs</span>
            <button className="btn btn-outline" onClick={load} disabled={state.status === 'loading'}><RefreshCw size={14} /> Refresh</button>
          </div>

          {state.status === 'loading' && state.jobs.length === 0 && <JobListSkeleton />}
          {state.status === 'ready' && state.jobs.length === 0 && (
            <div className="card empty-state">
              <div className="empty-icon"><Clock size={24} /></div>
              <p style={{ color: 'var(--text-dim)' }}>No jobs for your agent in the newest {state.scanned} jobs on the contract.</p>
            </div>
          )}

          {state.jobs.length > 0 && (
            <div className="escrow-list">
              {state.jobs.map((job) => {
                const actions = agentActions(job, wallet, now ?? 0n);
                return (
                  <div key={String(job.id)} className="card escrow-card">
                    <JobProgress status={job.status} />
                    <div className="escrow-body">
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                          <span className="escrow-title">Job #{String(job.id)}</span>
                          <StatusBadge status={job.status} />
                        </div>
                        <div className="escrow-meta">
                          <span>Client: <ExplorerLink href={explorerAccountUrl(job.client)}>{shortAddress(job.client)}</ExplorerLink></span>
                          <span>{stroopsToXlm(job.amount)} XLM</span>
                          <span>Created {toDate(job.createdAt)}</span>
                        </div>
                        <div className="escrow-time"><AgentTimeInfo job={job} now={now} /></div>
                        {job.resultHash && <div className="escrow-hash">Result hash (SHA-256): <code>{job.resultHash}</code></div>}
                      </div>
                      <div className="escrow-actions">
                        {actions.deliver && <button className="btn btn-primary" onClick={() => setDeliverFor(job)}>Deliver</button>}
                        {actions.release && <button className="btn btn-green" onClick={() => handleRelease(job)}>Release payment</button>}
                        {actions.refund && <button className="btn btn-red" onClick={() => setRefundFor(job)}>Refund client</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {deliverFor && <DeliverModal job={deliverFor} now={now} onSubmit={handleDeliver} onClose={() => setDeliverFor(null)} />}
      {refundFor && <RefundConfirm job={refundFor} onConfirm={handleRefund} onClose={() => setRefundFor(null)} />}
    </>
  );
}

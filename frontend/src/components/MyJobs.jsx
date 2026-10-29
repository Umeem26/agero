import { useCallback, useEffect, useState } from 'react';
import { Clock, FileCheck, RefreshCw, Shield, Star, X } from 'lucide-react';
import { MAX_JOB_SCAN, completeJob, fetchClientJobs, rateAgent, refundJob } from '../chain/rpc';
import { friendlyError } from '../chain/errors';
import { JobStatus, clientActions, formatDuration, reviewEndsAt } from '../chain/jobs';
import { hashesMatch } from '../chain/hash';
import { stroopsToXlm } from '../chain/units';
import { CONFIG, explorerAccountUrl, explorerContractUrl } from '../chain/config';
import { shortAddress } from '../agents';
import { ErrorState, ExplorerLink } from './ui';
import { HashMatch, HashSource, JobListSkeleton, JobProgress, StatusBadge } from './jobUi';
import { toDate, useLedgerNow } from './ledgerTime';

function TimeInfo({ job, now }) {
  if (now == null) return null;
  if (job.status === JobStatus.PENDING) {
    return now <= job.deadline
      ? <span>Deadline in {formatDuration(job.deadline - now)} ({toDate(job.deadline)}). The agent can still deliver until then.</span>
      : <span>Deadline passed {formatDuration(now - job.deadline)} ago with no delivery. You can refund; the agent can still deliver until you do.</span>;
  }
  if (job.status === JobStatus.DELIVERED) {
    const end = reviewEndsAt(job);
    return now < end
      ? <span>Delivered. Review window: {formatDuration(end - now)} left to approve. After that anyone can release the payment to the agent.</span>
      : <span>Review window ended. Anyone can now release the payment to the agent; you can still approve it yourself.</span>;
  }
  if (job.status === JobStatus.COMPLETED) return <span>Paid to the agent. {job.rated ? 'You rated this job.' : 'Not rated yet.'}</span>;
  return <span>Refunded to your wallet.</span>;
}

function RatingModal({ job, agentName, onSubmit, onClose }) {
  const [stars, setStars] = useState(5);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal rating-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Rate agent">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="modal-title" style={{ margin: 0 }}>Rate {agentName}</h3>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Job #{String(job.id)}. The contract stores one 1–5 star rating per completed job; there are no text reviews.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} className="icon-btn" aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setStars(n)}>
              <Star size={28} style={{ fill: n <= stars ? '#fcd34d' : 'none', stroke: n <= stars ? '#fcd34d' : 'var(--text-dim)' }} />
            </button>
          ))}
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onSubmit(stars)}>Sign rating in Freighter</button>
      </div>
    </div>
  );
}

// Client checks a file/text from the agent against the result_hash stored in the job. Local only.
function VerifyModal({ job, agentName, onClose }) {
  const [hash, setHash] = useState(null);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Verify delivered file">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="modal-title" style={{ margin: 0 }}>Verify delivered file</h3>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
          Job #{String(job.id)} · {agentName}. Pick the file (or paste the text) the agent sent you. Its SHA-256 is computed in this browser and compared with the hash the agent recorded in the contract. Nothing is uploaded.
        </p>
        <div className="field-caption">Hash recorded by the agent</div>
        <div className="mono-box" style={{ marginBottom: '16px' }}>{job.resultHash}</div>
        <HashSource idPrefix={`verify-${job.id}`} onHash={setHash} />
        {hash && <HashMatch ok={hashesMatch(hash, job.resultHash)} />}
        <p className="form-hint" style={{ marginTop: '14px' }}>A match proves only that you received the content the agent committed to. It says nothing about its quality; Agero does not review the work.</p>
      </div>
    </div>
  );
}

export default function MyJobs({ wallet, agentsByOwner, runTx, onConnect, onChanged, onOpenPlayground, onBrowse }) {
  const [state, setState] = useState({ status: 'idle', jobs: [], total: 0n, scanned: 0, error: '', base: null });
  const [ratingJob, setRatingJob] = useState(null);
  const [verifyJob, setVerifyJob] = useState(null);
  const now = useLedgerNow(state.base);

  const load = useCallback(async () => {
    if (!wallet) return;
    setState((s) => ({ ...s, status: 'loading', error: '' }));
    try {
      const res = await fetchClientJobs(wallet);
      setState({ status: 'ready', jobs: res.jobs, total: res.total, scanned: res.scanned, error: '', base: { ledgerTime: res.ledgerTime, readAt: Date.now() } });
    } catch (e) {
      setState((s) => ({ ...s, status: 'error', error: friendlyError(e) }));
    }
  }, [wallet]);

  useEffect(() => { load(); }, [load]);

  const agentName = (owner) => agentsByOwner.get(owner)?.name || shortAddress(owner);

  const act = async (title, call, successText) => {
    const res = await runTx(title, call, { successText: () => successText });
    if (res) { load(); onChanged(); }
  };

  const handleRate = async (stars) => {
    const job = ratingJob;
    setRatingJob(null);
    await act('Rate agent (rate_agent)', (opts) => rateAgent({ client: wallet, jobId: job.id, rating: stars }, opts), `Rated ${stars}/5 for job #${job.id}.`);
  };

  if (!wallet) {
    return (
      <div className="card empty-state">
        <div className="empty-icon"><Shield size={24} /></div>
        <p style={{ color: 'var(--text-dim)', marginBottom: '16px' }}>Connect Freighter to see the escrow jobs you created on Testnet.</p>
        <button className="btn btn-primary" onClick={onConnect}>Connect Freighter</button>
      </div>
    );
  }

  const locked = state.jobs.filter((j) => j.status === JobStatus.PENDING || j.status === JobStatus.DELIVERED).reduce((s, j) => s + j.amount, 0n);

  return (
    <>
      <div className="stat-row">
        <div className="card stat-card blue">
          <div className="stat-label">Your jobs</div>
          <div className="stat-val">{state.status === 'ready' ? state.jobs.length : '—'}</div>
        </div>
        <div className="card stat-card rose">
          <div className="stat-label">Held in escrow</div>
          <div className="stat-val" style={{ color: 'var(--rose)' }}>{state.status === 'ready' ? stroopsToXlm(locked) : '—'} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-dim)' }}>XLM</span></div>
        </div>
        <div className="card stat-card green-stat">
          <div className="stat-label">Completed</div>
          <div className="stat-val" style={{ color: 'var(--green)' }}>{state.status === 'ready' ? state.jobs.filter((j) => j.status === JobStatus.COMPLETED).length : '—'}</div>
        </div>
      </div>

      <div className="list-toolbar">
        <span>
          Read from contract <ExplorerLink href={explorerContractUrl()}>{shortAddress(CONFIG.contractId)}</ExplorerLink>
          {state.status === 'ready' && ` · scanned ${state.scanned} of ${state.total} jobs${state.total > BigInt(MAX_JOB_SCAN) ? ` (newest ${MAX_JOB_SCAN} only)` : ''}`}
        </span>
        <button className="btn btn-outline" onClick={load} disabled={state.status === 'loading'}><RefreshCw size={14} /> Refresh</button>
      </div>

      {state.status === 'loading' && state.jobs.length === 0 && <JobListSkeleton />}
      {state.status === 'error' && <ErrorState message={state.error} onRetry={load} />}
      {state.status === 'ready' && state.jobs.length === 0 && (
        <div className="card empty-state">
          <div className="empty-icon"><Clock size={24} /></div>
          <p style={{ color: 'var(--text-dim)', marginBottom: '16px' }}>No jobs from this address in the newest {state.scanned} jobs on the contract.</p>
          <button className="btn btn-outline" onClick={onBrowse}>Explore agents</button>
        </div>
      )}

      {state.jobs.length > 0 && (
        <div className="escrow-list">
          {state.jobs.map((job) => {
            const actions = clientActions(job, wallet, now ?? 0n);
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
                      <span>Agent: <ExplorerLink href={explorerAccountUrl(job.agent)}>{agentName(job.agent)}</ExplorerLink></span>
                      <span>{stroopsToXlm(job.amount)} XLM</span>
                      <span>Created {toDate(job.createdAt)}</span>
                    </div>
                    <div className="escrow-time"><TimeInfo job={job} now={now} /></div>
                    {job.resultHash && (
                      <div className="escrow-hash">Result hash (SHA-256): <code>{job.resultHash}</code></div>
                    )}
                  </div>
                  <div className="escrow-actions">
                    {(job.status === JobStatus.PENDING || job.status === JobStatus.DELIVERED) && <button className="btn btn-playground" title="Simulated: no agent is called and no payment is checked" onClick={() => onOpenPlayground({ id: job.id, agentName: agentName(job.agent) })}>Test API (sim)</button>}
                    {actions.complete && (
                      <button className="btn btn-green" onClick={() => act('Approve and pay (complete_job)', (opts) => completeJob({ client: wallet, jobId: job.id }, opts), `Job #${job.id} completed: ${stroopsToXlm(job.amount)} XLM released to the agent.`)}>Approve &amp; pay</button>
                    )}
                    {actions.refund && (
                      <button className="btn btn-red" onClick={() => act('Refund escrow (refund_job)', (opts) => refundJob({ caller: wallet, jobId: job.id }, opts), `Job #${job.id} refunded: ${stroopsToXlm(job.amount)} XLM returned to you.`)}>Refund</button>
                    )}
                    {actions.rate && <button className="btn btn-outline" onClick={() => setRatingJob(job)}>Rate</button>}
                    {job.resultHash && <button className="btn btn-outline" onClick={() => setVerifyJob(job)}><FileCheck size={14} /> Verify delivered file</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {verifyJob && <VerifyModal job={verifyJob} agentName={agentName(verifyJob.agent)} onClose={() => setVerifyJob(null)} />}
      {ratingJob && <RatingModal job={ratingJob} agentName={agentName(ratingJob.agent)} onSubmit={handleRate} onClose={() => setRatingJob(null)} />}
    </>
  );
}

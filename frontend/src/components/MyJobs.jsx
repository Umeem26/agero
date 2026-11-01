import { useCallback, useEffect, useState } from 'react';
import { Clock, FileCheck, RefreshCw, Star } from 'lucide-react';
import { MAX_JOB_SCAN, completeJob, fetchClientJobs, rateAgent, refundJob } from '../chain/rpc';
import { friendlyError } from '../chain/errors';
import { JobStatus, clientActions, reviewEndsAt } from '../chain/jobs';
import { hashesMatch } from '../chain/hash';
import { stroopsToXlm } from '../chain/units';
import { CONFIG, explorerAccountUrl, explorerContractUrl } from '../chain/config';
import { shortAddress } from '../agents';
import { ConnectPrompt, EmptyState, ErrorState, ExplorerLink, StatCard } from './ui';
import { HashMatch, HashSource, JobCard, JobListSkeleton } from './jobUi';
import { toDate, useLedgerNow } from './ledgerTime';
import HashChip from './HashChip';
import Modal from './Modal';

function TimeInfo({ job, now }) {
  if (now == null) return null;
  if (job.status === JobStatus.PENDING) {
    return now <= job.deadline
      ? `The agent can deliver until the deadline (${toDate(job.deadline)}).`
      : 'No delivery by the deadline. You can refund; the agent can still deliver until you do.';
  }
  if (job.status === JobStatus.DELIVERED) {
    return now < reviewEndsAt(job)
      ? 'Delivered. Approve within the review window; after it ends anyone can release the payment to the agent.'
      : 'Review window ended. Anyone can now release the payment to the agent; you can still approve it yourself.';
  }
  if (job.status === JobStatus.COMPLETED) return `Paid to the agent. ${job.rated ? 'You rated this job.' : 'Not rated yet.'}`;
  return 'Refunded to your wallet.';
}

function RatingModal({ job, agentName, onSubmit, onClose }) {
  const [stars, setStars] = useState(5);
  return (
    <Modal title={`Rate ${agentName}`} onClose={onClose}>
      <p className="modal-lead">Job #{String(job.id)}. The contract stores one 1–5 star rating per completed job; there are no text reviews.</p>
      <div className="rating-pick" role="group" aria-label={`Rating: ${stars} of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} className={`icon-btn rating-star ${n <= stars ? 'on' : ''}`} aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={n === stars} onClick={() => setStars(n)}>
            <Star size={28} aria-hidden="true" />
          </button>
        ))}
      </div>
      <button className="btn btn-primary btn-block" onClick={() => onSubmit(stars)}>Sign rating in Freighter</button>
    </Modal>
  );
}

// Client checks a file/text from the agent against the result_hash stored in the job. Local only.
function VerifyModal({ job, agentName, onClose }) {
  const [hash, setHash] = useState(null);
  return (
    <Modal title="Verify delivered file" onClose={onClose}>
      <p className="modal-lead">
        Job #{String(job.id)} · {agentName}. Pick the file (or paste the text) the agent sent you. Its SHA-256 is computed in this browser and compared with the hash the agent recorded in the contract. Nothing is uploaded.
      </p>
      <HashChip hash={job.resultHash} label="Hash recorded by the agent" sealed />
      <HashSource idPrefix={`verify-${job.id}`} onHash={setHash} />
      {hash && <HashMatch ok={hashesMatch(hash, job.resultHash)} />}
      <p className="form-hint">A match proves only that you received the content the agent committed to. It says nothing about its quality; Agero does not review the work.</p>
    </Modal>
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

  if (!wallet) return <ConnectPrompt onConnect={onConnect}>Connect Freighter to see the escrow jobs you created on Testnet.</ConnectPrompt>;

  const ready = state.status === 'ready';
  const locked = state.jobs.filter((j) => j.status === JobStatus.PENDING || j.status === JobStatus.DELIVERED).reduce((s, j) => s + j.amount, 0n);

  return (
    <>
      <div className="stat-row">
        <StatCard label="Your jobs" value={ready ? state.jobs.length : '—'} />
        <StatCard label="Held in escrow" value={ready ? stroopsToXlm(locked) : '—'} unit="XLM" />
        <StatCard label="Completed" value={ready ? state.jobs.filter((j) => j.status === JobStatus.COMPLETED).length : '—'} />
      </div>

      <div className="list-toolbar">
        <span>
          Read from contract <ExplorerLink href={explorerContractUrl()}>{shortAddress(CONFIG.contractId)}</ExplorerLink>
          {ready && ` · scanned ${state.scanned} of ${state.total} jobs${state.total > BigInt(MAX_JOB_SCAN) ? ` (newest ${MAX_JOB_SCAN} only)` : ''}`}
          {state.status === 'loading' && state.jobs.length > 0 && ' · refreshing…'}
        </span>
        <button className="btn btn-outline" onClick={load} disabled={state.status === 'loading'}><RefreshCw size={14} aria-hidden="true" /> Refresh</button>
      </div>

      {state.status === 'loading' && state.jobs.length === 0 && <JobListSkeleton />}
      {state.status === 'error' && <ErrorState message={state.error} onRetry={load} />}
      {ready && state.jobs.length === 0 && (
        <EmptyState icon={Clock} action={<button className="btn btn-outline" onClick={onBrowse}>Explore agents</button>}>
          No jobs from this address in the newest {state.scanned} jobs on the contract.
        </EmptyState>
      )}

      {state.jobs.length > 0 && (
        <div className="job-list">
          {state.jobs.map((job) => {
            const actions = clientActions(job, wallet, now ?? 0n);
            const open = job.status === JobStatus.PENDING || job.status === JobStatus.DELIVERED;
            return (
              <JobCard
                key={String(job.id)}
                job={job}
                now={now}
                party={{ label: 'Agent', name: agentName(job.agent), href: explorerAccountUrl(job.agent) }}
                actions={(
                  <>
                    {actions.complete && (
                      <button className="btn btn-primary" onClick={() => act('Approve and pay (complete_job)', (opts) => completeJob({ client: wallet, jobId: job.id }, opts), `Job #${job.id} completed: ${stroopsToXlm(job.amount)} XLM released to the agent.`)}>Approve &amp; pay</button>
                    )}
                    {actions.refund && (
                      <button className="btn btn-danger" onClick={() => act('Refund escrow (refund_job)', (opts) => refundJob({ caller: wallet, jobId: job.id }, opts), `Job #${job.id} refunded: ${stroopsToXlm(job.amount)} XLM returned to you.`)}>Refund</button>
                    )}
                    {actions.rate && <button className="btn btn-outline" onClick={() => setRatingJob(job)}>Rate</button>}
                    {job.resultHash && <button className="btn btn-outline" onClick={() => setVerifyJob(job)}><FileCheck size={14} aria-hidden="true" /> Verify delivered file</button>}
                    {open && <button className="btn btn-sim" title="Simulated: no agent is called and no payment is checked" onClick={() => onOpenPlayground({ id: job.id, agentName: agentName(job.agent) })}>Test API [sim]</button>}
                  </>
                )}
              >
                <TimeInfo job={job} now={now} />
              </JobCard>
            );
          })}
        </div>
      )}

      {verifyJob && <VerifyModal job={verifyJob} agentName={agentName(verifyJob.agent)} onClose={() => setVerifyJob(null)} />}
      {ratingJob && <RatingModal job={ratingJob} agentName={agentName(ratingJob.agent)} onSubmit={handleRate} onClose={() => setRatingJob(null)} />}
    </>
  );
}

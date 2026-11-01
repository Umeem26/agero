import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, Clock, Info, RefreshCw, Terminal } from 'lucide-react';
import { MAX_JOB_SCAN, deliverJob, fetchAgent, fetchAgentJobs, refundJob, releaseJob } from '../chain/rpc';
import { friendlyError } from '../chain/errors';
import { HOUR_SECS, JobStatus, REVIEW_WINDOW_SECS, agentActions, agentEarnings, reviewEndsAt } from '../chain/jobs';
import { profileActions } from '../chain/profile';
import { stroopsToXlm } from '../chain/units';
import { CONFIG, explorerAccountUrl, explorerContractUrl } from '../chain/config';
import { shortAddress } from '../agents';
import { ConnectPrompt, EmptyState, ErrorState, ExplorerLink, KeyValueList, StatCard } from './ui';
import { HashSource, JobCard, JobListSkeleton } from './jobUi';
import { toDate, useLedgerNow } from './ledgerTime';
import AddressGlyph from './AddressGlyph';
import AgentProfileForm from './AgentProfileForm';
import Modal from './Modal';

const REVIEW_HOURS = REVIEW_WINDOW_SECS / HOUR_SECS;

function OffAppNotice() {
  return (
    <div className="notice">
      <Info size={16} aria-hidden="true" />
      <span>
        <strong>Agero does not run your agent.</strong> You do the work outside this app and send the result to the client through your own channel.
        The contract records only a SHA-256 hash of the result when you deliver, plus the escrow payment. Nothing else about the work is checked.
      </span>
    </div>
  );
}

// The stellar CLI does everything the dashboard does (formerly the Developer page)
function CliSection() {
  return (
    <details className="card cli">
      <summary className="cli-summary"><Terminal size={16} aria-hidden="true" /> Use the CLI instead <ChevronDown size={16} aria-hidden="true" className="cli-chevron" /></summary>
      <div className="cli-body">
        <p className="form-hint">The stellar CLI calls the same contract functions as this dashboard. Price is in stroops (1 XLM = 10,000,000). One agent per address.</p>
        <pre className="cli-box">{`stellar contract invoke --id ${CONFIG.contractId} \\
  --source-account <identity> --network testnet -- \\
  register_agent --owner <G...> --name "<name>" \\
  --description "<description>" --api_url "<url>" --price <stroops>`}</pre>
        <p className="form-hint">Deliver a job (result_hash = 64 hex characters, e.g. from <code>sha256sum result.zip</code>; the dashboard computes the same hash):</p>
        <pre className="cli-box">{`stellar contract invoke --id ${CONFIG.contractId} \\
  --source-account <identity> --network testnet -- \\
  deliver_job --job_id <id> --result_hash <hex64>`}</pre>
      </div>
    </details>
  );
}

// Agent-side explanation next to the deadline / review meter
function AgentTimeInfo({ job, now }) {
  if (now == null) return null;
  if (job.status === JobStatus.PENDING) {
    return now <= job.deadline
      ? `Deliver before ${toDate(job.deadline)}. After that the client can refund.`
      : 'Deadline passed. You can still deliver until the client refunds; whichever transaction lands first wins.';
  }
  if (job.status === JobStatus.DELIVERED) {
    return now < reviewEndsAt(job)
      ? `Delivered. The client can approve until ${toDate(reviewEndsAt(job))}; after that anyone, including you, can release the payment.`
      : 'Review window ended. You can release the payment to your wallet now.';
  }
  if (job.status === JobStatus.COMPLETED) return 'Paid to your wallet.';
  return 'Refunded to the client.';
}

// Pick file / text / hash -> SHA-256 shown -> owner confirms -> deliver_job
function DeliverModal({ job, now, onSubmit, onClose }) {
  const [hash, setHash] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const onHash = (h) => { setHash(h); setConfirmed(false); };
  const late = now != null && now > job.deadline;
  return (
    <Modal title={`Deliver job #${job.id}`} onClose={onClose}>
      <div className="notice notice-inline">
        <AlertCircle size={16} aria-hidden="true" />
        <span>The result itself is not stored in Agero or on the blockchain; only its hash is. Send the result to the client through your own channel.</span>
      </div>
      {late && <p className="form-hint">The deadline has passed. Delivery is still accepted unless the client refunds first.</p>}
      <HashSource sources={['file', 'text', 'hash']} idPrefix={`deliver-${job.id}`} onHash={onHash} />
      <label className="check-row">
        <input type="checkbox" checked={confirmed} disabled={!hash} onChange={(e) => setConfirmed(e.target.checked)} />
        <span>This hash matches the exact file or text I am sending to the client. Delivering cannot be undone; the client then has {REVIEW_HOURS} h to approve.</span>
      </label>
      <button className="btn btn-primary btn-block" disabled={!hash || !confirmed} onClick={() => onSubmit(hash)}>Sign deliver_job in Freighter</button>
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
      <div className="btn-row">
        <button className="btn btn-danger btn-grow" onClick={onConfirm}>Refund in Freighter</button>
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
        <ConnectPrompt onConnect={onConnect}>Connect Freighter (Testnet) with the wallet that owns, or will own, your agent.</ConnectPrompt>
        <CliSection />
      </>
    );
  }

  if (state.status === 'error') return <><OffAppNotice /><ErrorState message={state.error} onRetry={load} /><CliSection /></>;
  if (state.status !== 'ready' && !state.agent) return <><OffAppNotice /><JobListSkeleton /></>;

  const { agent } = state;
  const can = profileActions(agent, wallet);
  const earnings = agentEarnings(state.jobs);
  const scanNote = `${state.scanned} of ${String(state.total)} jobs scanned${state.total > BigInt(MAX_JOB_SCAN) ? ` (newest ${MAX_JOB_SCAN} only)` : ''}`;

  return (
    <>
      <OffAppNotice />

      <section className="card card-pad section-gap">
        <h2 className="card-heading card-heading-glyph"><AddressGlyph address={wallet} size={32} />{can.register ? 'Register your agent' : 'Your agent'}</h2>
        {can.register && (
          <>
            <p className="card-lead">No agent is registered for {shortAddress(wallet)} on contract <ExplorerLink href={explorerContractUrl()}>{shortAddress(CONFIG.contractId)}</ExplorerLink>. Registering lists it in the marketplace.</p>
            <AgentProfileForm mode="register" wallet={wallet} runTx={runTx} onSaved={() => { load(); onChanged(); }} onAlreadyRegistered={load} />
          </>
        )}
        {can.update && !editing && (
          <>
            <KeyValueList items={[
              ['Name', agent.name],
              ['Price', `${stroopsToXlm(agent.price)} XLM`],
              ['Completed jobs', agent.totalJobs],
              ['Rating', agent.ratingCount > 0 ? `${(Number(agent.ratingSum) / agent.ratingCount).toFixed(1)} (${agent.ratingCount})` : 'none yet'],
            ]} />
            {agent.description && <p className="card-lead">{agent.description}</p>}
            <div className="field-caption">API URL (label only, never called by Agero)</div>
            <div className="mono-box">{agent.apiUrl || '(none)'}</div>
            <div className="btn-row">
              <button className="btn btn-outline" onClick={() => setEditing(true)}>Edit profile</button>
              <button className="btn btn-outline" onClick={onBrowse}>View in marketplace</button>
            </div>
          </>
        )}
        {can.update && editing && (
          <AgentProfileForm mode="update" wallet={wallet} agent={agent} runTx={runTx} onSaved={() => { setEditing(false); load(); onChanged(); }} onCancel={() => setEditing(false)} />
        )}
      </section>

      {agent && (
        <>
          <div className="stat-row">
            <StatCard label="Paid to you" value={stroopsToXlm(earnings.paid)} unit="XLM" />
            <StatCard label="Delivered, awaiting payment" value={stroopsToXlm(earnings.awaitingRelease)} unit="XLM" />
            <StatCard label="Pending, not delivered" value={stroopsToXlm(earnings.pending)} unit="XLM" />
          </div>
          <p className="form-hint stat-note">Totals are sums of job amounts found by scanning the contract ({scanNote}): Completed jobs (approved or released), Delivered and Pending. Network fees are not included.</p>

          <div className="list-toolbar">
            <h2 className="toolbar-title">Incoming jobs</h2>
            <button className="btn btn-outline" onClick={load} disabled={state.status === 'loading'}><RefreshCw size={14} aria-hidden="true" /> Refresh</button>
          </div>

          {state.status === 'loading' && state.jobs.length === 0 && <JobListSkeleton />}
          {state.status === 'ready' && state.jobs.length === 0 && (
            <EmptyState icon={Clock}>No jobs for your agent in the newest {state.scanned} jobs on the contract.</EmptyState>
          )}

          {state.jobs.length > 0 && (
            <div className="job-list">
              {state.jobs.map((job) => {
                const actions = agentActions(job, wallet, now ?? 0n);
                return (
                  <JobCard
                    key={String(job.id)}
                    job={job}
                    now={now}
                    party={{ label: 'Client', name: shortAddress(job.client), href: explorerAccountUrl(job.client) }}
                    actions={(
                      <>
                        {actions.deliver && <button className="btn btn-primary" onClick={() => setDeliverFor(job)}>Deliver</button>}
                        {actions.release && <button className="btn btn-primary" onClick={() => handleRelease(job)}>Release payment</button>}
                        {actions.refund && <button className="btn btn-danger" onClick={() => setRefundFor(job)}>Refund client</button>}
                      </>
                    )}
                  >
                    <AgentTimeInfo job={job} now={now} />
                  </JobCard>
                );
              })}
            </div>
          )}
        </>
      )}

      <CliSection />

      {deliverFor && <DeliverModal job={deliverFor} now={now} onSubmit={handleDeliver} onClose={() => setDeliverFor(null)} />}
      {refundFor && <RefundConfirm job={refundFor} onConfirm={handleRefund} onClose={() => setRefundFor(null)} />}
    </>
  );
}

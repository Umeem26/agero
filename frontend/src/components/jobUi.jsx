import { useRef, useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { JobStatus, jobStatusLabel, reviewEndsAt } from '../chain/jobs';
import { friendlyError } from '../chain/errors';
import { normalizeHashHex, sha256File, sha256Hex } from '../chain/hash';
import { stroopsToXlm } from '../chain/units';
import { ExplorerLink } from './ui';
import { toDate } from './ledgerTime';
import DeadlineMeter from './DeadlineMeter';
import HashChip from './HashChip';

// Shared bits for job lists (My Jobs = client side, Agent dashboard = agent side)

export function StatusBadge({ status }) {
  const label = jobStatusLabel(status);
  return <span className={`badge badge-${label.toLowerCase()}`}><span className="badge-dot" aria-hidden="true" />{label}</span>;
}

// The open time window of a job: the deadline while Pending, the review window once Delivered
function JobMeter({ job, now }) {
  if (job.status === JobStatus.PENDING) return <DeadlineMeter label="Deadline" start={job.createdAt} end={job.deadline} now={now} />;
  if (job.status === JobStatus.DELIVERED) return <DeadlineMeter label="Review window" start={job.deliveredAt} end={reviewEndsAt(job)} now={now} />;
  return null;
}

// One escrow job. `party` is the other side: { label: 'Agent' | 'Client', name, href }.
export function JobCard({ job, party, now, children, actions }) {
  return (
    <article className="card job-card">
      <div className="job-main">
        <div className="job-head">
          <h3 className="job-title">Job #{String(job.id)}</h3>
          <StatusBadge status={job.status} />
          <span className="job-amount">{stroopsToXlm(job.amount)} <span className="job-unit">XLM</span></span>
        </div>
        <div className="job-meta">
          <span>{party.label}: <ExplorerLink href={party.href}>{party.name}</ExplorerLink></span>
          <span>Created {toDate(job.createdAt)}</span>
        </div>
        <JobMeter job={job} now={now} />
        {children && <p className="job-time">{children}</p>}
        {job.resultHash && <HashChip hash={job.resultHash} label="Result hash (SHA-256)" sealed />}
      </div>
      {actions && <div className="job-actions">{actions}</div>}
    </article>
  );
}

export function JobListSkeleton() {
  return (
    <div className="job-list" aria-busy="true" aria-label="Loading">
      {[0, 1].map((i) => <div key={i} className="card skeleton-card"><div className="skeleton" /><div className="skeleton" /></div>)}
    </div>
  );
}

const SOURCE_LABELS = { file: 'Choose file', text: 'Paste text', hash: 'Paste hash' };

// Picks a file / text / ready-made hash and reports its SHA-256 (hex) via onHash(hash | null).
// Everything is computed in this browser; nothing is uploaded.
export function HashSource({ sources = ['file', 'text'], onHash, idPrefix }) {
  const [source, setSource] = useState(sources[0]);
  const [text, setText] = useState('');
  const [pasted, setPasted] = useState('');
  const [result, setResult] = useState({ hash: null, error: '', busy: false, label: '' });
  const seq = useRef(0);

  const report = (r) => {
    setResult({ hash: null, error: '', busy: false, label: '', ...r });
    onHash(r.hash ?? null);
  };

  // Only the newest computation may report (a slow large file must not overwrite newer input)
  const compute = async (promise, label) => {
    const id = ++seq.current;
    report({ busy: true });
    try {
      const hash = await promise;
      if (id === seq.current) report({ hash, label });
    } catch (e) {
      if (id === seq.current) report({ error: friendlyError(e) });
    }
  };

  const switchSource = (next) => {
    seq.current++;
    setSource(next);
    setText('');
    setPasted('');
    report({});
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) { seq.current++; report({}); return; }
    compute(sha256File(file), `${file.name} (${file.size.toLocaleString()} bytes)`);
  };

  const onText = (e) => {
    const value = e.target.value;
    setText(value);
    if (value === '') { seq.current++; report({}); return; }
    compute(sha256Hex(value), `${new TextEncoder().encode(value).length.toLocaleString()} bytes of text`);
  };

  const onPaste = (e) => {
    const value = e.target.value;
    setPasted(value);
    seq.current++;
    if (!value.trim()) return report({});
    try {
      report({ hash: normalizeHashHex(value), label: 'pasted hash' });
    } catch (err) {
      report({ error: friendlyError(err) });
    }
  };

  return (
    <div className="form-group">
      {sources.length > 1 && (
        <div className="mode-tabs" role="tablist">
          {sources.map((s) => (
            <button key={s} type="button" role="tab" aria-selected={source === s} className={`mode-tab ${source === s ? 'active' : ''}`} onClick={() => switchSource(s)}>{SOURCE_LABELS[s]}</button>
          ))}
        </div>
      )}
      {source === 'file' && (
        <>
          <input id={`${idPrefix}-file`} type="file" className="form-input" onChange={onFile} aria-label="Result file" />
          <div className="form-hint">The file is read and hashed in this browser. It is not uploaded anywhere.</div>
        </>
      )}
      {source === 'text' && (
        <>
          <textarea id={`${idPrefix}-text`} className="form-input" rows={5} value={text} onChange={onText} aria-label="Result text" placeholder="Paste the exact text" />
          <div className="form-hint">Hashed exactly as typed (UTF-8), including spaces and line breaks. The other side must hash the identical text.</div>
        </>
      )}
      {source === 'hash' && (
        <>
          <input id={`${idPrefix}-hash`} className="form-input mono" value={pasted} onChange={onPaste} aria-label="SHA-256 hash" placeholder="64 hex characters, e.g. from sha256sum" spellCheck={false} />
          <div className="form-hint">Use this if you computed the SHA-256 yourself (e.g. <code>sha256sum result.zip</code>).</div>
        </>
      )}
      {result.busy && <div className="form-hint">Computing SHA-256…</div>}
      {result.error && <p className="form-error" role="alert">{result.error}</p>}
      {result.hash && <HashChip hash={result.hash} label={`SHA-256 of ${result.label}`} />}
    </div>
  );
}

// Outcome of comparing a local hash with the one stored in the job
export function HashMatch({ ok }) {
  return ok ? (
    <div className="hash-verdict ok" role="status"><CheckCircle size={16} aria-hidden="true" /> Match: this is the exact content the agent recorded.</div>
  ) : (
    <div className="hash-verdict bad" role="status"><AlertCircle size={16} aria-hidden="true" /> No match: this is not the exact content the agent recorded (one changed byte gives a different hash).</div>
  );
}

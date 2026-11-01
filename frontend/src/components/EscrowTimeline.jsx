import { useEffect, useState } from 'react';
import { ArrowLeftRight, ArrowRight, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { JobStatus } from '../chain/jobs';
import { StatusBadge } from './jobUi';
import DeadlineMeter from './DeadlineMeter';
import HashChip from './HashChip';

// An illustration of one escrow job, stepped by the user. Nothing here is read from or sent to
// the chain; the figures are fixed example values.
const H = 3600;
const AMOUNT = '120';
// SHA-256 of the text "Illustration: sample result file for the Agero home page"
const SAMPLE_HASH = '348d9f48c9ff9fbe848cd49578e4d5f42c0c9360dead670a9ae50c537e595623';
const ACCOUNTS = ['Client', 'Escrow contract', 'Agent'];

const READY = { name: 'Ready', at: 0, status: null, text: `The client holds ${AMOUNT} XLM and picks an agent. No job exists yet.` };
const PENDING = {
  name: 'Pending', at: 1, status: JobStatus.PENDING, meter: { label: 'Deadline', total: 24 * H, left: 18 * H + 40 * 60 },
  text: `create_job: ${AMOUNT} XLM moves from the client into the escrow contract, with a 24 h deadline.`,
};
// `at`: who holds the XLM (index in ACCOUNTS). `meter`: the open time window. `hash`: result recorded.
const PATHS = {
  approved: [
    READY,
    PENDING,
    { name: 'Delivered', at: 1, status: JobStatus.DELIVERED, hash: true, meter: { label: 'Review window', total: 72 * H, left: 72 * H }, text: 'deliver_job: the agent records the SHA-256 of the result. The XLM stays in escrow.' },
    { name: '72 h review', at: 1, status: JobStatus.DELIVERED, hash: true, meter: { label: 'Review window', total: 72 * H, left: 31 * H + 12 * 60 }, text: 'The client compares the file with the recorded hash and can approve. Once 72 h pass, anyone can release the payment.' },
    { name: 'Completed', at: 2, status: JobStatus.COMPLETED, hash: true, text: `complete_job (or release_job after 72 h): the ${AMOUNT} XLM goes to the agent. The job is closed.` },
  ],
  refunded: [
    READY,
    PENDING,
    { name: 'Deadline passed', at: 1, status: JobStatus.PENDING, meter: { label: 'Deadline', total: 24 * H, left: -2 * H }, text: 'No delivery by the deadline. The client may refund now; the agent could still deliver until the refund lands.' },
    { name: 'Refunded', at: 0, status: JobStatus.REFUNDED, text: `refund_job: the ${AMOUNT} XLM goes back to the client. The job is closed.` },
  ],
};
// Arrow on each column border (Client|Escrow, Escrow|Agent): the route the XLM can take, shown
// before Play so the movement reads from the first frame. null: the XLM never crosses that border.
const ROUTES = { approved: [ArrowRight, ArrowRight], refunded: [ArrowLeftRight, null] };
const STEP_MS = 1600;

function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

export default function EscrowTimeline() {
  const reduced = usePrefersReducedMotion();
  const [outcome, setOutcome] = useState('approved');
  const steps = PATHS[outcome];
  const last = steps.length - 1;
  // With reduced motion the sample starts complete and never plays by itself
  const [step, setStep] = useState(() => (reduced ? last : 0));
  const [playing, setPlaying] = useState(false);
  const cur = steps[Math.min(step, last)];

  useEffect(() => {
    if (!playing) return undefined;
    if (step >= last) { setPlaying(false); return undefined; }
    const id = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(id);
  }, [playing, step, last]);

  const goTo = (i) => { setPlaying(false); setStep(i); };
  const play = () => {
    if (step >= last) setStep(0);
    setPlaying(true);
  };
  const pickOutcome = (o) => { setPlaying(false); setOutcome(o); setStep(reduced ? PATHS[o].length - 1 : 0); };

  return (
    <section className="card timeline" aria-labelledby="tl-title">
      <div className="tl-head">
        <h2 id="tl-title" className="tl-title">Sample escrow job</h2>
        <span className="illus-badge">Illustration, not a real job</span>
      </div>

      <div className="tl-outcome" role="group" aria-label="Outcome to show">
        {[['approved', 'Approved'], ['refunded', 'Refunded']].map(([id, label]) => (
          <button key={id} type="button" className={`tl-outcome-btn ${outcome === id ? 'active' : ''}`} aria-pressed={outcome === id} onClick={() => pickOutcome(id)}>{label}</button>
        ))}
      </div>

      <div className="tl-accounts">
        {ACCOUNTS.map((name, i) => (
          <div key={name} className={`tl-account ${cur.at === i ? 'is-holding' : ''}`}>
            {name}
            <span className="tl-slot" aria-hidden="true" />
          </div>
        ))}
        {ROUTES[outcome].map((Arrow, gap) => Arrow && (
          <span key={gap} className={`tl-arrow tl-gap-${gap} ${steps.slice(0, step + 1).some((s) => s.at > gap) ? 'is-crossed' : ''}`} aria-hidden="true">
            <Arrow size={14} />
          </span>
        ))}
        <div className={`tl-token tl-pos-${cur.at}`} aria-hidden="true"><span>{AMOUNT} XLM</span></div>
      </div>
      <p className="sr-only" aria-live="polite">{`Step ${step + 1} of ${steps.length}, ${cur.name}: ${cur.text} ${AMOUNT} XLM held by: ${ACCOUNTS[cur.at]}.`}</p>

      <div className="tl-status">
        {cur.status == null ? <span className="badge">No job yet</span> : <StatusBadge status={cur.status} />}
        <p className="tl-caption">{cur.text}</p>
      </div>

      <div className="tl-meter">
        {cur.meter
          ? <DeadlineMeter label={cur.meter.label} start={0} end={cur.meter.total} now={cur.meter.total - cur.meter.left} />
          : <p className="tl-placeholder">{cur.status == null ? 'The deadline starts when the job is created.' : 'No open time window: the job is closed.'}</p>}
      </div>

      <div className="tl-hash">
        {cur.hash
          ? <div className="tl-fade"><HashChip hash={SAMPLE_HASH} label="Result hash (example)" sealed /></div>
          : <p className="tl-placeholder">No result hash recorded yet.</p>}
      </div>

      <ol className="tl-steps">
        {steps.map((s, i) => (
          <li key={s.name}>
            <button type="button" className={`tl-step ${i === step ? 'is-current' : ''} ${i < step ? 'is-done' : ''}`} aria-current={i === step ? 'step' : undefined} onClick={() => goTo(i)}>
              {s.name}
            </button>
          </li>
        ))}
      </ol>

      <div className="btn-row">
        {!reduced && (
          playing
            ? <button type="button" className="btn btn-primary" onClick={() => setPlaying(false)}><Pause size={14} aria-hidden="true" /> Pause</button>
            : <button type="button" className="btn btn-primary" onClick={play}><Play size={14} aria-hidden="true" /> Play sample</button>
        )}
        <button type="button" className="btn btn-outline" onClick={() => goTo(Math.min(step + 1, last))} disabled={step >= last}><SkipForward size={14} aria-hidden="true" /> Next step</button>
        <button type="button" className="btn btn-outline" onClick={() => goTo(0)} disabled={step === 0}><RotateCcw size={14} aria-hidden="true" /> Reset</button>
      </div>
    </section>
  );
}

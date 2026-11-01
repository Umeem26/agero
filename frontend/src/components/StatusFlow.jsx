import { HOUR_SECS, MAX_DURATION_HOURS, MIN_DURATION_HOURS, REVIEW_WINDOW_SECS } from '../chain/jobs';

const REVIEW_HOURS = REVIEW_WINDOW_SECS / HOUR_SECS;

// Every status change the contract allows (docs/contract-v2.md, "Status job")
const TRANSITIONS = [
  ['create_job', 'client', 'new → Pending', `Locks the XLM; deadline ${MIN_DURATION_HOURS} h to ${MAX_DURATION_HOURS / 24} days`],
  ['deliver_job', 'agent', 'Pending → Delivered', 'Records the SHA-256 of the result; still allowed after the deadline until a refund lands'],
  ['complete_job', 'client', 'Delivered → Completed', 'Pays the agent'],
  ['release_job', 'anyone', 'Delivered → Completed', `${REVIEW_HOURS} h after delivery; pays the agent`],
  ['refund_job', 'client', 'Pending → Refunded', 'Only after the deadline, with no delivery'],
  ['refund_job', 'agent', 'Pending or Delivered → Refunded', 'Any time (voluntary)'],
];

// Hairline state diagram; one accent on the auto-release path. Coordinates on a 4 px grid.
function Diagram() {
  return (
    <svg className="flow" viewBox="0 0 320 368" role="img" aria-labelledby="flow-title flow-desc">
      <title id="flow-title">Escrow job states</title>
      <desc id="flow-desc">create_job makes a Pending job. deliver_job moves it to Delivered. complete_job, or release_job {REVIEW_HOURS} hours after delivery, moves it to Completed. refund_job moves Pending or Delivered to Refunded.</desc>
      <defs>
        <marker id="flow-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 z" className="flow-head" />
        </marker>
        <marker id="flow-arrow-hi" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 z" className="flow-head-hi" />
        </marker>
      </defs>

      <circle cx="88" cy="12" r="4" className="flow-start" />
      <path d="M88 16 V48" className="flow-edge" markerEnd="url(#flow-arrow)" />
      <text x="100" y="36" className="flow-fn">create_job</text>

      <rect x="24" y="48" width="128" height="40" rx="6" className="flow-node" />
      <text x="88" y="68" className="flow-label">Pending</text>

      <path d="M88 88 V176" className="flow-edge" markerEnd="url(#flow-arrow)" />
      <text x="100" y="128" className="flow-fn">deliver_job</text>
      <text x="100" y="144" className="flow-who">agent</text>

      <rect x="24" y="176" width="128" height="40" rx="6" className="flow-node" />
      <text x="88" y="196" className="flow-label">Delivered</text>

      <path d="M88 216 V304" className="flow-edge flow-edge-hi" markerEnd="url(#flow-arrow-hi)" />
      <text x="100" y="244" className="flow-fn">complete_job · client</text>
      <text x="100" y="260" className="flow-fn">release_job · anyone</text>
      <text x="100" y="276" className="flow-hi">{REVIEW_HOURS} h after delivery</text>

      <rect x="24" y="304" width="128" height="40" rx="6" className="flow-node flow-node-hi" />
      <text x="88" y="324" className="flow-label">Completed</text>

      <path d="M152 68 H252 V112" className="flow-edge" markerEnd="url(#flow-arrow)" />
      <text x="164" y="60" className="flow-fn">refund_job</text>
      <path d="M152 196 H252 V152" className="flow-edge" markerEnd="url(#flow-arrow)" />
      <text x="160" y="188" className="flow-fn">refund_job</text>
      <text x="160" y="212" className="flow-who">agent</text>

      <rect x="196" y="112" width="112" height="40" rx="6" className="flow-node" />
      <text x="252" y="132" className="flow-label">Refunded</text>
    </svg>
  );
}

export default function StatusFlow() {
  return (
    <div className="flow-layout">
      <Diagram />
      <table className="flow-table">
        <caption>Contract functions that change a job's status</caption>
        <thead>
          <tr><th scope="col">Function</th><th scope="col">Who</th><th scope="col">Status</th><th scope="col">Condition</th></tr>
        </thead>
        <tbody>
          {TRANSITIONS.map(([fn, who, change, rule]) => (
            <tr key={`${fn}-${who}`}>
              <td data-label="Function"><code>{fn}</code></td>
              <td data-label="Who">{who}</td>
              <td data-label="Status">{change}</td>
              <td data-label="Condition">{rule}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

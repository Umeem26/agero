import { formatSpan, remainingShare } from './ledgerTime';

// Thin one-colour bar for a time window [start, end] in ledger seconds, plus the time left as text.
// The text carries the information; the bar is decoration for screen readers.
export default function DeadlineMeter({ label, start, end, now, note }) {
  if (now == null) return null;
  const over = now > end;
  const share = remainingShare(start, end, now);
  return (
    <div className={`meter ${over ? 'is-over' : ''}`}>
      <div className="meter-head">
        <span className="meter-label">{label}</span>
        <span className="meter-left">{over ? `ended ${formatSpan(now - end)} ago` : `${formatSpan(end - now)} left`}</span>
      </div>
      <div className="meter-track" aria-hidden="true">
        <div className="meter-fill" style={{ '--share': share }} />
      </div>
      {note && <div className="meter-note">{note}</div>}
    </div>
  );
}

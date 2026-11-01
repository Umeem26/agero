import { useEffect, useState } from 'react';

export const toDate = (secs) => new Date(Number(secs) * 1000).toLocaleString();

// Ledger time now, estimated from the last ledger close time read plus local elapsed time
export function useLedgerNow(base) {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!base) return null;
  return base.ledgerTime + BigInt(Math.max(0, Math.floor((tick - base.readAt) / 1000)));
}

// Seconds -> "31 h 12 m" (meter text). Days above 48 h, seconds only under an hour.
export function formatSpan(totalSecs) {
  let s = Math.max(0, Math.floor(Number(totalSecs)));
  const d = Math.floor(s / 86400);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  s %= 60;
  if (h >= 48) return `${d} d ${h - d * 24} h`;
  if (h > 0) return `${h} h ${m} m`;
  return `${m} m ${s} s`;
}

// Share of the window [start, end] still left at `now`, clamped to 0..1
export function remainingShare(start, end, now) {
  const total = Number(end - start);
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, Number(end - now) / total));
}

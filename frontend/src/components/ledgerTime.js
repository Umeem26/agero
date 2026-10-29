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

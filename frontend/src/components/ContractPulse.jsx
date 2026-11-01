import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchPulse } from '../chain/rpc';
import { friendlyError } from '../chain/errors';
import { CONFIG, explorerContractUrl } from '../chain/config';
import { shortAddress } from '../agents';
import { ContractMark, ExplorerLink, StatCard } from './ui';
import { toDate } from './ledgerTime';

// Real numbers from the Agero contract, read once when the home page loads. No polling.
export default function ContractPulse() {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading', error: '' }));
    try {
      setState({ status: 'ready', data: await fetchPulse(), error: '' });
    } catch (e) {
      setState({ status: 'error', data: null, error: friendlyError(e) });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { status, data } = state;
  const value = (fn) => (status === 'ready' ? fn(data) : '…');

  return (
    <section className="pulse" aria-labelledby="pulse-title" aria-busy={status === 'loading'}>
      <div className="pulse-head">
        <h2 id="pulse-title" className="section-title">Contract pulse</h2>
        <p className="pulse-note">
          {status === 'loading' && 'Reading from Stellar Testnet…'}
          {status === 'ready' && `Read from Stellar Testnet on page load (ledger closed ${toDate(data.ledgerCloseTime)}).`}
          {status === 'error' && <span role="alert">Could not read from Stellar Testnet: {state.error}</span>}
        </p>
        {status === 'error' && <button className="btn btn-outline" onClick={load}><RefreshCw size={14} aria-hidden="true" /> Try again</button>}
      </div>
      <div className="stat-row stat-row-4">
        <StatCard label="agent_count" value={value((d) => d.agentCount)} mark={<ContractMark />} />
        <StatCard label="job_count" value={value((d) => String(d.jobCount))} mark={<ContractMark />} />
        <StatCard label="Latest ledger" value={value((d) => d.ledger.toLocaleString('en-US'))} />
        <StatCard label="Contract" value={<ExplorerLink href={explorerContractUrl()}>{shortAddress(CONFIG.contractId)}</ExplorerLink>} />
      </div>
    </section>
  );
}

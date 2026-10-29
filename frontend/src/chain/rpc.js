import { rpc, Account, Contract, TransactionBuilder, BASE_FEE, nativeToScVal, scValToNative } from '@stellar/stellar-sdk';
import { CONFIG, CONFIG_ERROR } from './config';
import { ChainError, describeSimulationError } from './errors';
import { normalizeAgent, normalizeJob } from './jobs';
import { signWithFreighter } from './wallet';

// Read-only simulations need a source account but no signature (same placeholder the SDK contract client uses)
const READ_SOURCE = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const READ_CONCURRENCY = 8;
// "My jobs" scans the newest N job IDs; older jobs are not shown
export const MAX_JOB_SCAN = 200;
const WRITE_TIMEOUT_SECS = 300; // time the user has to sign in Freighter before the tx expires
const POLL_ATTEMPTS = 30; // ~30 s at 1 s per attempt

let cached = null;
function chain() {
  if (CONFIG_ERROR) throw new ChainError(`Configuration error: ${CONFIG_ERROR}`, { kind: 'input' });
  if (!cached) {
    cached = {
      server: new rpc.Server(CONFIG.rpcUrl, { allowHttp: CONFIG.rpcUrl.startsWith('http://') }),
      agero: new Contract(CONFIG.contractId),
      xlm: new Contract(CONFIG.xlmSac),
    };
  }
  return cached;
}

export const arg = {
  address: (v) => nativeToScVal(String(v), { type: 'address' }),
  i128: (v) => nativeToScVal(BigInt(v), { type: 'i128' }),
  u64: (v) => nativeToScVal(BigInt(v), { type: 'u64' }),
  u32: (v) => nativeToScVal(Number(v), { type: 'u32' }),
};

// Run fn over items with at most `limit` requests in flight; keeps input order
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function simulate(operation, source) {
  const { server } = chain();
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: CONFIG.networkPassphrase })
    .addOperation(operation)
    .setTimeout(WRITE_TIMEOUT_SECS)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    const d = describeSimulationError(sim.error, { contractId: CONFIG.contractId, tokenId: CONFIG.xlmSac });
    throw new ChainError(d.message, { kind: d.kind, code: d.code });
  }
  if (rpc.Api.isSimulationRestore(sim)) {
    throw new ChainError('Some contract data has expired and must be restored before this call. Try again later.', { kind: 'rpc' });
  }
  return { tx, sim };
}

async function view(contract, method, ...args) {
  const { sim } = await simulate(contract.call(method, ...args), new Account(READ_SOURCE, '0'));
  if (!sim.result) throw new ChainError(`No result from ${method}.`, { kind: 'rpc' });
  return scValToNative(sim.result.retval);
}

const viewAgero = (method, ...args) => view(chain().agero, method, ...args);

// ---- Reads (simulation only, nothing is signed or sent) ----

export async function fetchAgents() {
  const count = Number(await viewAgero('agent_count'));
  const indexes = Array.from({ length: count }, (_, i) => i);
  const owners = await mapLimit(indexes, READ_CONCURRENCY, (i) => viewAgero('agent_at', arg.u32(i)));
  const raws = await mapLimit(owners, READ_CONCURRENCY, (owner) => viewAgero('get_agent', arg.address(owner)));
  return raws.filter(Boolean).map(normalizeAgent);
}

export async function fetchJobCount() {
  return BigInt(await viewAgero('job_count'));
}

// Ledger close time in seconds (bigint): the clock the contract compares deadlines against.
// getLatestLedger() also decodes the full ledger metadata (8-12 s in SDK 17); every getTransaction
// response carries latestLedgerCloseTime, so look up a hash that never exists instead (~0.5 s).
const NO_SUCH_TX = '0'.repeat(64);
export async function fetchLedgerTime() {
  const res = await chain().server.getTransaction(NO_SUCH_TX);
  return BigInt(String(res.latestLedgerCloseTime));
}

export async function fetchClientJobs(client) {
  const [count, ledgerTime] = await Promise.all([viewAgero('job_count'), fetchLedgerTime()]);
  const total = BigInt(count);
  const ids = [];
  for (let id = total; id >= 1n && ids.length < MAX_JOB_SCAN; id--) ids.push(id);
  const raws = await mapLimit(ids, READ_CONCURRENCY, (id) => viewAgero('get_job', arg.u64(id)));
  const jobs = raws
    .map((raw, i) => (raw ? normalizeJob(ids[i], raw) : null))
    .filter((job) => job && job.client === client);
  return { jobs, total, scanned: ids.length, ledgerTime };
}

export async function fetchXlmBalance(address) {
  return BigInt(await view(chain().xlm, 'balance', arg.address(address)));
}

// ---- Writes: build -> simulate -> assemble -> sign (Freighter) -> send -> poll ----

const TX_RESULT_MESSAGES = {
  txInsufficientBalance: 'Not enough XLM to pay the network fee.',
  txInsufficientFee: 'The fee was too low for current network load. Try again.',
  txBadSeq: 'Your account sequence changed (another transaction was sent). Try again.',
  txTooLate: 'The transaction expired before it was sent. Try again and sign sooner.',
  txNoAccount: 'Your account does not exist on Testnet. Fund it with Friendbot first.',
  txBadAuth: 'The signature was not accepted. Reconnect Freighter and try again.',
};

async function invoke(method, args, { source, onStep = () => {} }) {
  const { server, agero } = chain();
  onStep('simulate');
  const account = await server.getAccount(source);
  const { tx, sim } = await simulate(agero.call(method, ...args), account);
  const prepared = rpc.assembleTransaction(tx, sim).build();

  onStep('sign');
  const signedXdr = await signWithFreighter(prepared.toXdr(), source);
  const signed = TransactionBuilder.fromXdr(signedXdr, CONFIG.networkPassphrase);

  onStep('submit');
  const sent = await server.sendTransaction(signed);
  if (sent.status === 'ERROR') {
    const type = sent.errorResult?.result?.type;
    throw new ChainError(TX_RESULT_MESSAGES[type] || `The network rejected the transaction${type ? ` (${type})` : ''}.`, { kind: 'tx', code: type ?? null });
  }
  if (sent.status === 'TRY_AGAIN_LATER') {
    throw new ChainError('The network is busy. Nothing was applied; try again in a few seconds.', { kind: 'tx' });
  }

  onStep('confirm', sent.hash);
  const final = await server.pollTransaction(sent.hash, { attempts: POLL_ATTEMPTS, sleepStrategy: rpc.BasicSleepStrategy });
  if (final.status === rpc.Api.GetTransactionStatus.SUCCESS) {
    return { hash: sent.hash, ledger: final.ledger, value: final.returnValue ? scValToNative(final.returnValue) : null };
  }
  if (final.status === rpc.Api.GetTransactionStatus.FAILED) {
    throw new ChainError('The transaction was included but failed. See the explorer for details.', { kind: 'tx', hash: sent.hash });
  }
  throw new ChainError('Not confirmed after 30 seconds. It may still be included; check the explorer link.', { kind: 'tx', hash: sent.hash });
}

// Returns the new job ID (bigint) from the contract's return value
export async function createJob({ client, agentOwner, amount, durationSecs }, opts = {}) {
  const res = await invoke('create_job', [arg.address(client), arg.address(agentOwner), arg.i128(amount), arg.u64(durationSecs)], { ...opts, source: client });
  return { ...res, jobId: BigInt(res.value) };
}

export const completeJob = ({ client, jobId }, opts = {}) =>
  invoke('complete_job', [arg.u64(jobId)], { ...opts, source: client });

export const refundJob = ({ client, jobId }, opts = {}) =>
  invoke('refund_job', [arg.u64(jobId), arg.address(client)], { ...opts, source: client });

export const rateAgent = ({ client, jobId, rating }, opts = {}) =>
  invoke('rate_agent', [arg.address(client), arg.u64(jobId), arg.u32(rating)], { ...opts, source: client });

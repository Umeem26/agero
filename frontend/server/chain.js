// Contract access for the server-side agent: reads by simulation, and one write pipeline
// (build -> simulate -> assemble -> sign with the agent key -> send -> poll), the same steps as
// frontend/src/chain/rpc.js but signed in Node instead of Freighter.
import { rpc, Account, Contract, TransactionBuilder, BASE_FEE, nativeToScVal, scValToNative } from '@stellar/stellar-sdk';
import { describeSimulationError } from '../src/chain/errors.js';
import { normalizeAgent, normalizeJob } from '../src/chain/jobs.js';
import { hexToBytes } from '../src/chain/hash.js';
import { AgentError, redact } from './guard.js';

const READ_SOURCE = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const NO_SUCH_TX = '0'.repeat(64);
const POLL_ATTEMPTS = 30; // ~30 s at 1 s per attempt
const TRY_AGAIN_DELAY_MS = 5_000;
export const INVALID_STATE = 10; // contract Error::InvalidState

const arg = {
  address: (v) => nativeToScVal(String(v), { type: 'address' }),
  u64: (v) => nativeToScVal(BigInt(v), { type: 'u64' }),
  bytes32: (hex) => nativeToScVal(hexToBytes(hex), { type: 'bytes' }),
};

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Any failure that is not already an AgentError is treated as "RPC unreachable" (retryable)
async function rpcCall(what, fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AgentError) throw err;
    throw new AgentError('CHAIN_UNAVAILABLE', `${what} failed: ${redact(err?.message ?? err)}`, { permanent: false, cause: err });
  }
}

const txResultType = (sent) => {
  const r = sent.errorResult?.result;
  return r?.type ?? (typeof r?.switch === 'function' ? r.switch().name : null);
};

/**
 * @param {object} p
 * @param {object} p.config   loadConfig() result (networkPassphrase, rpcUrl, contractId, limits)
 * @param {object} [p.signer] loadAgentKey() result; required for writes
 * @param {object} [p.server] rpc.Server (tests pass a fake)
 */
export function createChain({ config, signer = null, server = null, sleep = defaultSleep }) {
  const srv = server ?? new rpc.Server(config.rpcUrl);
  const agero = new Contract(config.contractId);
  const passphrase = config.networkPassphrase;

  const requireSigner = () => {
    if (!signer) throw new AgentError('MISCONFIGURED', 'No agent key loaded for writes.');
    return signer;
  };

  async function simulate(method, source, args) {
    const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: passphrase })
      .addOperation(agero.call(method, ...args))
      .setTimeout(config.limits.txTimeoutSecs)
      .build();
    const sim = await rpcCall(`simulate ${method}`, () => srv.simulateTransaction(tx));
    if (rpc.Api.isSimulationError(sim)) {
      const d = describeSimulationError(sim.error, { contractId: config.contractId, method });
      throw new AgentError('CONTRACT_REJECTED', d.message, { details: { method, contractCode: d.code ?? null } });
    }
    if (rpc.Api.isSimulationRestore(sim)) {
      throw new AgentError('CHAIN_UNAVAILABLE', `${method}: contract data must be restored first.`, { permanent: false });
    }
    return { tx, sim };
  }

  async function view(method, ...args) {
    const { sim } = await simulate(method, new Account(READ_SOURCE, '0'), args);
    if (!sim.result) throw new AgentError('CHAIN_UNAVAILABLE', `No result from ${method}.`, { permanent: false });
    return scValToNative(sim.result.retval);
  }

  // One signed transaction from the agent account. `onSent({hash, maxTime})` runs before polling,
  // so the caller can store the hash and resume after a crash (docs/fase5-design.md §8.3).
  async function invoke(method, args, { onSent = async () => {} } = {}) {
    const key = requireSigner();
    let sent = null;
    let signed = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (!signed) {
        const account = await rpcCall('getAccount', () => srv.getAccount(key.publicKey));
        const { tx, sim } = await simulate(method, account, args);
        signed = key.signTransaction(rpc.assembleTransaction(tx, sim).build());
      }
      sent = await rpcCall(`send ${method}`, () => srv.sendTransaction(signed));
      if (sent.status === 'TRY_AGAIN_LATER' && attempt === 1) { await sleep(TRY_AGAIN_DELAY_MS); continue; }
      if (sent.status === 'ERROR' && txResultType(sent) === 'txBadSeq' && attempt === 1) { signed = null; continue; }
      break;
    }
    if (sent.status === 'ERROR') {
      const type = txResultType(sent);
      throw new AgentError('TX_REJECTED', `The network rejected ${method}${type ? ` (${type})` : ''}.`, { permanent: false, details: { method, txResult: type } });
    }
    if (sent.status === 'TRY_AGAIN_LATER') {
      throw new AgentError('CHAIN_UNAVAILABLE', `The network is busy; ${method} was not applied.`, { permanent: false });
    }
    const maxTime = Number(signed.timeBounds?.maxTime ?? 0);
    await onSent({ hash: sent.hash, maxTime });
    return waitFor(method, sent.hash, maxTime);
  }

  async function waitFor(method, hash, maxTime) {
    const final = await rpcCall(`poll ${method}`, () => srv.pollTransaction(hash, { attempts: POLL_ATTEMPTS, sleepStrategy: rpc.BasicSleepStrategy }));
    if (final.status === rpc.Api.GetTransactionStatus.SUCCESS) return { hash, maxTime, ledger: final.ledger };
    if (final.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new AgentError('TX_FAILED', `${method} was included but failed (${hash}).`, { permanent: false, details: { method, hash } });
    }
    throw new AgentError('CHAIN_UNAVAILABLE', `${method} not confirmed after ${POLL_ATTEMPTS} s (${hash}).`, { permanent: false, details: { method, hash, pending: true } });
  }

  return {
    server: srv,
    async getJob(jobId) {
      const raw = await view('get_job', arg.u64(jobId));
      return raw ? normalizeJob(jobId, raw) : null;
    },
    async getAgent(owner) {
      const raw = await view('get_agent', arg.address(owner));
      return raw ? normalizeAgent(raw) : null;
    },
    // Latest ledger close time (the clock the contract uses) via a lookup of a hash that never exists
    async ledgerNow() {
      const res = await rpcCall('getTransaction', () => srv.getTransaction(NO_SUCH_TX));
      return { time: BigInt(String(res.latestLedgerCloseTime)), ledger: Number(res.latestLedger) };
    },
    // { status: SUCCESS | FAILED | NOT_FOUND, ledgerTime } for resuming a stored tx hash
    async txStatus(hash) {
      const res = await rpcCall('getTransaction', () => srv.getTransaction(hash));
      return { status: res.status, ledgerTime: BigInt(String(res.latestLedgerCloseTime)) };
    },
    deliverJob: (jobId, resultHash, opts) => invoke('deliver_job', [arg.u64(jobId), arg.bytes32(resultHash)], opts),
    refundJob: async (jobId, opts) => invoke('refund_job', [arg.u64(jobId), arg.address(requireSigner().publicKey)], opts),
  };
}

import { describe, expect, it } from 'vitest';
import { runJob } from './pipeline.js';
import { createMemoryStore, keys } from './store.js';
import { AgentError } from './guard.js';
import { LIMITS, TESTNET_PASSPHRASE } from './config.js';
import { canonicalJson, sha256Hex } from './canonical.js';
import { INVALID_STATE } from './chain.js';
import { JobStatus } from '../src/chain/jobs.js';

const CONTRACT = 'CA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB';
const TARGET = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const AGENT = 'GAGENT';
const CLIENT = 'GCLIENT';
const LEDGER = 1_000_000n;
const INPUT = { contract_id: TARGET };
const INPUT_HASH = sha256Hex(canonicalJson(INPUT));
const config = {
  contractId: CONTRACT, rpcUrl: 'https://soroban-testnet.stellar.org', networkPassphrase: TESTNET_PASSPHRASE,
  limits: { ...LIMITS, executorTimeoutMs: 200, executorRetryDelaysMs: [1, 1] },
};
const invalidState = (method) => new AgentError('CONTRACT_REJECTED', 'InvalidState', { details: { method, contractCode: INVALID_STATE } });

// Contract stand-in: one job, an agent, a ledger clock and the two agent writes
function fakeChain(over = {}) {
  const state = {
    job: { id: 7n, client: CLIENT, agent: AGENT, amount: 10_000_000n, status: JobStatus.PENDING, deadline: LEDGER + 3600n, resultHash: null },
    ledger: LEDGER,
    txs: new Map(),
    calls: [],
    sendFailures: [],
    ...over,
  };
  let n = 0;
  const write = (kind, apply) => async (_jobId, ...rest) => {
    const opts = rest[rest.length - 1] ?? {};
    state.calls.push(kind);
    const failure = state.sendFailures.shift();
    if (failure === 'unavailable') throw new AgentError('CHAIN_UNAVAILABLE', 'rpc down', { permanent: false });
    const hash = `${kind[0]}${String(++n).padStart(63, '0')}`;
    await opts.onSent?.({ hash, maxTime: Number(state.ledger) + 60 });
    if (failure === 'pending') {
      state.txs.set(hash, 'NOT_FOUND');
      throw new AgentError('CHAIN_UNAVAILABLE', 'not confirmed', { permanent: false, details: { hash, pending: true } });
    }
    const err = apply(rest);
    if (err) { state.txs.set(hash, 'FAILED'); throw err; }
    state.txs.set(hash, 'SUCCESS');
    return { hash, ledger: 1 };
  };
  return {
    state,
    getJob: async () => (state.job ? { ...state.job } : null),
    getAgent: async (a) => (a === AGENT ? { owner: AGENT, price: 10_000_000n } : null),
    ledgerNow: async () => ({ time: state.ledger, ledger: 5_000 }),
    txStatus: async (hash) => ({ status: state.txs.get(hash) ?? 'NOT_FOUND', ledgerTime: state.ledger }),
    deliverJob: write('deliver', ([resultHash]) => {
      if (state.job.status !== JobStatus.PENDING) return invalidState('deliver_job');
      state.job = { ...state.job, status: JobStatus.DELIVERED, resultHash };
      return null;
    }),
    refundJob: write('refund', () => {
      if (state.job.status > JobStatus.DELIVERED) return invalidState('refund_job');
      state.job = { ...state.job, status: JobStatus.REFUNDED };
      return null;
    }),
  };
}

function fakeExecutor(behaviour = () => ({ ok: true })) {
  const ex = {
    id: 'fake', version: 1, kind: 'deterministic', maxInputBytes: 1024, timeoutMs: 20_000, runs: 0,
    parseInput: (v) => {
      const o = typeof v === 'string' ? JSON.parse(v) : v;
      if (!o?.contract_id) throw new RangeError('contract_id required');
      return { contract_id: o.contract_id };
    },
    async run(input, ctx) {
      ex.runs++;
      const b = await behaviour(ex.runs, ctx);
      if (b instanceof Error) throw b;
      return { bytes: new TextEncoder().encode(`${canonicalJson({ job: ctx.job.jobId, input_sha256: ctx.job.inputSha256, target: input.contract_id })}\n`), mediaType: 'application/json', filename: 'r.json' };
    },
  };
  return ex;
}

function setup({ chain = fakeChain(), executor = fakeExecutor(), store = createMemoryStore() } = {}) {
  const logs = [];
  const deps = { config, chain, store, executor, agentPublic: AGENT, sleep: async () => {}, log: (e, f) => logs.push([e, f]) };
  return { chain, executor, store, logs, deps, run: (req = {}) => runJob({ jobId: '7', input: INPUT, trustedLocal: true, ...req }, deps) };
}

describe('pipeline', () => {
  it('success: executor -> stored result -> deliver_job with the SHA-256 of the result', async () => {
    const t = setup();
    const res = await t.run();
    expect(res).toMatchObject({ ok: true, status: 'delivered', replay: false, media_type: 'application/json', filename: 'r.json' });
    const hash = sha256Hex(new TextEncoder().encode(res.result));
    expect(res.record.result_hash).toBe(hash);
    expect(t.chain.state.job.resultHash).toBe(hash);
    expect(t.chain.state.calls).toEqual(['deliver']);
    expect(JSON.parse(res.result)).toEqual({ job: '7', input_sha256: INPUT_HASH, target: TARGET });
    const stored = await t.store.get(keys.job(CONTRACT, '7'));
    expect(stored).toMatchObject({ status: 'delivered', input_hash: INPUT_HASH, executor: 'fake@1', client: CLIENT, attempts: 1 });
    expect(stored.deliver_tx).toBe(res.record.deliver_tx);
    expect(await t.store.get(keys.jobLock(CONTRACT, '7'))).toBeNull();
  });

  it('executor failure -> refund_job by the agent', async () => {
    const t = setup({ executor: fakeExecutor(() => new AgentError('CONTRACT_NOT_FOUND', 'no such contract')) });
    const res = await t.run();
    expect(res).toMatchObject({ ok: false, status: 'refunded', code: 'EXECUTOR_FAILED' });
    expect(res.record.refund_tx).toMatch(/^r/);
    expect(res.record.result_hash).toBeNull();
    expect(t.chain.state.job.status).toBe(JobStatus.REFUNDED);
    expect(t.chain.state.calls).toEqual(['refund']);
    expect(t.executor.runs).toBe(1); // permanent: not retried
  });

  it('transient executor errors are retried, then refunded', async () => {
    const flaky = setup({ executor: fakeExecutor((n) => (n < 3 ? new AgentError('RPC_ERROR', 'timeout', { permanent: false }) : null)) });
    expect(await flaky.run()).toMatchObject({ ok: true, status: 'delivered' });
    expect(flaky.executor.runs).toBe(3);

    const down = setup({ executor: fakeExecutor(() => new AgentError('RPC_ERROR', 'timeout', { permanent: false })) });
    expect(await down.run()).toMatchObject({ status: 'refunded', code: 'EXECUTOR_FAILED' });
    expect(down.executor.runs).toBe(3);
  });

  it('executor timeout -> refund', async () => {
    const t = setup({ executor: fakeExecutor(() => new Promise(() => {})) });
    const res = await t.run();
    expect(res).toMatchObject({ status: 'refunded', code: 'EXECUTOR_FAILED' });
    expect((await t.store.get(keys.job(CONTRACT, '7'))).error_code).toBe('EXECUTOR_TIMEOUT');
  });

  it('a second run returns the stored outcome: no second executor run, no second deliver', async () => {
    const t = setup();
    const first = await t.run();
    const second = await t.run();
    expect(second).toMatchObject({ ok: true, status: 'delivered', replay: true, result: first.result });
    expect(t.executor.runs).toBe(1);
    expect(t.chain.state.calls).toEqual(['deliver']);
  });

  it('a second run with another input is rejected', async () => {
    const t = setup();
    await t.run();
    expect(await t.run({ input: { contract_id: CONTRACT } })).toMatchObject({ ok: false, code: 'ALREADY_SUBMITTED' });
  });

  it('two concurrent runs: only one claims the job', async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    const t = setup({ executor: fakeExecutor(() => gate) });
    const a = t.run();
    await new Promise((r) => setTimeout(r, 5));
    const b = await t.run();
    release(null);
    expect(b).toMatchObject({ ok: false, code: 'ALREADY_SUBMITTED' });
    expect(await a).toMatchObject({ ok: true, status: 'delivered' });
    expect(t.chain.state.calls).toEqual(['deliver']);
  });

  it('only the job client may see a stored result (signed mode)', async () => {
    const t = setup();
    await t.run();
    expect(await t.run({ trustedLocal: false, signer: 'GSOMEONE' })).toMatchObject({ ok: false, code: 'NOT_JOB_CLIENT' });
    expect(await t.run({ trustedLocal: false, signer: CLIENT })).toMatchObject({ ok: true, replay: true });
  });

  it.each([
    ['bad JSON', { input: '{' }, 'INVALID_INPUT'],
    ['bad job ID', { jobId: '0' }, 'INVALID_INPUT'],
    ['input over 1 KiB', { input: { contract_id: 'C'.repeat(1100) } }, 'INPUT_TOO_LARGE'],
  ])('rejects %s without touching the chain', async (_, req, code) => {
    const t = setup();
    expect(await t.run(req)).toMatchObject({ ok: false, status: 'rejected', code });
    expect(t.chain.state.calls).toEqual([]);
    expect(await t.store.get(keys.job(CONTRACT, '7'))).toBeNull();
  });

  it.each([
    ['WRONG_AGENT', { agent: 'GOTHER' }],
    ['JOB_NOT_PENDING', { status: JobStatus.COMPLETED }],
    ['AMOUNT_BELOW_PRICE', { amount: 1n }],
    ['DEADLINE_TOO_CLOSE', { deadline: LEDGER + 299n }],
  ])('checkJob %s: no claim, no executor, no transaction', async (code, jobOver) => {
    const chain = fakeChain();
    chain.state.job = { ...chain.state.job, ...jobOver };
    const t = setup({ chain });
    expect(await t.run()).toMatchObject({ ok: false, code });
    expect(t.executor.runs).toBe(0);
    expect(chain.state.calls).toEqual([]);
    expect(await t.store.get(keys.job(CONTRACT, '7'))).toBeNull();
  });

  describe('resume (idempotency)', () => {
    it('RPC down at deliver: result kept; the next run delivers the same hash without re-running', async () => {
      const t = setup();
      t.chain.state.sendFailures = ['unavailable'];
      const first = await t.run();
      expect(first).toMatchObject({ ok: false, status: 'delivering', code: 'CHAIN_UNAVAILABLE' });
      const storedHash = first.record.result_hash;
      expect(storedHash).toMatch(/^[0-9a-f]{64}$/);

      const second = await t.run();
      expect(second).toMatchObject({ ok: true, status: 'delivered' });
      expect(t.executor.runs).toBe(1);
      expect(t.chain.state.job.resultHash).toBe(storedHash);
      expect(t.chain.state.calls).toEqual(['deliver', 'deliver']);
    });

    it('unconfirmed deliver: waits while it may still land, re-sends once it provably expired', async () => {
      const t = setup();
      t.chain.state.sendFailures = ['pending'];
      const first = await t.run();
      expect(first).toMatchObject({ status: 'delivering', code: 'CHAIN_UNAVAILABLE' });

      const waiting = await t.run();
      expect(waiting).toMatchObject({ status: 'delivering', code: 'CHAIN_UNAVAILABLE' });
      expect(t.chain.state.calls).toEqual(['deliver']);

      t.chain.state.ledger = LEDGER + 61n; // past the tx max time
      expect(await t.run()).toMatchObject({ ok: true, status: 'delivered' });
      expect(t.chain.state.calls).toEqual(['deliver', 'deliver']);
      expect(t.executor.runs).toBe(1);
    });

    it('stored deliver tx that landed is recognised without sending again', async () => {
      const t = setup();
      t.chain.state.sendFailures = ['pending'];
      await t.run();
      const rec = await t.store.get(keys.job(CONTRACT, '7'));
      t.chain.state.txs.set(rec.deliver_tx, 'SUCCESS');
      expect(await t.run()).toMatchObject({ ok: true, status: 'delivered' });
      expect(t.chain.state.calls).toEqual(['deliver']);
    });

    it('a crashed run (stale running record, lock expired) re-runs the deterministic executor', async () => {
      let t0 = 1_000_000;
      const store = createMemoryStore({ now: () => t0 });
      const t = setup({ store });
      t.deps.now = () => t0;
      await store.set(keys.job(CONTRACT, '7'), { job_id: '7', input_hash: INPUT_HASH, status: 'running', attempts: 1, lease_until: t0 / 1000 + 120, client: CLIENT });
      expect(await t.run()).toMatchObject({ ok: false, code: 'ALREADY_SUBMITTED' });
      t0 += 120_000;
      expect(await t.run()).toMatchObject({ ok: true, status: 'delivered' });
      expect((await store.get(keys.job(CONTRACT, '7'))).attempts).toBe(2);
    });
  });

  describe('lost races on the contract', () => {
    it('agent refunded from the dashboard before delivery (InvalidState) -> refunded', async () => {
      const t = setup({ executor: fakeExecutor(() => { t.chain.state.job = { ...t.chain.state.job, status: JobStatus.REFUNDED }; return null; }) });
      const res = await t.run();
      expect(res).toMatchObject({ ok: false, status: 'refunded' });
      expect(res.code).not.toBe('EXECUTOR_FAILED');
      expect((await t.store.get(keys.job(CONTRACT, '7'))).result).toBeNull();
    });

    it('client refunded after the deadline -> refunded_by_client', async () => {
      const t = setup({ executor: fakeExecutor(() => {
        t.chain.state.job = { ...t.chain.state.job, status: JobStatus.REFUNDED };
        t.chain.state.ledger = t.chain.state.job.deadline + 1n;
        return null;
      }) });
      expect(await t.run()).toMatchObject({ ok: false, status: 'refunded_by_client' });
    });

    it('a deliver that already landed with our hash -> delivered', async () => {
      const t = setup();
      t.chain.state.sendFailures = ['unavailable'];
      const first = await t.run();
      t.chain.state.job = { ...t.chain.state.job, status: JobStatus.DELIVERED, resultHash: first.record.result_hash };
      expect(await t.run()).toMatchObject({ ok: true, status: 'delivered' });
      expect(t.chain.state.calls).toEqual(['deliver']);
    });

    it('a delivery with another hash is reported as failed, never overwritten', async () => {
      const t = setup();
      t.chain.state.sendFailures = ['unavailable'];
      await t.run();
      t.chain.state.job = { ...t.chain.state.job, status: JobStatus.DELIVERED, resultHash: 'f'.repeat(64) };
      expect(await t.run()).toMatchObject({ ok: false, status: 'failed', code: 'DELIVERED_OTHER_HASH' });
    });
  });
});

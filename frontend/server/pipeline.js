// One job, end to end (docs/fase5-design.md §7, §8):
//   validate input -> check job on the contract -> claim (per-job lock + record) -> executor
//   -> store result -> SHA-256 -> deliver_job;  executor failure -> refund_job by the agent.
// Every step is saved in the JobRecord first, so a repeat run resumes instead of redoing work:
// the executor never runs twice for a stored result, and deliver_job only ever sends the stored hash.
import { randomUUID } from 'node:crypto';
import { JobStatus } from '../src/chain/jobs.js';
import { canonicalJson, sha256Hex } from './canonical.js';
import { checkJob, TERMINAL } from './check-job.js';
import { INVALID_STATE } from './chain.js';
import { AgentError, redact } from './guard.js';
import { keys } from './store.js';

// Statuses after the executor; the job may already have left Pending on the contract
const AFTER_EXECUTOR = ['result_stored', 'delivering', 'refunding'];
const MAX_SENDS_PER_RUN = 2;

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isInvalidState = (err) => err?.code === 'CONTRACT_REJECTED' && err.details?.contractCode === INVALID_STATE;

// Record without the stored input and result: what a status line may show
export const publicRecord = (r) => (r ? {
  job_id: r.job_id, status: r.status, executor: r.executor, input_hash: r.input_hash, result_hash: r.result_hash,
  deliver_tx: r.deliver_tx, refund_tx: r.refund_tx, error_code: r.error_code, attempts: r.attempts, updated_at: r.updated_at,
} : null);

// Run the executor under a hard timeout; transient errors are retried after the configured delays
async function execute(executor, input, ctx, { timeoutMs, retryDelaysMs, sleep }) {
  const controller = new AbortController();
  const timedOut = new Promise((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(new AgentError('EXECUTOR_TIMEOUT', `The executor did not finish within ${timeoutMs / 1000} s.`)));
  });
  timedOut.catch(() => {});
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        return await Promise.race([executor.run(input, { ...ctx, signal: controller.signal }), timedOut]);
      } catch (err) {
        if (controller.signal.aborted) throw await timedOut.catch((e) => e);
        const transient = err instanceof AgentError && !err.permanent;
        if (!transient || attempt >= retryDelaysMs.length) throw err;
        await Promise.race([sleep(retryDelaysMs[attempt]), timedOut]);
      }
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {object} req
 * @param {string|bigint|number} req.jobId
 * @param {unknown} req.input              executor input (object or JSON text)
 * @param {string|null} [req.signer]       client address proven by signature (phase 5b)
 * @param {boolean} [req.trustedLocal]     CLI: no client signature, the operator vouches
 * @param {object} deps  {config, chain, store, executor, agentPublic, now?, sleep?, log?}
 * @returns {Promise<{ok: boolean, status: string, code?: string, message?: string, replay?: boolean, record: object|null, result?: string}>}
 */
export async function runJob(req, deps) {
  const { config, chain, store, executor, agentPublic, now = Date.now, sleep = defaultSleep, log = () => {} } = deps;
  const L = config.limits;
  const jobId = String(req.jobId);
  const nowUnix = () => Math.floor(now() / 1000);
  const fail = (code, message, record = null, status = 'rejected') => ({ ok: false, status, code, message: redact(message), record: publicRecord(record) });

  if (!/^[1-9]\d{0,19}$/.test(jobId)) return fail('INVALID_INPUT', 'Job ID must be a positive integer.');

  // 1. Input: parse, canonicalize, size, hash. Bad input never claims the job or sends anything.
  let input;
  try {
    input = executor.parseInput(req.input);
  } catch (err) {
    return fail('INVALID_INPUT', err.message);
  }
  const canonical = canonicalJson(input);
  if (Buffer.byteLength(canonical, 'utf8') > Math.min(L.maxInputBytes, executor.maxInputBytes)) return fail('INPUT_TOO_LARGE', 'Input is larger than 1 KiB.');
  const inputHash = sha256Hex(canonical);

  const jobKey = keys.job(config.contractId, jobId);
  // A repeat request gets the stored outcome, and only the job's client may see it (Q10)
  const replayOf = (record) => {
    if (!req.trustedLocal && req.signer !== record.client) return fail('NOT_JOB_CLIENT', 'Only the client of this job can see its result.');
    if (record.input_hash !== inputHash) return fail('ALREADY_SUBMITTED', 'This job was already processed with a different input.', record);
    return outcome(record, true);
  };

  const early = await store.get(jobKey);
  if (early && TERMINAL.includes(early.status)) return replayOf(early);

  // 2. One processor per job. The lock expires on its own if this process dies.
  const lockKey = keys.jobLock(config.contractId, jobId);
  const holder = randomUUID();
  if (!(await store.setNX(lockKey, holder, { ttlSecs: L.jobLockSecs }))) {
    return fail('ALREADY_SUBMITTED', 'Another run is processing this job right now.', early);
  }
  try {
    let record = await store.get(jobKey);
    if (record && TERMINAL.includes(record.status)) return replayOf(record);

    // 3. Check the job on the contract (§7.1)
    const [job, agent, ledger] = await Promise.all([chain.getJob(jobId), chain.getAgent(agentPublic), chain.ledgerNow()]);
    const check = checkJob({
      job, agent, agentPublic, ledgerNow: ledger.time, signer: req.signer ?? null, trustedLocal: Boolean(req.trustedLocal),
      record, inputHash, nowUnix: nowUnix(), marginSecs: L.safetyMarginSecs,
    });
    const resumeAfterExecutor = !check.ok && check.code === 'JOB_NOT_PENDING' && record?.input_hash === inputHash
      && AFTER_EXECUTOR.includes(record.status) && job.agent === agentPublic && (req.trustedLocal || req.signer === job.client);
    if (!check.ok && !resumeAfterExecutor) return fail(check.code, `Job ${jobId} cannot be processed (${check.code}).`, record);

    const save = async (changes) => {
      record = { ...record, ...changes, updated_at: nowUnix() };
      await store.set(jobKey, record, { ttlSecs: L.recordTtlSecs });
    };

    // 4. Claim
    if (!record) {
      record = {
        schema: 1, contract_id: config.contractId, job_id: jobId, client: job.client, agent: agentPublic,
        executor: `${executor.id}@${executor.version}`, input: canonical, input_hash: inputHash,
        status: 'running', attempts: 0, lease_until: 0,
        result: null, result_media_type: null, result_filename: null, result_hash: null,
        deliver_tx: null, deliver_tx_max_time: null, refund_tx: null, refund_tx_max_time: null, error_code: null,
        created_at: nowUnix(), started_at: nowUnix(), delivered_at: null, updated_at: nowUnix(),
      };
    }
    if (record.status === 'running') await save({ attempts: record.attempts + 1, lease_until: nowUnix() + L.jobLockSecs });
    log('claimed', { job: jobId, status: record.status, attempt: record.attempts });

    // Contract state decides what a failed or rejected transaction means
    const reconcile = async (txKind) => {
      const j = await chain.getJob(jobId);
      if (!j) return save({ status: 'failed', error_code: 'JOB_NOT_FOUND' });
      if (j.status === JobStatus.PENDING) return save({ status: txKind === 'deliver' ? 'result_stored' : 'refunding', [`${txKind}_tx`]: null });
      if (j.status === JobStatus.REFUNDED) {
        if (txKind === 'refund') return save({ status: 'refunded' });
        // Before the deadline only the agent can refund (e.g. from the dashboard); after it, the client too
        const { time } = await chain.ledgerNow();
        return save({ status: time > j.deadline ? 'refunded_by_client' : 'refunded', result: null, error_code: 'REFUNDED_ELSEWHERE' });
      }
      // Delivered or Completed
      if (j.resultHash === record.result_hash) return save({ status: 'delivered', delivered_at: record.delivered_at ?? nowUnix() });
      return save({ status: 'failed', error_code: 'DELIVERED_OTHER_HASH' });
    };

    // Resume a sent transaction: landed, failed, or provably expired (then it may be sent again)
    const resumeTx = async (txKind) => {
      const hash = record[`${txKind}_tx`];
      if (!hash) return reconcile(txKind);
      const tx = await chain.txStatus(hash);
      if (tx.status === 'SUCCESS') return txKind === 'deliver' ? save({ status: 'delivered', delivered_at: nowUnix() }) : save({ status: 'refunded' });
      if (tx.status === 'FAILED') return reconcile(txKind);
      if (tx.ledgerTime > BigInt(record[`${txKind}_tx_max_time`] ?? 0)) return reconcile(txKind);
      throw new AgentError('CHAIN_UNAVAILABLE', `${txKind}_job ${hash} is still pending; try again in a minute.`, { permanent: false });
    };

    const sendTx = async (txKind) => {
      const onSent = ({ hash, maxTime }) => save({ [`${txKind}_tx`]: hash, [`${txKind}_tx_max_time`]: maxTime });
      try {
        const res = txKind === 'deliver'
          ? await chain.deliverJob(jobId, record.result_hash, { onSent })
          : await chain.refundJob(jobId, { onSent });
        log(`${txKind}_job`, { job: jobId, tx: res.hash });
        return txKind === 'deliver' ? save({ status: 'delivered', delivered_at: nowUnix() }) : save({ status: 'refunded' });
      } catch (err) {
        if (isInvalidState(err) || err?.code === 'TX_FAILED') return reconcile(txKind);
        throw err;
      }
    };

    // 5. State machine
    let sends = 0;
    for (;;) {
      switch (record.status) {
        case 'running': {
          const ctx = {
            network: { rpcUrl: config.rpcUrl, passphrase: config.networkPassphrase },
            job: { jobId, client: job.client, agent: agentPublic, inputSha256: inputHash, ledgerNow: Number(ledger.time) },
          };
          let out;
          try {
            out = await execute(executor, input, ctx, {
              timeoutMs: Math.min(L.executorTimeoutMs, executor.timeoutMs), retryDelaysMs: L.executorRetryDelaysMs, sleep,
            });
            const bytes = Uint8Array.from(out.bytes);
            if (bytes.length > L.maxResultBytes) throw new AgentError('RESULT_TOO_LARGE', 'The result is larger than 64 KiB.');
            const text = Buffer.from(bytes).toString('utf8');
            if (!Buffer.from(text, 'utf8').equals(Buffer.from(bytes))) throw new AgentError('RESULT_NOT_TEXT', 'The result is not UTF-8 text.');
            out = { ...out, text, hash: sha256Hex(bytes) };
          } catch (err) {
            const code = err instanceof AgentError ? err.code : 'EXECUTOR_ERROR';
            log('executor_failed', { job: jobId, code, message: redact(err?.message ?? err) });
            await save({ status: 'refunding', error_code: code });
            break;
          }
          await save({ status: 'result_stored', result: out.text, result_media_type: out.mediaType, result_filename: out.filename, result_hash: out.hash });
          log('result_stored', { job: jobId, hash: out.hash });
          break;
        }
        case 'result_stored':
        case 'refunding': {
          const txKind = record.status === 'refunding' ? 'refund' : 'deliver';
          if (record[`${txKind}_tx`]) { await resumeTx(txKind); break; }
          if (sends++ >= MAX_SENDS_PER_RUN) throw new AgentError('CHAIN_UNAVAILABLE', `${txKind}_job did not go through; run again later.`, { permanent: false });
          if (txKind === 'deliver') await save({ status: 'delivering' });
          await sendTx(txKind);
          break;
        }
        case 'delivering':
          await resumeTx('deliver');
          break;
        default:
          return outcome(record, false);
      }
    }
  } catch (err) {
    const code = err instanceof AgentError ? err.code : 'INTERNAL_ERROR';
    log('error', { job: jobId, code, message: redact(err?.message ?? err) });
    const record = await store.get(jobKey).catch(() => null);
    return fail(code, err?.message ?? String(err), record, record?.status ?? 'rejected');
  } finally {
    await store.del(lockKey).catch(() => {});
  }
}

function outcome(record, replay) {
  const base = { status: record.status, replay, record: publicRecord(record) };
  if (record.status === 'delivered') {
    return { ok: true, ...base, result: record.result, media_type: record.result_media_type, filename: record.result_filename };
  }
  if (record.status === 'refunded' && record.error_code && record.error_code !== 'REFUNDED_ELSEWHERE') {
    return { ok: false, ...base, code: 'EXECUTOR_FAILED', message: `The executor failed (${record.error_code}); the agent refunded the job.` };
  }
  return { ok: false, ...base, code: record.error_code ?? 'JOB_NOT_PENDING', message: `Job ended as ${record.status}.` };
}

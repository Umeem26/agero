// Pure pre-work check (docs/fase5-design.md §7.1): may the agent work on this job right now?
// No network; every input is passed in, so each row of the table is unit-tested.
import { JobStatus } from '../src/chain/jobs.js';

export const SAFETY_MARGIN_SECS = 300;

// Record statuses a later run may continue from (§8.3). `running` only after its lease ran out.
export const RESUMABLE = Object.freeze(['running', 'result_stored', 'delivering', 'refunding']);
// Final record statuses: a repeat request only gets the stored outcome back
export const TERMINAL = Object.freeze(['delivered', 'refunded', 'refunded_by_client', 'failed']);

/**
 * @param {object} p
 * @param {object|null} p.job        normalizeJob() result, or null when get_job returned nothing
 * @param {object|null} p.agent      normalizeAgent() of the server key (current price)
 * @param {string} p.agentPublic     server agent key
 * @param {bigint} p.ledgerNow       latest ledger close time (s)
 * @param {string|null} p.signer     address that proved ownership; null only with trustedLocal
 * @param {boolean} [p.trustedLocal] CLI mode: the operator vouches for the client, no signature
 * @param {object|null} p.record     stored JobRecord or null
 * @param {string} p.inputHash       SHA-256 of the canonical input of this request
 * @param {number} p.nowUnix         wall clock (s), for the record lease
 * @param {number} [p.marginSecs]
 * @returns {{ok: true, resume: boolean} | {ok: false, code: string}}
 */
export function checkJob({ job, agent, agentPublic, ledgerNow, signer, trustedLocal = false, record, inputHash, nowUnix, marginSecs = SAFETY_MARGIN_SECS }) {
  if (!job) return { ok: false, code: 'JOB_NOT_FOUND' };
  if (job.agent !== agentPublic) return { ok: false, code: 'WRONG_AGENT' };
  if (!(trustedLocal && signer == null) && signer !== job.client) return { ok: false, code: 'NOT_JOB_CLIENT' };
  if (job.status !== JobStatus.PENDING) return { ok: false, code: 'JOB_NOT_PENDING' };
  if (!agent || job.amount < agent.price) return { ok: false, code: 'AMOUNT_BELOW_PRICE' };
  if (job.deadline - BigInt(ledgerNow) < BigInt(marginSecs)) return { ok: false, code: 'DEADLINE_TOO_CLOSE' };
  if (!record) return { ok: true, resume: false };
  const leaseLive = record.status === 'running' && Number(record.lease_until) > nowUnix;
  if (record.input_hash === inputHash && RESUMABLE.includes(record.status) && !leaseLive) return { ok: true, resume: true };
  return { ok: false, code: 'ALREADY_SUBMITTED' };
}

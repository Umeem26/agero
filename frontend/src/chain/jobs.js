// Job rules mirrored from contracts/agero-contract/src/lib.rs (see docs/contract-v2.md).
// This is the only place in the frontend that knows the numeric JobStatus codes.
import { stroopsToXlm, xlmToStroops } from './units';
import { bytesToHex } from './hash';

export const JobStatus = Object.freeze({ PENDING: 0, DELIVERED: 1, COMPLETED: 2, REFUNDED: 3 });
const STATUS_LABELS = Object.freeze(['Pending', 'Delivered', 'Completed', 'Refunded']);

export const HOUR_SECS = 3600;
export const MIN_DURATION_SECS = HOUR_SECS; // MIN_DURATION_SECS
export const MAX_DURATION_SECS = 30 * 24 * HOUR_SECS; // MAX_DURATION_SECS
export const REVIEW_WINDOW_SECS = 72 * HOUR_SECS; // REVIEW_WINDOW_SECS
export const MIN_DURATION_HOURS = MIN_DURATION_SECS / HOUR_SECS;
export const MAX_DURATION_HOURS = MAX_DURATION_SECS / HOUR_SECS;

// The contract returns JobStatus as a u32 (0..3). Anything else means the frontend and contract disagree.
export function parseJobStatus(raw) {
  const code = typeof raw === 'number' || typeof raw === 'bigint' ? Number(raw) : NaN;
  if (!Number.isInteger(code) || code < 0 || code >= STATUS_LABELS.length) {
    throw new RangeError(`Unknown job status from contract: ${String(raw)}`);
  }
  return code;
}

export const jobStatusLabel = (code) => STATUS_LABELS[parseJobStatus(code)];

// Whole hours in [1, 720] -> duration_secs (bigint, u64). Throws RangeError otherwise.
export function durationHoursToSecs(hours) {
  const text = String(hours ?? '').trim();
  if (!/^\d+$/.test(text)) throw new RangeError('Deadline must be a whole number of hours.');
  const h = Number(text);
  if (h < MIN_DURATION_HOURS || h > MAX_DURATION_HOURS) {
    throw new RangeError(`Deadline must be between ${MIN_DURATION_HOURS} hour and ${MAX_DURATION_HOURS} hours (30 days).`);
  }
  return BigInt(h * HOUR_SECS);
}

// Hire form -> create_job arguments, with the same checks the contract makes on amount and deadline
export function parseHireInput({ amountXlm, durationHours, price }) {
  const amount = xlmToStroops(amountXlm);
  if (amount <= 0n) throw new RangeError('Amount must be greater than 0 XLM.');
  if (amount < BigInt(price)) throw new RangeError(`Amount is below the agent's price (${stroopsToXlm(price)} XLM).`);
  return { amount, durationSecs: durationHoursToSecs(durationHours) };
}

// Raw get_job result (scValToNative) -> plain object with explicit types
export function normalizeJob(id, raw) {
  return {
    id: BigInt(id),
    client: String(raw.client),
    agent: String(raw.agent),
    amount: BigInt(raw.amount),
    status: parseJobStatus(raw.status),
    createdAt: BigInt(raw.created_at),
    deadline: BigInt(raw.deadline),
    deliveredAt: raw.delivered_at == null ? null : BigInt(raw.delivered_at),
    resultHash: raw.result_hash == null ? null : bytesToHex(Uint8Array.from(raw.result_hash)),
    rated: Boolean(raw.rated),
  };
}

export function normalizeAgent(raw) {
  return {
    owner: String(raw.owner),
    name: String(raw.name),
    description: String(raw.description),
    apiUrl: String(raw.api_url),
    price: BigInt(raw.price),
    ratingSum: BigInt(raw.rating_sum),
    ratingCount: Number(raw.rating_count),
    totalJobs: Number(raw.total_jobs),
  };
}

export const reviewEndsAt = (job) => (job.deliveredAt == null ? null : job.deliveredAt + BigInt(REVIEW_WINDOW_SECS));

// Which client actions the contract would accept right now. `nowSecs` is ledger time (bigint).
export function clientActions(job, wallet, nowSecs) {
  const isClient = Boolean(wallet) && job.client === wallet;
  return {
    complete: isClient && job.status === JobStatus.DELIVERED,
    refund: isClient && job.status === JobStatus.PENDING && nowSecs > job.deadline,
    rate: isClient && job.status === JobStatus.COMPLETED && !job.rated,
  };
}

// Which agent-side actions the contract would accept right now. `nowSecs` is ledger time (bigint).
//   deliver: job's agent, while Pending (also after the deadline, until the client refunds)
//   release: anyone, while Delivered and nowSecs >= delivered_at + 72 h (release_job has no auth)
//   refund:  job's agent, while Pending or Delivered, at any time (voluntary cancel)
export function agentActions(job, wallet, nowSecs) {
  const isAgent = Boolean(wallet) && job.agent === wallet;
  const end = reviewEndsAt(job);
  return {
    deliver: isAgent && job.status === JobStatus.PENDING,
    release: Boolean(wallet) && job.status === JobStatus.DELIVERED && end != null && nowSecs >= end,
    refund: isAgent && (job.status === JobStatus.PENDING || job.status === JobStatus.DELIVERED),
  };
}

// Agent-side totals from a job scan (stroops, bigint). Completed covers complete_job and release_job.
export function agentEarnings(jobs) {
  const sum = (status) => jobs.filter((j) => j.status === status).reduce((s, j) => s + j.amount, 0n);
  return {
    paid: sum(JobStatus.COMPLETED),
    awaitingRelease: sum(JobStatus.DELIVERED),
    pending: sum(JobStatus.PENDING),
    refunded: sum(JobStatus.REFUNDED),
  };
}

// 93784 -> "1d 2h 3m"; shows seconds only under an hour
export function formatDuration(totalSecs) {
  let s = Math.max(0, Math.floor(Number(totalSecs)));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

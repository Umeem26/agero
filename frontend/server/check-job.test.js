import { describe, expect, it } from 'vitest';
import { checkJob, SAFETY_MARGIN_SECS } from './check-job.js';
import { JobStatus } from '../src/chain/jobs.js';

const AGENT = 'GAGENTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const CLIENT = 'GCLIENTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const NOW = 1_000_000n;
const HASH = 'a'.repeat(64);

const job = (over = {}) => ({ id: 7n, client: CLIENT, agent: AGENT, amount: 10_000_000n, status: JobStatus.PENDING, deadline: NOW + 3600n, ...over });
const base = (over = {}) => ({
  job: job(), agent: { owner: AGENT, price: 10_000_000n }, agentPublic: AGENT, ledgerNow: NOW,
  signer: CLIENT, record: null, inputHash: HASH, nowUnix: 5_000, ...over,
});

describe('checkJob (§7.1, in table order)', () => {
  it('accepts a fresh Pending job for this agent', () => {
    expect(checkJob(base())).toEqual({ ok: true, resume: false });
  });

  it.each([
    ['JOB_NOT_FOUND', { job: null }],
    ['WRONG_AGENT', { job: job({ agent: CLIENT }) }],
    ['NOT_JOB_CLIENT', { signer: AGENT }],
    ['NOT_JOB_CLIENT', { signer: null }],
    ['JOB_NOT_PENDING', { job: job({ status: JobStatus.DELIVERED }) }],
    ['JOB_NOT_PENDING', { job: job({ status: JobStatus.REFUNDED }) }],
    ['AMOUNT_BELOW_PRICE', { agent: { owner: AGENT, price: 10_000_001n } }],
    ['AMOUNT_BELOW_PRICE', { agent: null }],
    ['DEADLINE_TOO_CLOSE', { job: job({ deadline: NOW + 299n }) }],
    ['DEADLINE_TOO_CLOSE', { job: job({ deadline: NOW - 1n }) }],
  ])('%s', (code, over) => {
    expect(checkJob(base(over))).toEqual({ ok: false, code });
  });

  it('accepts exactly the 300 s margin and rejects one second less', () => {
    expect(SAFETY_MARGIN_SECS).toBe(300);
    expect(checkJob(base({ job: job({ deadline: NOW + 300n }) })).ok).toBe(true);
    expect(checkJob(base({ job: job({ deadline: NOW + 299n }) })).code).toBe('DEADLINE_TOO_CLOSE');
  });

  it('checks in table order: wrong agent wins over a non-Pending status', () => {
    expect(checkJob(base({ job: job({ agent: CLIENT, status: JobStatus.COMPLETED }) })).code).toBe('WRONG_AGENT');
  });

  it('amount equal to the current price passes', () => {
    expect(checkJob(base({ job: job({ amount: 5n }), agent: { owner: AGENT, price: 5n } })).ok).toBe(true);
  });

  it('trusted local mode skips only the signer check', () => {
    expect(checkJob(base({ signer: null, trustedLocal: true })).ok).toBe(true);
    expect(checkJob(base({ signer: AGENT, trustedLocal: true })).code).toBe('NOT_JOB_CLIENT');
    expect(checkJob(base({ signer: null, trustedLocal: true, job: job({ agent: CLIENT }) })).code).toBe('WRONG_AGENT');
  });

  describe('existing record (row 7)', () => {
    const rec = (over) => ({ input_hash: HASH, status: 'result_stored', lease_until: 0, ...over });
    it.each(['result_stored', 'delivering', 'refunding'])('resumes %s with the same input', (status) => {
      expect(checkJob(base({ record: rec({ status }) }))).toEqual({ ok: true, resume: true });
    });
    it('resumes running only after its lease ran out', () => {
      expect(checkJob(base({ record: rec({ status: 'running', lease_until: 5_001 }) })).code).toBe('ALREADY_SUBMITTED');
      expect(checkJob(base({ record: rec({ status: 'running', lease_until: 5_000 }) }))).toEqual({ ok: true, resume: true });
    });
    it('rejects a different input', () => {
      expect(checkJob(base({ record: rec({ input_hash: 'b'.repeat(64) }) })).code).toBe('ALREADY_SUBMITTED');
    });
    it.each(['delivered', 'refunded', 'failed'])('rejects a finished record (%s)', (status) => {
      expect(checkJob(base({ record: rec({ status }) })).code).toBe('ALREADY_SUBMITTED');
    });
  });
});

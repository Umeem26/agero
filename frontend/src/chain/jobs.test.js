import { describe, expect, it } from 'vitest';
import {
  JobStatus, MAX_DURATION_SECS, MIN_DURATION_SECS, REVIEW_WINDOW_SECS,
  agentActions, agentEarnings, clientActions, durationHoursToSecs, formatDuration, jobStatusLabel, normalizeJob, parseHireInput, parseJobStatus, reviewEndsAt,
} from './jobs';

const CLIENT = 'GBTBPEC5U2BEN3W5JQDHXI77EYD74ND76OIIJM4QVPUFIZEGF3DDDPA4';
const AGENT = 'GAR3Y2JL6XA7F6EWSCGUJK733MW2VEKBLRBIXTPQLYTEDMDMC3YFGGSV';

// Shape returned by scValToNative(get_job) on Testnet for job 1 (docs/deploy.md §6)
const RAW_JOB = {
  agent: AGENT, amount: 10000000n, client: CLIENT, created_at: 1793268750n, deadline: 1793272350n,
  delivered_at: 1793268760n, rated: true, result_hash: new Uint8Array(32), status: 2,
};

describe('job status mapping', () => {
  it('matches JobStatus in lib.rs and docs/contract-v2.md', () => {
    expect(JobStatus).toEqual({ PENDING: 0, DELIVERED: 1, COMPLETED: 2, REFUNDED: 3 });
    expect([0, 1, 2, 3].map(jobStatusLabel)).toEqual(['Pending', 'Delivered', 'Completed', 'Refunded']);
  });

  it('rejects codes the contract does not define', () => {
    for (const bad of [-1, 4, 1.5, 'Completed', null, undefined]) {
      expect(() => parseJobStatus(bad)).toThrow(RangeError);
    }
  });

  it('normalizes a get_job result', () => {
    const job = normalizeJob(1, RAW_JOB);
    expect(job).toMatchObject({ id: 1n, client: CLIENT, agent: AGENT, amount: 10000000n, status: JobStatus.COMPLETED, rated: true });
    expect(normalizeJob(2, { ...RAW_JOB, delivered_at: null }).deliveredAt).toBeNull();
    expect(job.resultHash).toBe('0'.repeat(64));
    expect(normalizeJob(2, { ...RAW_JOB, result_hash: Uint8Array.from({ length: 32 }, (_, i) => i) }).resultHash)
      .toBe('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
    expect(normalizeJob(2, { ...RAW_JOB, result_hash: null }).resultHash).toBeNull();
    expect(() => normalizeJob(3, { ...RAW_JOB, status: 9 })).toThrow(RangeError);
  });
});

describe('deadline duration', () => {
  it('mirrors the contract bounds', () => {
    expect(MIN_DURATION_SECS).toBe(3600);
    expect(MAX_DURATION_SECS).toBe(2592000);
    expect(REVIEW_WINDOW_SECS).toBe(259200);
  });

  it('accepts whole hours from 1 to 720', () => {
    expect(durationHoursToSecs('1')).toBe(3600n);
    expect(durationHoursToSecs(24)).toBe(86400n);
    expect(durationHoursToSecs('720')).toBe(2592000n);
  });

  it('rejects values outside the bounds or not whole hours', () => {
    for (const bad of ['0', '721', '1.5', '-1', '', 'abc', null]) {
      expect(() => durationHoursToSecs(bad)).toThrow(RangeError);
    }
  });
});

describe('parseHireInput', () => {
  const price = 1_000_000_000n; // 100 XLM

  it('accepts amount >= price', () => {
    expect(parseHireInput({ amountXlm: '100', durationHours: '24', price })).toEqual({ amount: price, durationSecs: 86400n });
    expect(parseHireInput({ amountXlm: '150.5', durationHours: '1', price }).amount).toBe(1_505_000_000n);
  });

  it('rejects amount below price, zero and bad deadlines', () => {
    expect(() => parseHireInput({ amountXlm: '99.9999999', durationHours: '24', price })).toThrow(/below the agent's price \(100 XLM\)/);
    expect(() => parseHireInput({ amountXlm: '0', durationHours: '24', price: 1n })).toThrow(/greater than 0/);
    expect(() => parseHireInput({ amountXlm: '100', durationHours: '0', price })).toThrow(RangeError);
  });
});

describe('clientActions', () => {
  const base = normalizeJob(5, { ...RAW_JOB, status: 0, delivered_at: null, rated: false });

  it('offers refund only after the deadline while Pending', () => {
    expect(clientActions(base, CLIENT, base.deadline)).toEqual({ complete: false, refund: false, rate: false });
    expect(clientActions(base, CLIENT, base.deadline + 1n).refund).toBe(true);
  });

  it('offers complete while Delivered and rating once after Completed', () => {
    expect(clientActions({ ...base, status: JobStatus.DELIVERED }, CLIENT, 0n)).toEqual({ complete: true, refund: false, rate: false });
    expect(clientActions({ ...base, status: JobStatus.COMPLETED }, CLIENT, 0n).rate).toBe(true);
    expect(clientActions({ ...base, status: JobStatus.COMPLETED, rated: true }, CLIENT, 0n).rate).toBe(false);
    expect(clientActions({ ...base, status: JobStatus.REFUNDED }, CLIENT, base.deadline + 1n)).toEqual({ complete: false, refund: false, rate: false });
  });

  it('offers nothing to other addresses', () => {
    expect(clientActions({ ...base, status: JobStatus.DELIVERED }, AGENT, base.deadline + 1n)).toEqual({ complete: false, refund: false, rate: false });
    expect(clientActions(base, null, base.deadline + 1n).refund).toBe(false);
  });

  it('computes the end of the review window', () => {
    expect(reviewEndsAt(base)).toBeNull();
    expect(reviewEndsAt({ ...base, deliveredAt: 100n })).toBe(100n + 259200n);
  });
});

describe('agentActions', () => {
  const pending = normalizeJob(6, { ...RAW_JOB, status: 0, delivered_at: null, result_hash: null, rated: false });
  const delivered = { ...pending, status: JobStatus.DELIVERED, deliveredAt: 1_000_000n };
  const releaseAt = 1_000_000n + 259_200n;
  const none = { deliver: false, release: false, refund: false };

  it('lets the agent deliver while Pending, also after the deadline', () => {
    expect(agentActions(pending, AGENT, 0n)).toEqual({ deliver: true, release: false, refund: true });
    expect(agentActions(pending, AGENT, pending.deadline + 1_000_000n).deliver).toBe(true);
  });

  it('releases exactly at delivered_at + 72 h, not one second earlier', () => {
    expect(agentActions(delivered, AGENT, releaseAt - 1n)).toEqual({ deliver: false, release: false, refund: true });
    expect(agentActions(delivered, AGENT, releaseAt)).toEqual({ deliver: false, release: true, refund: true });
    expect(agentActions(delivered, AGENT, releaseAt + 1n).release).toBe(true);
  });

  it('lets anyone with a wallet release, but only the agent deliver or refund', () => {
    expect(agentActions(delivered, CLIENT, releaseAt)).toEqual({ deliver: false, release: true, refund: false });
    expect(agentActions(pending, CLIENT, 0n)).toEqual(none);
    expect(agentActions(delivered, null, releaseAt)).toEqual(none);
  });

  it('offers nothing on final states or a Delivered job without delivered_at', () => {
    expect(agentActions({ ...delivered, status: JobStatus.COMPLETED }, AGENT, releaseAt)).toEqual(none);
    expect(agentActions({ ...pending, status: JobStatus.REFUNDED }, AGENT, releaseAt)).toEqual(none);
    expect(agentActions({ ...delivered, deliveredAt: null }, AGENT, releaseAt).release).toBe(false);
  });

  it('sums earnings by status from a job scan', () => {
    const jobs = [
      { ...pending, amount: 1n }, { ...delivered, amount: 20n },
      { ...pending, status: JobStatus.COMPLETED, amount: 300n }, { ...pending, status: JobStatus.COMPLETED, amount: 4000n },
      { ...pending, status: JobStatus.REFUNDED, amount: 50000n },
    ];
    expect(agentEarnings(jobs)).toEqual({ paid: 4300n, awaitingRelease: 20n, pending: 1n, refunded: 50000n });
    expect(agentEarnings([])).toEqual({ paid: 0n, awaitingRelease: 0n, pending: 0n, refunded: 0n });
  });
});

describe('formatDuration', () => {
  it('formats countdowns', () => {
    expect(formatDuration(93784)).toBe('1d 2h 3m');
    expect(formatDuration(3660)).toBe('1h 1m');
    expect(formatDuration(65)).toBe('1m 5s');
    expect(formatDuration(-5)).toBe('0m 0s');
  });
});

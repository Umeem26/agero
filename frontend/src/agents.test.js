import { describe, expect, it } from 'vitest';
import SAMPLE_AGENTS from './data/sample-agents.json';
import { SAMPLE_PREFIX, presentAgent } from './agents';

const onChain = (overrides) => ({
  owner: 'GOWNER', name: 'Custom Agent', description: 'Does custom work.', apiUrl: 'https://example.com',
  price: 10_000_000n, totalJobs: 0, ratingSum: 0n, ratingCount: 0, ...overrides,
});

describe('presentAgent', () => {
  it('shows a sample agent with the frontend description and category, not the older on-chain text', () => {
    const sample = SAMPLE_AGENTS[0];
    const a = presentAgent(onChain({ name: sample.name, description: `${SAMPLE_PREFIX}Older seed text with AI claims` }));
    expect(a.isSample).toBe(true);
    expect(a.summary).toBe(sample.description);
    expect(a.category).toBe(sample.category);
  });

  it('falls back to the on-chain text (without the prefix) for a sample name it does not know', () => {
    const a = presentAgent(onChain({ name: 'Unknown Sample', description: `${SAMPLE_PREFIX}Seeded elsewhere.` }));
    expect(a.isSample).toBe(true);
    expect(a.summary).toBe('Seeded elsewhere.');
    expect(a.category).toBe('Other');
  });

  it('shows a real agent exactly as stored in the contract', () => {
    const a = presentAgent(onChain({ name: SAMPLE_AGENTS[0].name, ratingSum: 9n, ratingCount: 2 }));
    expect(a.isSample).toBe(false);
    expect(a.summary).toBe('Does custom work.');
    expect(a.averageRating).toBe(4.5);
  });
});

describe('sample-agents.json', () => {
  it('makes no AI, speed, live-data or capacity claims in the descriptions', () => {
    for (const a of SAMPLE_AGENTS) {
      expect(a.description).not.toMatch(/\bAI\b|instant|real.?time|ultra|\d+\+|4K/i);
      expect(a.description).not.toContain('"'); // seed-agents.ps1 rejects double quotes
    }
  });
});

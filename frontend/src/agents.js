import SAMPLE_AGENTS from './data/sample-agents.json';

// scripts/seed-agents.ps1 registers the sample agents with this description prefix
export const SAMPLE_PREFIX = 'Sample agent - ';
const SAMPLE_BY_NAME = new Map(SAMPLE_AGENTS.map((a) => [a.name, a]));

// On-chain agent -> what the UI shows. Image and category exist only in this frontend
// (the contract stores neither), and only for the seeded sample agents.
export function presentAgent(agent) {
  const isSample = agent.description.startsWith(SAMPLE_PREFIX);
  const extra = isSample ? SAMPLE_BY_NAME.get(agent.name) : undefined;
  return {
    ...agent,
    isSample,
    summary: isSample ? agent.description.slice(SAMPLE_PREFIX.length) : agent.description,
    category: extra?.category ?? 'Other',
    image: extra?.image ?? null,
    averageRating: agent.ratingCount > 0 ? Number(agent.ratingSum) / agent.ratingCount : 0,
  };
}

export const shortAddress = (address) => (address ? `${address.slice(0, 4)}…${address.slice(-4)}` : '');

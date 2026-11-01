// The agent's signing key, read once from AGERO_AGENT_SECRET (docs/fase5-design.md §6).
// Only the public key and a sign function leave this module; the secret string is never kept,
// printed, logged or written anywhere.
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { AgentError } from './guard.js';

// `consume: true` removes the variable from `env` after reading, so later code cannot dump it
export function loadAgentKey(env = process.env, { consume = false } = {}) {
  const raw = env.AGERO_AGENT_SECRET;
  if (consume) delete env.AGERO_AGENT_SECRET;
  if (!raw || !StrKey.isValidEd25519SecretSeed(String(raw).trim())) {
    throw new AgentError('MISCONFIGURED', 'AGERO_AGENT_SECRET is missing or is not a valid secret key.');
  }
  const keypair = Keypair.fromSecret(String(raw).trim());
  const publicKey = keypair.publicKey();
  return Object.freeze({
    publicKey,
    signTransaction(tx) {
      tx.sign(keypair);
      return tx;
    },
    toJSON: () => ({ publicKey }),
  });
}

// The key must own a registered agent on the contract (and match AGERO_AGENT_ADDRESS when set).
// `fetchAgent(address)` -> normalized agent or null (chain.getAgent).
export async function verifyAgentOwner(key, fetchAgent, expectedAgent = null) {
  if (expectedAgent && expectedAgent !== key.publicKey) {
    throw new AgentError('MISCONFIGURED', `AGERO_AGENT_SECRET belongs to ${key.publicKey}, but AGERO_AGENT_ADDRESS is ${expectedAgent}.`);
  }
  const agent = await fetchAgent(key.publicKey);
  if (!agent) throw new AgentError('MISCONFIGURED', `No agent is registered on the contract for ${key.publicKey}. Run scripts/register-real-agent.ps1 first.`);
  if (agent.owner !== key.publicKey) throw new AgentError('MISCONFIGURED', `get_agent returned owner ${agent.owner}, expected ${key.publicKey}.`);
  return agent;
}

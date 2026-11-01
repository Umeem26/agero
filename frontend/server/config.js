// Server-side configuration for the real agent (docs/fase5-design.md §6, §9).
// Read from the environment once; the Testnet passphrase is hardcoded and never read from env.
import { StrKey } from '@stellar/stellar-sdk';

export const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
export const DEFAULT_RPC_URL = 'https://soroban-testnet.stellar.org';
// Hosts the agent may send transactions through; anything else is refused by the guard
export const RPC_HOST_ALLOWLIST = Object.freeze(['soroban-testnet.stellar.org']);

export const LIMITS = Object.freeze({
  safetyMarginSecs: 300, // §7.2: minimum time left before the job deadline
  maxInputBytes: 1024, // canonical input JSON
  maxResultBytes: 64 * 1024,
  executorTimeoutMs: 20_000,
  executorRetryDelaysMs: Object.freeze([2_000, 4_000]), // transient executor errors, inside the timeout
  txTimeoutSecs: 60, // deliver/refund transactions cannot land after this (setTimeout)
  jobLockSecs: 120, // one processor per job; expires if the process dies
  agentTxLockSecs: 60, // serializes the agent account's sequence numbers
  recordTtlSecs: 40 * 24 * 3600, // > 30-day max deadline + 72 h review window
});

const truthy = (v) => /^(1|true|yes|on)$/i.test(String(v ?? '').trim());

// env -> frozen config. Never holds the agent secret (see agent-key.js).
export function loadConfig(env = process.env) {
  const contractId = String(env.AGERO_CONTRACT_ID ?? '').trim();
  return Object.freeze({
    network: String(env.AGERO_NETWORK ?? '').trim().toLowerCase(),
    networkPassphrase: TESTNET_PASSPHRASE,
    rpcUrl: String(env.AGERO_RPC_URL || DEFAULT_RPC_URL).trim(),
    contractId,
    agentEnabled: truthy(env.AGERO_AGENT_ENABLED),
    expectedAgent: String(env.AGERO_AGENT_ADDRESS ?? '').trim() || null,
    executor: String(env.AGERO_EXECUTOR || 'contract-inspector').trim(),
    domain: String(env.AGERO_DOMAIN || 'agero.vercel.app').trim(),
    limits: LIMITS,
  });
}

// Problems that need no network to detect; [] when the config is usable
export function configProblems(cfg) {
  const out = [];
  if (cfg.network !== 'testnet') out.push(`AGERO_NETWORK must be "testnet" (got "${cfg.network}")`);
  if (!StrKey.isValidContract(cfg.contractId)) out.push('AGERO_CONTRACT_ID is not a valid contract address (C...)');
  if (cfg.expectedAgent && !StrKey.isValidEd25519PublicKey(cfg.expectedAgent)) out.push('AGERO_AGENT_ADDRESS is not a valid account address (G...)');
  return out;
}

// Refuses to run anywhere but Testnet, and only while AGERO_AGENT_ENABLED is on (docs/fase5-design.md §6).
import { TESTNET_PASSPHRASE, RPC_HOST_ALLOWLIST, configProblems } from './config.js';

export class AgentError extends Error {
  constructor(code, message, { permanent = true, cause, details } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'AgentError';
    this.code = code;
    this.permanent = permanent;
    if (details) this.details = details;
  }
}

// Stellar secret seeds (S + 55 base32 chars) never reach a log line
const SECRET_SEED = /S[A-Z2-7]{55}/g;
export const redact = (text) => String(text ?? '').replace(SECRET_SEED, '[redacted]');

// Static checks: network name, passphrase constant, RPC host. Throws AgentError MISCONFIGURED.
export function assertTestnetConfig(cfg) {
  const problems = configProblems(cfg);
  if (cfg.networkPassphrase !== TESTNET_PASSPHRASE) problems.push('network passphrase is not the Testnet passphrase');
  let url = null;
  try { url = new URL(cfg.rpcUrl); } catch { problems.push('AGERO_RPC_URL is not a URL'); }
  if (url && url.protocol !== 'https:') problems.push('AGERO_RPC_URL must use https');
  if (url && !RPC_HOST_ALLOWLIST.includes(url.hostname)) problems.push(`AGERO_RPC_URL host "${url.hostname}" is not allowed (Testnet only: ${RPC_HOST_ALLOWLIST.join(', ')})`);
  if (problems.length) throw new AgentError('MISCONFIGURED', `Refusing to start: ${problems.join('; ')}.`);
}

export function assertEnabled(cfg) {
  if (!cfg.agentEnabled) throw new AgentError('AGENT_DISABLED', 'The agent is switched off (set AGERO_AGENT_ENABLED=true to run it).');
}

// Asks the RPC which network it serves; refuses anything that is not Testnet (e.g. a Mainnet RPC URL)
export async function assertRpcIsTestnet(server) {
  let passphrase;
  try {
    ({ passphrase } = await server.getNetwork());
  } catch (err) {
    throw new AgentError('CHAIN_UNAVAILABLE', `Could not ask the RPC for its network: ${redact(err?.message ?? err)}`, { permanent: false });
  }
  if (passphrase !== TESTNET_PASSPHRASE) {
    throw new AgentError('MISCONFIGURED', `Refusing to start: the RPC serves "${passphrase}", not Testnet.`);
  }
}

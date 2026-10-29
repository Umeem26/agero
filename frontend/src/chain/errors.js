// Turns contract, token, wallet and RPC failures into short English messages for the UI.

// #[contracterror] enum Error in contracts/agero-contract/src/lib.rs
export const CONTRACT_ERRORS = Object.freeze({
  1: 'Agent not found: this address has no agent registered on the contract.',
  2: 'Job not found.',
  3: 'This address already has a registered agent.',
  4: "Not allowed: only this job's client (or its agent) can do that.",
  5: 'You cannot hire your own agent.',
  6: 'Invalid price: it must be greater than 0.',
  7: 'Invalid amount: it must be greater than 0 XLM.',
  8: "Amount is below the agent's price.",
  9: 'Invalid deadline: choose between 1 hour and 30 days.',
  10: "That action is not allowed in the job's current status. Refresh the job and try again.",
  11: 'Too early: the deadline has not passed yet.',
  12: 'Rating must be between 1 and 5 stars.',
  13: 'You already rated this job.',
  14: 'Number overflow in the contract.',
});

// Native XLM Stellar Asset Contract errors that a transfer can raise
const TOKEN_ERRORS = Object.freeze({
  6: 'Your account does not exist on this network. Fund it with Friendbot first.',
  8: 'Invalid amount.',
  10: 'Insufficient XLM balance. Keep the 1 XLM base reserve plus fees on top of the escrow amount.',
});

export class ChainError extends Error {
  constructor(message, { kind = 'unknown', code = null, hash = null, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ChainError';
    this.kind = kind; // contract | token | auth | wallet | network | rpc | tx | input | unknown
    this.code = code;
    this.hash = hash;
  }
}

const ERROR_EVENT = /contract:(C[A-Z2-7]{55}), topics:\[error, Error\(Contract, #(\d+)\)\]/g;

// Parse a simulation error string (HostError + diagnostic event log, newest event first).
// The oldest error event is where the failure started, which tells our contract apart from the XLM token.
export function describeSimulationError(text, { contractId, tokenId } = {}) {
  const raw = String(text ?? '');
  const events = [...raw.matchAll(ERROR_EVENT)];
  let origin = events.length ? { contract: events[events.length - 1][1], code: Number(events[events.length - 1][2]) } : null;
  if (!origin) {
    const head = raw.match(/Error\(Contract, #(\d+)\)/);
    if (head) origin = { contract: contractId, code: Number(head[1]) };
  }

  if (origin && tokenId && origin.contract === tokenId) {
    return { kind: 'token', code: origin.code, message: TOKEN_ERRORS[origin.code] || `XLM transfer failed (token error #${origin.code}).` };
  }
  if (origin && (!contractId || origin.contract === contractId)) {
    return { kind: 'contract', code: origin.code, message: CONTRACT_ERRORS[origin.code] || `Contract error #${origin.code}.` };
  }
  if (/Error\(Auth,/.test(raw)) {
    return { kind: 'auth', code: null, message: 'Authorization failed: the connected wallet is not allowed to make this call.' };
  }
  if (/Error\(Budget,/.test(raw)) {
    return { kind: 'rpc', code: null, message: 'The call exceeded the network resource limits.' };
  }
  const firstLine = raw.split('\n')[0].trim().slice(0, 200);
  return { kind: 'unknown', code: null, message: firstLine ? `Simulation failed: ${firstLine}` : 'Simulation failed.' };
}

// Freighter returns { code, message } objects instead of throwing
export function describeWalletError(error) {
  const message = typeof error === 'string' ? error : error?.message || '';
  if (error?.code === -4 || /reject|declin|denied|cancel/i.test(message)) {
    return 'Request rejected in Freighter. Nothing was signed or sent.';
  }
  return message ? `Freighter: ${message}` : 'Freighter returned an unknown error.';
}

// Any error -> one message for a toast or inline error
export function friendlyError(err) {
  if (err instanceof ChainError || err instanceof RangeError) return err.message;
  const message = String(err?.message || err || '');
  if (/Failed to fetch|NetworkError|ERR_NETWORK|Load failed|ECONNREFUSED|ENOTFOUND/i.test(message)) {
    return 'Cannot reach the Stellar RPC server. Check your connection and try again.';
  }
  if (/^Account not found/i.test(message)) {
    return 'Your account does not exist on Testnet yet. Fund it with Friendbot, then try again.';
  }
  return message || 'Something went wrong.';
}

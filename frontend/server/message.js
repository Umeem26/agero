// SEP-53 challenge messages (docs/fase5-design.md §3.3). The server writes the text; the client
// signs it unchanged with its wallet; the server parses it strictly and checks every line.
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { TESTNET_PASSPHRASE } from './config.js';

const TITLE = 'Agero task request v1';
const FIELDS = {
  submit: ['Purpose', 'Domain', 'Network', 'Contract', 'Job', 'Client', 'Input SHA-256', 'Nonce', 'Expires'],
  read: ['Purpose', 'Domain', 'Network', 'Contract', 'Job', 'Client', 'Nonce', 'Expires'],
};
const KEYS = {
  Purpose: 'purpose', Domain: 'domain', Network: 'network', Contract: 'contract', Job: 'jobId',
  Client: 'client', 'Input SHA-256': 'inputSha256', Nonce: 'nonce', Expires: 'expires',
};
const HEX64 = /^[0-9a-f]{64}$/;
const NONCE = /^[0-9a-f]{32}$/;
const ISO_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const JOB_ID = /^[1-9]\d{0,19}$/;

const isoSeconds = (unix) => new Date(unix * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** Fields -> message text. `expiresAt` is a Unix time in seconds. */
export function buildChallenge({ purpose, domain, contract, jobId, client, inputSha256, nonce, expiresAt }) {
  const values = {
    purpose, domain, network: TESTNET_PASSPHRASE, contract, jobId: String(jobId), client,
    inputSha256, nonce, expires: isoSeconds(expiresAt),
  };
  const fields = FIELDS[purpose];
  if (!fields) throw new RangeError(`Unknown purpose "${purpose}".`);
  return [TITLE, ...fields.map((f) => `${f}: ${values[KEYS[f]]}`)].join('\n');
}

/** Message text -> fields. Throws RangeError on anything but the exact layout of buildChallenge. */
export function parseChallenge(text) {
  const lines = String(text ?? '').split('\n');
  if (lines[0] !== TITLE) throw new RangeError('Not an Agero challenge.');
  const purpose = /^Purpose: (submit|read)$/.exec(lines[1] ?? '')?.[1];
  if (!purpose) throw new RangeError('Unknown purpose line.');
  const fields = FIELDS[purpose];
  if (lines.length !== fields.length + 1) throw new RangeError('Wrong number of lines.');
  const out = {};
  fields.forEach((f, i) => {
    const line = lines[i + 1];
    const prefix = `${f}: `;
    if (!line.startsWith(prefix)) throw new RangeError(`Line ${i + 2} must start with "${prefix}".`);
    out[KEYS[f]] = line.slice(prefix.length);
  });
  if (out.network !== TESTNET_PASSPHRASE) throw new RangeError('Wrong network.');
  if (!StrKey.isValidContract(out.contract)) throw new RangeError('Bad contract address.');
  if (!JOB_ID.test(out.jobId)) throw new RangeError('Bad job ID.');
  if (!StrKey.isValidEd25519PublicKey(out.client)) throw new RangeError('Bad client address.');
  if (purpose === 'submit' && !HEX64.test(out.inputSha256)) throw new RangeError('Bad input hash.');
  if (!NONCE.test(out.nonce)) throw new RangeError('Bad nonce.');
  if (!ISO_SECONDS.test(out.expires)) throw new RangeError('Bad expiry.');
  return { ...out, expiresAt: Date.parse(out.expires) / 1000 };
}

/**
 * Compare a parsed challenge with what this request expects.
 * Returns null when it matches, otherwise the name of the first field that does not.
 * (Nonce existence and one-time use are the store's job, phase 5b.)
 */
export function challengeMismatch(parsed, { purpose, domain, contract, jobId, client, inputSha256 }, nowUnix) {
  const expected = { purpose, domain, contract, jobId: String(jobId), client };
  if (purpose === 'submit') expected.inputSha256 = inputSha256;
  for (const [k, v] of Object.entries(expected)) if (parsed[k] !== v) return k;
  if (!(parsed.expiresAt > nowUnix)) return 'expires';
  return null;
}

// Wallets return the signature as base64 text or as bytes; anything else is rejected
function signatureBytes(signature) {
  if (signature instanceof Uint8Array) return signature;
  if (typeof signature === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(signature)) return Buffer.from(signature, 'base64');
  return null;
}

/** SEP-53 verification: true only for a 64-byte ed25519 signature of `message` by `address`. */
export function verifySignature(address, message, signature) {
  if (!StrKey.isValidEd25519PublicKey(address)) return false;
  const sig = signatureBytes(signature);
  if (!sig || sig.length !== 64) return false;
  try {
    return Keypair.fromPublicKey(address).verifyMessage(message, sig);
  } catch {
    return false;
  }
}

// SHA-256 result hashes for deliver_job (BytesN<32>), computed locally with Web Crypto.
// Nothing here sends data anywhere: the bytes stay in the browser and only the 32-byte digest is used.
import { ChainError } from './errors';

export const HASH_BYTES = 32;
// Web Crypto has no streaming digest, so the whole file is read into memory
export const MAX_HASH_FILE_BYTES = 200 * 1024 * 1024;
const HEX64 = /^[0-9a-f]{64}$/;

export const bytesToHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export function hexToBytes(hex) {
  const clean = normalizeHashHex(hex);
  const out = new Uint8Array(HASH_BYTES);
  for (let i = 0; i < HASH_BYTES; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// Pasted hash -> lowercase 64-char hex. Accepts surrounding spaces and an optional 0x prefix.
export function normalizeHashHex(input) {
  const text = String(input ?? '').trim().replace(/^0x/i, '').toLowerCase();
  if (!HEX64.test(text)) {
    throw new RangeError('A result hash is 64 hexadecimal characters (0-9, a-f), e.g. the output of sha256sum.');
  }
  return text;
}

export const isHashHex = (input) => {
  try { normalizeHashHex(input); return true; } catch { return false; }
};

function subtle() {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new ChainError('This browser cannot compute SHA-256 (Web Crypto is only available on https or localhost).', { kind: 'input' });
  return s;
}

// Uint8Array | ArrayBuffer | string (UTF-8, exactly as given) -> lowercase hex
export async function sha256Hex(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return bytesToHex(new Uint8Array(await subtle().digest('SHA-256', bytes)));
}

export async function sha256File(file) {
  if (file.size > MAX_HASH_FILE_BYTES) {
    throw new RangeError(`File is too large to hash in the browser (limit ${MAX_HASH_FILE_BYTES / (1024 * 1024)} MB).`);
  }
  return sha256Hex(await file.arrayBuffer());
}

// Compare a locally computed hash with the one stored in the job. Both may be null/invalid.
export function hashesMatch(a, b) {
  if (!isHashHex(a) || !isHashHex(b)) return false;
  return normalizeHashHex(a) === normalizeHashHex(b);
}

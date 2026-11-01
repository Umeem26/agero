// Key-value store behind one interface (docs/fase5-design.md §5.2). Phase 5a ships a memory store
// (tests) and a JSON file store (local CLI, single process); phase 5b adds Upstash Redis.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * @typedef {object} Store   values are JSON-serializable; ttlSecs is optional everywhere
 * @property {(key: string) => Promise<any>} get                      null when missing or expired
 * @property {(key: string, value: any, opts?: {ttlSecs?: number}) => Promise<void>} set
 * @property {(key: string, value: any, opts?: {ttlSecs?: number}) => Promise<boolean>} setNX   true if this call created it
 * @property {(key: string) => Promise<void>} del
 * @property {(key: string) => Promise<any>} getdel                   atomic read-and-delete (nonces)
 * @property {(key: string, opts?: {ttlSecs?: number}) => Promise<number>} incr   counter; ttl set on creation
 */

export const KEY_PREFIX = 'agero:v1:';
export const keys = {
  job: (contractId, jobId) => `${KEY_PREFIX}job:${contractId}:${jobId}`,
  jobLock: (contractId, jobId) => `${KEY_PREFIX}lock:job:${contractId}:${jobId}`,
  agentTxLock: () => `${KEY_PREFIX}lock:agent-tx`,
  nonce: (nonce) => `${KEY_PREFIX}nonce:${nonce}`,
};

// Shared logic for both local stores; `persist` is called after every change
function mapStore(entries, persist, now) {
  const live = (key) => {
    const e = entries.get(key);
    if (!e) return null;
    if (e.expiresAt != null && e.expiresAt <= now()) { entries.delete(key); return null; }
    return e;
  };
  const expiry = (ttlSecs) => (ttlSecs ? now() + ttlSecs * 1000 : null);
  const copy = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)));
  return {
    async get(key) { return copy(live(key)?.value); },
    async set(key, value, { ttlSecs } = {}) { entries.set(key, { value: copy(value), expiresAt: expiry(ttlSecs) }); persist(); },
    async setNX(key, value, { ttlSecs } = {}) {
      if (live(key)) return false;
      entries.set(key, { value: copy(value), expiresAt: expiry(ttlSecs) });
      persist();
      return true;
    },
    async del(key) { entries.delete(key); persist(); },
    async getdel(key) {
      const e = live(key);
      entries.delete(key);
      persist();
      return copy(e?.value);
    },
    async incr(key, { ttlSecs } = {}) {
      const e = live(key);
      const value = (e ? Number(e.value) : 0) + 1;
      entries.set(key, { value, expiresAt: e ? e.expiresAt : expiry(ttlSecs) });
      persist();
      return value;
    },
  };
}

/** In-memory store; `now()` returns milliseconds (tests pass a fake clock). */
export function createMemoryStore({ now = Date.now } = {}) {
  return mapStore(new Map(), () => {}, now);
}

/** JSON file store for the local CLI: one process at a time, written with a temp file + rename. */
export function createFileStore(path, { now = Date.now } = {}) {
  const entries = new Map(existsSync(path) ? Object.entries(JSON.parse(readFileSync(path, 'utf8'))) : []);
  const persist = () => {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(entries), null, 2));
    renameSync(tmp, path);
  };
  return mapStore(entries, persist, now);
}

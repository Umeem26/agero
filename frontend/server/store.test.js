import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createFileStore, createMemoryStore, keys } from './store.js';
import { canonicalJson } from './canonical.js';

const dirs = [];
afterEach(() => { while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true }); });

describe.each([
  ['memory', (now) => createMemoryStore({ now })],
  ['file', (now) => {
    const dir = mkdtempSync(join(tmpdir(), 'agero-store-'));
    dirs.push(dir);
    return createFileStore(join(dir, 'store.json'), { now });
  }],
])('%s store', (_, make) => {
  it('set/get/del with copies, setNX once, getdel once, incr', async () => {
    let t = 0;
    const s = make(() => t);
    const v = { a: 1 };
    await s.set('k', v);
    v.a = 2;
    expect(await s.get('k')).toEqual({ a: 1 });
    expect(await s.setNX('k', 'x')).toBe(false);
    expect(await s.setNX('n', 'x')).toBe(true);
    expect(await s.getdel('n')).toBe('x');
    expect(await s.getdel('n')).toBeNull();
    expect(await s.incr('c')).toBe(1);
    expect(await s.incr('c')).toBe(2);
    await s.del('k');
    expect(await s.get('k')).toBeNull();
  });

  it('expires keys by TTL', async () => {
    let t = 0;
    const s = make(() => t);
    await s.setNX('lock', 'a', { ttlSecs: 60 });
    t = 59_999;
    expect(await s.setNX('lock', 'b', { ttlSecs: 60 })).toBe(false);
    t = 60_000;
    expect(await s.get('lock')).toBeNull();
    expect(await s.setNX('lock', 'b', { ttlSecs: 60 })).toBe(true);
  });
});

it('file store survives a restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'agero-store-'));
  dirs.push(dir);
  const path = join(dir, 'nested', 'store.json');
  await createFileStore(path).set('k', { status: 'result_stored' });
  expect(await createFileStore(path).get('k')).toEqual({ status: 'result_stored' });
});

it('keys are namespaced by contract', () => {
  expect(keys.job('CA', '7')).toBe('agero:v1:job:CA:7');
  expect(keys.job('CB', '7')).not.toBe(keys.job('CA', '7'));
});

it('canonical JSON sorts keys and rejects non-JSON values', () => {
  expect(canonicalJson({ b: [1, { d: null, c: 'x' }], a: true })).toBe('{"a":true,"b":[1,{"c":"x","d":null}]}');
  expect(() => canonicalJson({ a: NaN })).toThrow(RangeError);
  expect(() => canonicalJson({ a: 1n })).toThrow(RangeError);
  expect(() => canonicalJson(new Date())).toThrow(RangeError);
});

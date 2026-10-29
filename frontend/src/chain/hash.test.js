import { describe, expect, it } from 'vitest';
import { MAX_HASH_FILE_BYTES, bytesToHex, hashesMatch, hexToBytes, isHashHex, normalizeHashHex, sha256File, sha256Hex } from './hash';

// FIPS 180-2 / NIST test vectors
const VECTORS = [
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
];
const HASH_ABC = VECTORS[1][1];

describe('sha256Hex', () => {
  it('matches the standard test vectors', async () => {
    for (const [input, digest] of VECTORS) expect(await sha256Hex(input)).toBe(digest);
  });

  it('hashes one million "a" characters', async () => {
    expect(await sha256Hex('a'.repeat(1_000_000))).toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
  });

  it('hashes bytes and text the same way (UTF-8, no trimming)', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe(HASH_ABC);
    expect(await sha256Hex(new Uint8Array([0x61, 0x62, 0x63]).buffer)).toBe(HASH_ABC);
    expect(await sha256Hex('abc\n')).not.toBe(HASH_ABC);
  });

  it('hashes a selected file locally', async () => {
    expect(await sha256File(new File(['abc'], 'result.txt'))).toBe(HASH_ABC);
    await expect(sha256File({ size: MAX_HASH_FILE_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(0) })).rejects.toThrow(/too large/);
  });
});

describe('hex validation', () => {
  it('normalizes pasted hashes', () => {
    expect(normalizeHashHex(`  ${HASH_ABC.toUpperCase()} `)).toBe(HASH_ABC);
    expect(normalizeHashHex(`0x${HASH_ABC}`)).toBe(HASH_ABC);
  });

  it('rejects anything that is not 32 bytes of hex', () => {
    const split = `${HASH_ABC.slice(0, 32)} ${HASH_ABC.slice(32)}`;
    for (const bad of ['', HASH_ABC.slice(1), `${HASH_ABC}0`, `${HASH_ABC.slice(1)}g`, 'xyz', null, undefined, split]) {
      expect(() => normalizeHashHex(bad)).toThrow(RangeError);
      expect(isHashHex(bad)).toBe(false);
    }
  });

  it('round-trips hex and bytes', () => {
    const bytes = hexToBytes(HASH_ABC);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(32);
    expect(bytes[0]).toBe(0xba);
    expect(bytesToHex(bytes)).toBe(HASH_ABC);
    expect(bytesToHex(new Uint8Array([0, 1, 255]))).toBe('0001ff');
  });

  it('compares a local hash with the stored one', () => {
    expect(hashesMatch(HASH_ABC, HASH_ABC.toUpperCase())).toBe(true);
    expect(hashesMatch(HASH_ABC, VECTORS[0][1])).toBe(false);
    expect(hashesMatch(HASH_ABC, null)).toBe(false);
    expect(hashesMatch('bad', 'bad')).toBe(false);
  });
});

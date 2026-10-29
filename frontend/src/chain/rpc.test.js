import { describe, expect, it } from 'vitest';
import { scValToNative } from '@stellar/stellar-sdk';
import { arg } from './rpc';

const HASH = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

// Argument encoding for the agent-side calls (register_agent, update_agent, deliver_job)
describe('contract arguments', () => {
  it('encodes result_hash as 32 raw bytes (BytesN<32>)', () => {
    const v = arg.bytes32(HASH.toUpperCase());
    expect(v.type).toBe('scvBytes');
    const bytes = scValToNative(v);
    expect(bytes.length).toBe(32);
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xba, 0x78, 0x16]);
  });

  it('refuses to encode an invalid hash', () => {
    expect(() => arg.bytes32('abc')).toThrow(RangeError);
  });

  it('encodes profile strings as ScString and price as i128', () => {
    expect(arg.string('Agent é').type).toBe('scvString');
    expect(scValToNative(arg.string('Agent é'))).toBe('Agent é');
    expect(arg.i128(125_000_000n).type).toBe('scvI128');
    expect(scValToNative(arg.i128(125_000_000n))).toBe(125_000_000n);
  });
});

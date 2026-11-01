import { describe, expect, it } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { buildChallenge, challengeMismatch, parseChallenge, verifySignature } from './message.js';

const CONTRACT = 'CA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB';
const client = Keypair.random();
const fields = (over = {}) => ({
  purpose: 'submit', domain: 'agero.vercel.app', contract: CONTRACT, jobId: '7', client: client.publicKey(),
  inputSha256: '3f'.repeat(32), nonce: '9b1e4c0f2a7d4e61b5a3c8d2f0e1a4b7', expiresAt: 1793534700, ...over,
});

describe('challenge text (§3.3)', () => {
  it('has the exact documented layout', () => {
    expect(buildChallenge(fields()).split('\n')).toEqual([
      'Agero task request v1',
      'Purpose: submit',
      'Domain: agero.vercel.app',
      'Network: Test SDF Network ; September 2015',
      `Contract: ${CONTRACT}`,
      'Job: 7',
      `Client: ${client.publicKey()}`,
      `Input SHA-256: ${'3f'.repeat(32)}`,
      'Nonce: 9b1e4c0f2a7d4e61b5a3c8d2f0e1a4b7',
      'Expires: 2026-11-01T12:05:00Z',
    ]);
  });

  it('read challenges have no input hash line', () => {
    const text = buildChallenge(fields({ purpose: 'read' }));
    expect(text).not.toContain('Input SHA-256');
    expect(parseChallenge(text).purpose).toBe('read');
  });

  it('round-trips', () => {
    const parsed = parseChallenge(buildChallenge(fields()));
    expect(parsed).toMatchObject({ purpose: 'submit', jobId: '7', client: client.publicKey(), expiresAt: 1793534700 });
    expect(challengeMismatch(parsed, fields(), 1793534699)).toBeNull();
  });

  const lines = () => buildChallenge(fields()).split('\n');
  it.each([
    ['an extra line', (l) => [...l, 'Extra: 1']],
    ['a missing line', (l) => l.slice(0, -1)],
    ['swapped lines', (l) => [l[0], l[1], l[3], l[2], ...l.slice(4)]],
    ['another network', (l) => l.map((x) => x.replace('Test SDF Network ; September 2015', 'Public Global Stellar Network ; September 2015'))],
    ['a bad title', (l) => ['Agero task request v2', ...l.slice(1)]],
    ['an unknown purpose', (l) => [l[0], 'Purpose: pay', ...l.slice(2)]],
    ['a bad nonce', (l) => l.map((x) => (x.startsWith('Nonce: ') ? 'Nonce: xyz' : x))],
    ['CRLF line endings', (l) => l.join('\r\n').split('\n')],
  ])('rejects %s', (_, edit) => {
    expect(() => parseChallenge(edit(lines()).join('\n'))).toThrow(RangeError);
  });

  it.each([
    ['domain', { domain: 'evil.example' }],
    ['jobId', { jobId: '8' }],
    ['inputSha256', { inputSha256: '00'.repeat(32) }],
    ['client', { client: Keypair.random().publicKey() }],
    ['purpose', { purpose: 'read' }],
  ])('reports a mismatching %s', (field, over) => {
    const parsed = parseChallenge(buildChallenge(fields()));
    expect(challengeMismatch(parsed, fields(over), 0)).toBe(field);
  });

  it('expires at the stated second', () => {
    const parsed = parseChallenge(buildChallenge(fields()));
    expect(challengeMismatch(parsed, fields(), 1793534700)).toBe('expires');
  });
});

describe('SEP-53 signatures', () => {
  const message = buildChallenge(fields());
  const sig = client.signMessage(message);

  it('accepts base64 and byte signatures from the right key', () => {
    expect(sig).toHaveLength(64);
    expect(verifySignature(client.publicKey(), message, Buffer.from(sig).toString('base64'))).toBe(true);
    expect(verifySignature(client.publicKey(), message, sig)).toBe(true);
    expect(verifySignature(client.publicKey(), message, Buffer.from(sig))).toBe(true);
  });

  it('rejects a changed message, another key and malformed signatures', () => {
    expect(verifySignature(client.publicKey(), message.replace('Job: 7', 'Job: 8'), sig)).toBe(false);
    expect(verifySignature(Keypair.random().publicKey(), message, sig)).toBe(false);
    expect(verifySignature(client.publicKey(), message, sig.slice(0, 63))).toBe(false);
    expect(verifySignature(client.publicKey(), message, 'not base64!')).toBe(false);
    expect(verifySignature(client.publicKey(), message, { signature: sig })).toBe(false);
    expect(verifySignature('GBAD', message, sig)).toBe(false);
  });

  it('signs the SEP-53 prefixed hash, not the raw message', () => {
    expect(client.verify(Buffer.from(message), Buffer.from(sig))).toBe(false);
  });
});

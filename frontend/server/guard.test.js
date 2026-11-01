import { describe, expect, it } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { loadConfig, TESTNET_PASSPHRASE } from './config.js';
import { AgentError, assertEnabled, assertRpcIsTestnet, assertTestnetConfig, redact } from './guard.js';
import { loadAgentKey, verifyAgentOwner } from './agent-key.js';

const CONTRACT = 'CA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB';
const env = (over = {}) => ({ AGERO_NETWORK: 'testnet', AGERO_CONTRACT_ID: CONTRACT, AGERO_AGENT_ENABLED: 'true', ...over });
const code = (fn) => { try { fn(); } catch (err) { return err.code; } return null; };

describe('network guard', () => {
  it('accepts the Testnet defaults', () => {
    const cfg = loadConfig(env());
    expect(cfg.networkPassphrase).toBe(TESTNET_PASSPHRASE);
    expect(cfg.rpcUrl).toBe('https://soroban-testnet.stellar.org');
    expect(() => assertTestnetConfig(cfg)).not.toThrow();
  });

  it.each([
    ['network mainnet', { AGERO_NETWORK: 'mainnet' }],
    ['network missing', { AGERO_NETWORK: undefined }],
    ['a Mainnet RPC host', { AGERO_RPC_URL: 'https://mainnet.sorobanrpc.com' }],
    ['plain http', { AGERO_RPC_URL: 'http://soroban-testnet.stellar.org' }],
    ['not a URL', { AGERO_RPC_URL: 'soroban-testnet' }],
    ['a bad contract ID', { AGERO_CONTRACT_ID: 'CA5C' }],
    ['a bad expected agent', { AGERO_AGENT_ADDRESS: 'GBAD' }],
  ])('refuses %s', (_, over) => {
    expect(code(() => assertTestnetConfig(loadConfig(env(over))))).toBe('MISCONFIGURED');
  });

  it('ignores any passphrase from the environment', () => {
    const cfg = loadConfig(env({ AGERO_NETWORK_PASSPHRASE: 'Public Global Stellar Network ; September 2015' }));
    expect(cfg.networkPassphrase).toBe(TESTNET_PASSPHRASE);
  });

  it('refuses a tampered passphrase constant', () => {
    expect(code(() => assertTestnetConfig({ ...loadConfig(env()), networkPassphrase: 'Public Global Stellar Network ; September 2015' }))).toBe('MISCONFIGURED');
  });

  it('kill switch is off unless explicitly true', () => {
    expect(code(() => assertEnabled(loadConfig(env({ AGERO_AGENT_ENABLED: undefined }))))).toBe('AGENT_DISABLED');
    expect(code(() => assertEnabled(loadConfig(env({ AGERO_AGENT_ENABLED: 'false' }))))).toBe('AGENT_DISABLED');
    expect(code(() => assertEnabled(loadConfig(env({ AGERO_AGENT_ENABLED: 'TRUE' }))))).toBeNull();
  });

  it('asks the RPC which network it serves', async () => {
    await expect(assertRpcIsTestnet({ getNetwork: async () => ({ passphrase: TESTNET_PASSPHRASE }) })).resolves.toBeUndefined();
    await expect(assertRpcIsTestnet({ getNetwork: async () => ({ passphrase: 'Public Global Stellar Network ; September 2015' }) }))
      .rejects.toMatchObject({ code: 'MISCONFIGURED' });
    await expect(assertRpcIsTestnet({ getNetwork: async () => { throw new Error('ECONNREFUSED'); } }))
      .rejects.toMatchObject({ code: 'CHAIN_UNAVAILABLE', permanent: false });
  });

  it('redacts secret seeds', () => {
    const secret = Keypair.random().secret();
    expect(redact(`boom ${secret} end`)).toBe('boom [redacted] end');
    expect(redact(`${secret}${secret}`)).toBe('[redacted][redacted]');
    expect(redact('GABC public keys stay')).toBe('GABC public keys stay');
  });
});

describe('agent key', () => {
  const kp = Keypair.random();

  it('exposes only the public key and a signer', () => {
    const e = { AGERO_AGENT_SECRET: kp.secret() };
    const key = loadAgentKey(e, { consume: true });
    expect(key.publicKey).toBe(kp.publicKey());
    expect('AGERO_AGENT_SECRET' in e).toBe(false);
    expect(JSON.stringify(key)).not.toContain(kp.secret());
    expect(Object.values(key).some((v) => typeof v === 'string' && v.startsWith('S'))).toBe(false);
  });

  it('rejects a missing or malformed secret without echoing it', () => {
    expect(code(() => loadAgentKey({}))).toBe('MISCONFIGURED');
    let msg = '';
    try { loadAgentKey({ AGERO_AGENT_SECRET: 'SNOTAREALSEED' }); } catch (err) { msg = err.message; }
    expect(msg).not.toContain('SNOTAREALSEED');
    expect(code(() => loadAgentKey({ AGERO_AGENT_SECRET: kp.publicKey() }))).toBe('MISCONFIGURED');
  });

  it('must own a registered agent on the contract', async () => {
    const key = loadAgentKey({ AGERO_AGENT_SECRET: kp.secret() });
    const agent = { owner: kp.publicKey(), name: 'Contract Inspector' };
    await expect(verifyAgentOwner(key, async () => agent)).resolves.toBe(agent);
    await expect(verifyAgentOwner(key, async () => null)).rejects.toBeInstanceOf(AgentError);
    await expect(verifyAgentOwner(key, async () => ({ ...agent, owner: Keypair.random().publicKey() }))).rejects.toMatchObject({ code: 'MISCONFIGURED' });
    await expect(verifyAgentOwner(key, async () => agent, Keypair.random().publicKey())).rejects.toMatchObject({ code: 'MISCONFIGURED' });
  });
});

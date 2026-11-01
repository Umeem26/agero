import { describe, expect, it } from 'vitest';
import { Account, Keypair, SorobanDataBuilder, nativeToScVal, scValToNative } from '@stellar/stellar-sdk';
import { createChain, INVALID_STATE } from './chain.js';
import { loadAgentKey } from './agent-key.js';
import { LIMITS, TESTNET_PASSPHRASE } from './config.js';

const CONTRACT = 'CA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB';
const config = { contractId: CONTRACT, rpcUrl: 'https://soroban-testnet.stellar.org', networkPassphrase: TESTNET_PASSPHRASE, limits: LIMITS };
const kp = Keypair.random();
const signer = loadAgentKey({ AGERO_AGENT_SECRET: kp.secret() });

const simOk = (retval = nativeToScVal(null)) => ({
  _parsed: true, id: '1', latestLedger: 100, events: [], minResourceFee: '100',
  transactionData: new SorobanDataBuilder(), result: { auth: [], retval },
});

// Records every transaction it receives; `sends` scripts the sendTransaction answers in order
function fakeServer({ sends = [{ status: 'PENDING' }], sim = simOk(), final = { status: 'SUCCESS', ledger: 7 } } = {}) {
  const log = { sims: [], sent: [], seq: 0 };
  return {
    log,
    getAccount: async (id) => new Account(id, String(log.seq++)),
    simulateTransaction: async (tx) => { log.sims.push(tx); return typeof sim === 'function' ? sim(tx) : sim; },
    sendTransaction: async (tx) => {
      log.sent.push(tx);
      const next = sends.length > 1 ? sends.shift() : sends[0];
      return { hash: hex(tx.hash()), ...next };
    },
    pollTransaction: async () => final,
    getTransaction: async () => ({ status: 'NOT_FOUND', latestLedger: 5000, latestLedgerCloseTime: '1700000000' }),
  };
}

const invocation = (tx) => tx.operations[0].func.invokeContract;
const opArgs = (tx) => invocation(tx).args;
const hex = (bytes) => Buffer.from(bytes).toString('hex');

describe('chain writes', () => {
  it('builds, signs with the agent key on Testnet and reports the hash before polling', async () => {
    const server = fakeServer();
    const chain = createChain({ config, signer, server });
    const sent = [];
    const res = await chain.deliverJob('7', 'ab'.repeat(32), { onSent: (s) => { sent.push(s); } });
    const tx = server.log.sent[0];
    expect(tx.source).toBe(kp.publicKey());
    expect(tx.networkPassphrase).toBe(TESTNET_PASSPHRASE);
    expect(tx.signatures).toHaveLength(1);
    expect(kp.verify(Buffer.from(tx.hash()), Buffer.from(tx.signatures[0].signature.value))).toBe(true);
    expect(invocation(tx).functionName.toString()).toBe('deliver_job');
    const left = Number(tx.timeBounds.maxTime) - Date.now() / 1000;
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThanOrEqual(LIMITS.txTimeoutSecs);
    expect(sent).toEqual([{ hash: res.hash, maxTime: Number(tx.timeBounds.maxTime) }]);
    expect(res).toMatchObject({ hash: hex(tx.hash()), ledger: 7 });
  });

  it('refund_job passes the agent as caller', async () => {
    const server = fakeServer();
    await createChain({ config, signer, server }).refundJob('7');
    const args = opArgs(server.log.sent[0]);
    expect(args.map((a) => scValToNative(a))).toEqual([7n, kp.publicKey()]);
  });

  it('txBadSeq: rebuilds with a fresh sequence and sends once more', async () => {
    const server = fakeServer({ sends: [{ status: 'ERROR', errorResult: { result: { type: 'txBadSeq' } } }, { status: 'PENDING' }] });
    await createChain({ config, signer, server }).deliverJob('7', 'ab'.repeat(32));
    expect(server.log.sent).toHaveLength(2);
    expect(server.log.sent[0].sequence).not.toBe(server.log.sent[1].sequence);
  });

  it('TRY_AGAIN_LATER: waits, resends the same signed transaction once, then gives up', async () => {
    const waits = [];
    const server = fakeServer({ sends: [{ status: 'TRY_AGAIN_LATER' }, { status: 'PENDING' }] });
    await createChain({ config, signer, server, sleep: async (ms) => { waits.push(ms); } }).deliverJob('7', 'ab'.repeat(32));
    expect(waits).toEqual([5000]);
    expect(hex(server.log.sent[0].hash())).toBe(hex(server.log.sent[1].hash()));

    const busy = fakeServer({ sends: [{ status: 'TRY_AGAIN_LATER' }] });
    await expect(createChain({ config, signer, server: busy, sleep: async () => {} }).deliverJob('7', 'ab'.repeat(32)))
      .rejects.toMatchObject({ code: 'CHAIN_UNAVAILABLE', permanent: false });
    expect(busy.log.sent).toHaveLength(2);
  });

  it('contract errors from simulation carry the contract code (InvalidState = 10)', async () => {
    const server = fakeServer({ sim: { id: '1', latestLedger: 1, events: [], _parsed: true, error: 'HostError: Error(Contract, #10)' } });
    await expect(createChain({ config, signer, server }).deliverJob('7', 'ab'.repeat(32)))
      .rejects.toMatchObject({ code: 'CONTRACT_REJECTED', details: { method: 'deliver_job', contractCode: INVALID_STATE } });
    expect(server.log.sent).toHaveLength(0);
  });

  it('failed and unconfirmed transactions keep their hash', async () => {
    await expect(createChain({ config, signer, server: fakeServer({ final: { status: 'FAILED' } }) }).refundJob('7'))
      .rejects.toMatchObject({ code: 'TX_FAILED' });
    await expect(createChain({ config, signer, server: fakeServer({ final: { status: 'NOT_FOUND' } }) }).refundJob('7'))
      .rejects.toMatchObject({ code: 'CHAIN_UNAVAILABLE', details: { pending: true } });
  });

  it('network failures become retryable CHAIN_UNAVAILABLE and never leak a secret', async () => {
    const server = { ...fakeServer(), getAccount: async () => { throw new Error(`boom ${kp.secret()}`); } };
    const err = await createChain({ config, signer, server }).deliverJob('7', 'ab'.repeat(32)).catch((e) => e);
    expect(err).toMatchObject({ code: 'CHAIN_UNAVAILABLE', permanent: false });
    expect(err.message).not.toContain(kp.secret());
  });

  it('writes need a key', async () => {
    await expect(createChain({ config, server: fakeServer() }).refundJob('7')).rejects.toMatchObject({ code: 'MISCONFIGURED' });
  });
});

describe('chain reads', () => {
  it('get_job via simulation -> normalized job; empty -> null', async () => {
    const raw = nativeToScVal({
      agent: nativeToScVal(kp.publicKey(), { type: 'address' }), amount: nativeToScVal(10_000_000n, { type: 'i128' }),
      client: nativeToScVal(kp.publicKey(), { type: 'address' }), created_at: nativeToScVal(1n, { type: 'u64' }),
      deadline: nativeToScVal(3601n, { type: 'u64' }), delivered_at: nativeToScVal(null), rated: false,
      result_hash: nativeToScVal(null), status: nativeToScVal(0, { type: 'u32' }),
    });
    const job = await createChain({ config, server: fakeServer({ sim: simOk(raw) }) }).getJob('7');
    expect(job).toMatchObject({ id: 7n, agent: kp.publicKey(), amount: 10_000_000n, status: 0, deadline: 3601n, resultHash: null });
    expect(await createChain({ config, server: fakeServer() }).getJob('8')).toBeNull();
  });

  it('ledgerNow reads the close time without decoding a ledger', async () => {
    expect(await createChain({ config, server: fakeServer() }).ledgerNow()).toEqual({ time: 1700000000n, ledger: 5000 });
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createContractInspector, MAX_WASM_BYTES } from './contract-inspector.js';
import { EXECUTOR_IDS, getExecutor } from './index.js';
import { sha256Hex } from '../canonical.js';

// Local build of contracts/agero-contract (same SHA-256 as the Testnet v2 WASM, docs/deploy.md §6)
const WASM = readFileSync(new URL('../__fixtures__/agero_contract.wasm', import.meta.url));
const TARGET = 'CA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB';
const ctx = {
  network: { rpcUrl: 'https://soroban-testnet.stellar.org', passphrase: 'Test SDF Network ; September 2015' },
  job: { jobId: '7', agent: 'GAGENT', inputSha256: 'ab'.repeat(32), client: 'GCLIENT', ledgerNow: 0 },
};
const inspector = (over = {}) => createContractInspector({ fetchWasm: async () => WASM, readLedger: async () => 5502204, ...over });
const run = async (ex = inspector()) => {
  const out = await ex.run({ contract_id: TARGET }, ctx);
  return { out, report: JSON.parse(new TextDecoder().decode(out.bytes)) };
};

describe('Contract Inspector', () => {
  it('is registered as a deterministic executor', () => {
    expect(EXECUTOR_IDS).toEqual(['contract-inspector']);
    const ex = getExecutor('contract-inspector');
    expect(ex).toMatchObject({ id: 'contract-inspector', version: 1, kind: 'deterministic', timeoutMs: 20_000, maxInputBytes: 1024 });
    expect(ex.label).toBe('Contract Inspector (deterministic, no AI)');
    expect(() => getExecutor('summarizer')).toThrow(RangeError);
  });

  it('reports the fixture WASM hash, size and the 14 contract functions', async () => {
    const { report } = await run();
    expect(report.wasm_sha256).toBe('6e226ba57df163646848f1f7fcdc5a27629f60268ed8bf64025c9997d7093f46');
    expect(report.wasm_bytes).toBe(12400);
    expect(report.functions.map((f) => f.name)).toEqual([
      '__constructor', 'agent_at', 'agent_count', 'complete_job', 'create_job', 'deliver_job', 'get_agent',
      'get_job', 'job_count', 'rate_agent', 'refund_job', 'register_agent', 'release_job', 'update_agent',
    ]);
    expect(report.functions.find((f) => f.name === 'deliver_job')).toEqual({
      name: 'deliver_job', inputs: [{ name: 'job_id', type: 'u64' }, { name: 'result_hash', type: 'bytesn<32>' }], outputs: ['result<void,error>'],
    });
    expect(report.functions.find((f) => f.name === 'get_job').outputs).toEqual(['option<Job>']);
    expect(report).toMatchObject({
      schema: 'agero.contract-inspector/1', executor: 'contract-inspector@1', network: 'Test SDF Network ; September 2015',
      job_id: '7', agent: 'GAGENT', input_sha256: 'ab'.repeat(32), target_contract: TARGET, read_at_ledger: 5502204,
    });
  });

  it('is byte-for-byte stable (snapshot hash)', async () => {
    const { out } = await run();
    const text = new TextDecoder().decode(out.bytes);
    expect(text.endsWith('}\n')).toBe(true);
    expect(text.indexOf('\n')).toBe(text.length - 1);
    expect(out.bytes.length).toBe(2233);
    expect(sha256Hex(out.bytes)).toBe('a7d798ab05042ab456c658a6c0e736cfb518af276163e94686add808bfa15974');
    expect(out).toMatchObject({ mediaType: 'application/json', filename: 'agero-job-7.json' });
    expect(sha256Hex((await run()).out.bytes)).toBe(sha256Hex(out.bytes));
  });

  describe('input', () => {
    const parse = (v) => inspector().parseInput(v);
    it('accepts an object or JSON text with one contract ID', () => {
      expect(parse({ contract_id: TARGET })).toEqual({ contract_id: TARGET });
      expect(parse(`{"contract_id":"${TARGET}"}`)).toEqual({ contract_id: TARGET });
    });
    it.each([
      ['not JSON', '{contract_id:'],
      ['an array', [TARGET]],
      ['null', null],
      ['an account address', { contract_id: 'GA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB' }],
      ['a bad checksum', { contract_id: `${TARGET.slice(0, -1)}A` }],
      ['a URL', { contract_id: 'https://example.com/wasm' }],
      ['extra fields', { contract_id: TARGET, rpc_url: 'https://evil.example' }],
      ['a number', { contract_id: 7 }],
    ])('rejects %s', (_, v) => {
      expect(() => parse(v)).toThrow(RangeError);
    });
  });

  describe('failures', () => {
    const failWith = async (over) => {
      try { await run(inspector(over)); } catch (err) { return err; }
      throw new Error('expected a failure');
    };
    it('missing contract is permanent', async () => {
      expect(await failWith({ fetchWasm: async () => { throw { code: 404, message: 'Contract data not found' }; } }))
        .toMatchObject({ code: 'CONTRACT_NOT_FOUND', permanent: true });
    });
    it('a Stellar Asset Contract is permanent', async () => {
      expect(await failWith({ fetchWasm: async () => { throw { code: 400, message: 'Contract C... is a Stellar Asset Contract (SAC), which has no Wasm bytecode.' }; } }))
        .toMatchObject({ code: 'NOT_A_WASM_CONTRACT', permanent: true });
    });
    it('network errors are transient', async () => {
      expect(await failWith({ readLedger: async () => { throw new Error('socket hang up'); } }))
        .toMatchObject({ code: 'RPC_ERROR', permanent: false });
    });
    it('WASM over the size limit is refused before parsing', async () => {
      expect(MAX_WASM_BYTES).toBe(256 * 1024);
      expect(await failWith({ maxWasmBytes: WASM.length - 1 })).toMatchObject({ code: 'WASM_TOO_LARGE', permanent: true });
    });
    it('WASM without a contract spec is permanent', async () => {
      const empty = Uint8Array.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
      expect(await failWith({ fetchWasm: async () => empty })).toMatchObject({ code: 'SPEC_UNREADABLE', permanent: true });
    });
    it('stops after the abort signal fired', async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(inspector().run({ contract_id: TARGET }, { ...ctx, signal: controller.signal })).rejects.toMatchObject({ code: 'EXECUTOR_TIMEOUT' });
    });
  });
});

// Contract Inspector (docs/fase5-design.md §10): reads a Testnet contract's WASM from Soroban RPC
// and reports its SHA-256, size and exported functions. Deterministic, no AI. It only talks to the
// configured RPC (never to a URL taken from the input) and never sees the agent key or the store.
import { contract, rpc, StrKey } from '@stellar/stellar-sdk';
import { canonicalJson, sha256Hex } from '../canonical.js';
import { AgentError, redact } from '../guard.js';

export const MAX_WASM_BYTES = 256 * 1024;
const NO_SUCH_TX = '0'.repeat(64);

// ScSpecTypeDef -> short readable name, e.g. "u64", "option<Job>", "result<vec<u32>,Error>"
export function typeName(def) {
  switch (def.type) {
    case 'scSpecTypeOption': return `option<${typeName(def.option.valueType)}>`;
    case 'scSpecTypeResult': return `result<${typeName(def.result.okType)},${typeName(def.result.errorType)}>`;
    case 'scSpecTypeVec': return `vec<${typeName(def.vec.elementType)}>`;
    case 'scSpecTypeMap': return `map<${typeName(def.map.keyType)},${typeName(def.map.valueType)}>`;
    case 'scSpecTypeTuple': return `tuple<${def.tuple.valueTypes.map(typeName).join(',')}>`;
    case 'scSpecTypeBytesN': return `bytesn<${def.bytesN.n}>`;
    case 'scSpecTypeUdt': return def.udt.name.toString();
    default: return String(def.type).replace(/^scSpecType/, '').toLowerCase();
  }
}

// WASM bytes -> exported functions sorted by name. Throws when the WASM has no readable spec.
export function exportedFunctions(wasm) {
  return contract.Spec.fromWasm(wasm).funcs()
    .map((f) => ({
      name: f.name.toString(),
      inputs: f.inputs.map((i) => ({ name: i.name.toString(), type: typeName(i.type) })),
      outputs: f.outputs.map(typeName),
    }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// Default readers: the configured Soroban RPC only
const rpcServer = (ctx) => new rpc.Server(ctx.network.rpcUrl);
async function defaultReadLedger(ctx) {
  return Number((await rpcServer(ctx).getTransaction(NO_SUCH_TX)).latestLedger);
}
const defaultFetchWasm = (contractId, ctx) => rpcServer(ctx).getContractWasmByContractId(contractId);

// SDK rejections are plain {code, message} objects for "not found" / "is a SAC"; anything else
// (network, timeout) is retried by the pipeline
function classify(err) {
  const message = redact(err?.message ?? err);
  if (/Stellar Asset Contract/i.test(message)) return new AgentError('NOT_A_WASM_CONTRACT', 'That contract is a Stellar Asset Contract; it has no WASM to inspect.');
  if (err?.code === 404 || /not found/i.test(message)) return new AgentError('CONTRACT_NOT_FOUND', 'No contract with that ID was found on Testnet.');
  return new AgentError('RPC_ERROR', `Reading the contract failed: ${message}`, { permanent: false });
}

export function createContractInspector({ fetchWasm = defaultFetchWasm, readLedger = defaultReadLedger, maxWasmBytes = MAX_WASM_BYTES } = {}) {
  return Object.freeze({
    id: 'contract-inspector',
    version: 1,
    kind: 'deterministic',
    label: 'Contract Inspector (deterministic, no AI)',
    maxInputBytes: 1024,
    timeoutMs: 20_000,

    // {"contract_id": "C..."} (object or JSON text), nothing else
    parseInput(input) {
      let value = input;
      if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch { throw new RangeError('Input must be JSON like {"contract_id":"C..."}.'); }
      }
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RangeError('Input must be a JSON object.');
      const extra = Object.keys(value).filter((k) => k !== 'contract_id');
      if (extra.length) throw new RangeError(`Unknown input field(s): ${extra.join(', ')}.`);
      const id = value.contract_id;
      if (typeof id !== 'string' || !StrKey.isValidContract(id)) throw new RangeError('contract_id must be a contract address (C..., 56 characters).');
      return { contract_id: id };
    },

    async run(input, ctx) {
      let ledger;
      let wasm;
      try {
        ledger = await readLedger(ctx);
        wasm = await fetchWasm(input.contract_id, ctx);
      } catch (err) {
        throw classify(err);
      }
      if (ctx.signal?.aborted) throw new AgentError('EXECUTOR_TIMEOUT', 'Contract Inspector ran out of time.');
      const bytes = Uint8Array.from(wasm);
      if (bytes.length > maxWasmBytes) throw new AgentError('WASM_TOO_LARGE', `The contract WASM is ${bytes.length} bytes; the limit is ${maxWasmBytes}.`);
      let functions;
      try {
        functions = exportedFunctions(bytes);
      } catch (err) {
        throw new AgentError('SPEC_UNREADABLE', `The contract WASM has no readable interface: ${redact(err?.message ?? err)}`);
      }
      const report = {
        schema: 'agero.contract-inspector/1',
        executor: 'contract-inspector@1',
        network: ctx.network.passphrase,
        job_id: String(ctx.job.jobId),
        agent: ctx.job.agent,
        input_sha256: ctx.job.inputSha256,
        target_contract: input.contract_id,
        read_at_ledger: ledger, // latest ledger seen just before the WASM was read
        wasm_bytes: bytes.length,
        wasm_sha256: sha256Hex(bytes),
        functions,
      };
      return {
        bytes: new TextEncoder().encode(`${canonicalJson(report)}\n`),
        mediaType: 'application/json',
        filename: `agero-job-${ctx.job.jobId}.json`,
      };
    },
  });
}

#!/usr/bin/env node
// Local trusted mode for the real agent (phase 5a): no HTTP and no client signature; the operator
// running this vouches for the client. Testnet only. Prints public data only, never the secret.
//
//   node frontend/server/cli.mjs --job <id> --input '<json>' [--out <file>] [--check] [--memory]
//   node frontend/server/cli.mjs --job <id> --input-file <path>
//
// Environment: AGERO_NETWORK=testnet, AGERO_CONTRACT_ID, AGERO_AGENT_SECRET, AGERO_AGENT_ENABLED=true,
// optional AGERO_AGENT_ADDRESS (expected public key), AGERO_RPC_URL, AGERO_EXECUTOR, AGERO_STORE_FILE.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadConfig } from './config.js';
import { AgentError, assertEnabled, assertRpcIsTestnet, assertTestnetConfig, redact } from './guard.js';
import { loadAgentKey, verifyAgentOwner } from './agent-key.js';
import { createChain } from './chain.js';
import { checkJob } from './check-job.js';
import { canonicalJson, sha256Hex } from './canonical.js';
import { getExecutor } from './executors/index.js';
import { runJob } from './pipeline.js';
import { createFileStore, createMemoryStore, keys } from './store.js';

const DEFAULT_STORE = fileURLToPath(new URL('./.data/agero-store.json', import.meta.url));
const say = (label, value) => console.log(`${label.padEnd(12)}${redact(value)}`);

// Dry run: the same checks as a real run, without claiming the job or sending anything
async function runCheck({ jobId, input, config, chain, store, executor, key, agent }) {
  let parsed;
  try { parsed = executor.parseInput(input); } catch (err) { say('check', `INVALID_INPUT: ${err.message}`); return 1; }
  const inputHash = sha256Hex(canonicalJson(parsed));
  const [job, ledger, record] = await Promise.all([chain.getJob(jobId), chain.ledgerNow(), store.get(keys.job(config.contractId, jobId))]);
  const res = checkJob({
    job, agent, agentPublic: key.publicKey, ledgerNow: ledger.time, signer: null, trustedLocal: true, record, inputHash,
    nowUnix: Math.floor(Date.now() / 1000), marginSecs: config.limits.safetyMarginSecs,
  });
  say('input_hash', inputHash);
  if (job) say('deadline in', `${job.deadline - ledger.time} s (ledger ${ledger.ledger})`);
  if (!res.ok) { say('check', res.code); return 1; }
  say('check', `OK${res.resume ? ' (resumes a stored record)' : ''}; nothing was sent`);
  return 0;
}

function printResult(res, out) {
  say('status', `${res.status}${res.replay ? ' (stored outcome, nothing sent again)' : ''}`);
  for (const field of ['input_hash', 'result_hash', 'deliver_tx', 'refund_tx']) {
    if (res.record?.[field]) say(field, res.record[field]);
  }
  if (!res.ok) { say('error', `${res.code}: ${res.message}`); return 1; }
  if (out) {
    writeFileSync(out, res.result, 'utf8');
    say('result file', `${out} (SHA-256 ${sha256Hex(readFileSync(out))})`);
  }
  return 0;
}

async function main() {
  const { values } = parseArgs({
    options: {
      job: { type: 'string' },
      input: { type: 'string' },
      'input-file': { type: 'string' },
      out: { type: 'string' },
      check: { type: 'boolean', default: false },
      memory: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help || !values.job || (values.input == null) === (values['input-file'] == null)) {
    console.log('Usage: node frontend/server/cli.mjs --job <id> (--input <json> | --input-file <path>) [--out <file>] [--check] [--memory]');
    return values.help ? 0 : 2;
  }
  // PowerShell 5.1 writes UTF-8 files with a BOM
  const input = values.input ?? readFileSync(values['input-file'], 'utf8').replace(/^\uFEFF/, '');

  const config = loadConfig(process.env);
  assertTestnetConfig(config);
  assertEnabled(config);
  const key = loadAgentKey(process.env, { consume: true });
  const chain = createChain({ config, signer: key });
  await assertRpcIsTestnet(chain.server);
  const agent = await verifyAgentOwner(key, (a) => chain.getAgent(a), config.expectedAgent);
  const executor = getExecutor(config.executor);
  const store = values.memory ? createMemoryStore() : createFileStore(process.env.AGERO_STORE_FILE || DEFAULT_STORE);

  say('network', 'Testnet (passphrase checked with the RPC)');
  say('contract', config.contractId);
  say('agent', `${key.publicKey} (${agent.name})`);
  say('executor', `${executor.id}@${executor.version}, ${executor.kind}`);
  say('job', values.job);

  if (values.check) return runCheck({ jobId: values.job, input, config, chain, store, executor, key, agent });
  const res = await runJob({ jobId: values.job, input, trustedLocal: true }, {
    config, chain, store, executor, agentPublic: key.publicKey,
    log: (event, fields) => console.log(`  [${event}] ${redact(JSON.stringify(fields))}`),
  });
  return printResult(res, values.out);
}

try {
  process.exitCode = await main();
} catch (err) {
  const code = err instanceof AgentError ? err.code : 'ERROR';
  console.error(`error ${code}: ${redact(err?.message ?? err)}`);
  process.exitCode = 2;
}

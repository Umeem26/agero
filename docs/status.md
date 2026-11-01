# Agero status

Moved unchanged from the README on 2026-11-01 (only relative links adjusted for this folder). Each row says
what is proven and how; anything without evidence is marked pending. Manual test records: [deploy.md](deploy.md).

> **Prototype notice:** escrow contract v2 is deployed on Stellar Testnet (CLI smoke test passed on 2026-10-29); the older v1 contract is still live but deprecated. Since phase 3a the web UI reads agents, ratings and jobs from v2 over Soroban RPC, and builds `create_job` / `complete_job` / `refund_job` / `rate_agent` transactions that you sign in Freighter (Testnet only). Since phase 3b an Agent dashboard also builds `register_agent` / `update_agent` / `deliver_job` / `release_job` / `refund_job` (as the agent). The read path has been checked against Testnet. A manual Freighter test on 2026-11-01 ran `register_agent`, `update_agent`, `create_job`, `deliver_job`, `complete_job` and `rate_agent` end to end with two Testnet accounts (job `2`; transactions checked on Horizon and with `get_job` in [docs/deploy.md §11](deploy.md#11-hasil-uji-manual-freighter-testnet-2026-11-01)). `refund_job` (client and agent), `release_job` and the rest of the checklists ([§9](deploy.md#9-checklist-uji-manual-ui--freighter), [§10](deploy.md#10-checklist-uji-manual-3b-dashboard-agen)) have not been tested by hand yet. The live app never runs agents: owners do the work elsewhere and record only a SHA-256 hash of the result. Phase 5a adds code for one real agent (Contract Inspector, deterministic, no AI) that an operator starts from a local CLI; it is unit-tested offline and has not been run on Testnet yet. Still simulated: the x402 playground. See [Status](#status-table) and the [audit report](audit/agero-audit.md).

## Status table

What actually works today (based on the [2026-10-25 audit](audit/agero-audit.md), §6).

| Feature | Status | Notes |
|---|---|---|
| Escrow contract v2 (source in `contracts/agero-contract`) | ✅ Real | Deadlines, delivery step, 72 h auto-release, fixed XLM token, typed errors, events, TTL extension. 59/59 unit tests pass, including negative auth and audit regression tests. See [docs/contract-v2.md](contract-v2.md) |
| Contract v2 deployed to Testnet | ✅ Real | `CA5CMRJJ…LBDFB`, deployed 2026-10-29. CLI smoke test (register → create → deliver → complete → rate) passed with job_id `1`; contract balance back to 0 afterwards. Interface (14 functions) and WASM hash checked against the local build with stellar CLI. See [docs/deploy.md](deploy.md) |
| Contract v1 on Testnet (`CBEIINKJ…BW5X`) | ⚠️ Deprecated | Still live; built from the v1 source (commit `b706175`), which no longer matches `main`. 1 contract invocation at audit time. Has the issues listed in the audit (F02, F04–F07, F11–F14) |
| Live web app (agero.vercel.app) | ✅ Real | Static React SPA |
| UI reads the contract (registry, ratings, job counts, jobs) | ✅ Real | `@stellar/stellar-sdk` 17.4 over Soroban RPC: read-only simulations of `agent_count`, `agent_at`, `get_agent`, `job_count`, `get_job` (parallel). Checked against Testnet on 2026-10-29. RPC failures show an error with retry; there is no fallback to hardcoded data. Code in `frontend/src/chain/` |
| UI writes as the client: `create_job`, `complete_job`, `rate_agent` | ✅ Real (manual test 2026-11-01) | Build → simulate → assemble → sign in Freighter → send → poll. Run end to end once with Freighter: job `2` (2 XLM, 1 h deadline) created, approved and rated 4 by the client account; each transaction succeeded on Horizon and `get_job` shows `"status": 2`, `"rated": true`. Hashes in [docs/deploy.md §11](deploy.md#11-hasil-uji-manual-freighter-testnet-2026-11-01) |
| UI writes as the client: `refund_job` after the deadline | 🟡 Implemented, manual test pending | Same pipeline; no refund transaction yet. Checklist: [docs/deploy.md §9](deploy.md#9-checklist-uji-manual-ui--freighter) steps 11–12 |
| Freighter signing | ✅ Real (manual test 2026-11-01) | Signed the six transactions above from two Testnet accounts (client and agent owner). Demo mode and the `localStorage` escrow were removed |
| Freighter network and account checks | 🟡 Implemented, manual test pending | Rejects networks other than Testnet and refuses to sign when the active account changed; not exercised by hand yet (§9 steps 3, 5, 14) |
| Deadlines in the UI | 🟡 Implemented, manual test pending | Client picks 1–720 hours (the 1 h choice reached `create_job` as 3600 s in the manual test); My Jobs shows deadline and 72 h review-window countdowns from ledger time and only the actions the contract accepts. Countdowns and button visibility not yet checked by hand |
| Marketplace agents | 🟡 Sample data, seeded on Testnet | The registry shows whatever is registered on v2: 13 agents since 2026-11-01 (the smoke-test agent, the manual-test agent `Uji 3b` without a "Sample" badge, and 11 sample agents, each checked with `get_agent` against `sample-agents.json`; owners in [docs/deploy.md §7](deploy.md#7-seed-11-agen-sampel-fase-3a)). `scripts/seed-agents.ps1` registers the 11 sample agents with a `Sample agent -` description and a placeholder `https://example.invalid/...` endpoint; shown with a "Sample" badge. Since phase 4a the UI shows neutral sample descriptions from `sample-agents.json`; the on-chain descriptions of the 11 seeded agents still hold the original seed text until their owners call `update_agent` ([docs/deploy.md §7](deploy.md#7-seed-11-agen-sampel-fase-3a)) |
| Ratings | ✅ Real (read) / ✅ Real write (manual test 2026-11-01) | Stars and counts come from the contract (one 1–5 rating per Completed job, by that job's client). The manual test rated job `2` with 4 stars; `get_agent` shows `rating_count` 1, `rating_sum` 4. Text reviews were removed: the contract stores only numbers |
| Agent dashboard: `register_agent`, `update_agent`, `deliver_job` | ✅ Real (manual test 2026-11-01) | Phase 3b. Same build → simulate → assemble → Freighter → send → poll pipeline as above. The agent-owner account registered `Uji 3b` at 1 XLM, changed the price to 2 XLM and delivered job `2`; `get_agent` matches. Incoming jobs and the earnings summary come from scanning the newest 200 jobs. The stellar CLI still works as an alternative |
| Agent dashboard: `release_job`, `refund_job` as the agent | 🟡 Implemented, manual test pending | Actions shown only when the contract would accept them (status + ledger time; release at `delivered_at + 72 h`), unit-tested including the exact 72 h boundary. No release or refund transaction yet. Checklist: [docs/deploy.md §10](deploy.md#10-checklist-uji-manual-3b-dashboard-agen) steps 12–14 |
| Result hash in `deliver_job` | ✅ Real (manual test 2026-11-01) | SHA-256 computed in the browser (Web Crypto, tested with NIST vectors) from a file or text; only the 32-byte hash goes into `deliver_job`. For job `2` the hash shown in the UI equals `result_hash` from `get_job` |
| Client file check | 🟡 Implemented, manual test pending | My Jobs shows `result_hash` and compares a file the client received against it, locally. Match / no match not yet checked by hand (§10 step 10). A match says nothing about quality |
| Agent work output | ⛔ Outside Agero (by design) | The live app never runs agents or stores results; owners do the work elsewhere and send it to the client themselves. Sample agents perform no work. The phase 5a code below is not deployed |
| Real agent "Contract Inspector" (phase 5a) | 🟡 Code + unit tests; Testnet e2e not run yet | Server code in `frontend/server/` and a local CLI (`node frontend/server/cli.mjs`; trusted local mode: no HTTP API, no client signature). It checks the job with `get_job` / `get_agent` (Pending, its own agent, amount ≥ price, ≥ 300 s before the deadline), reads the target contract's WASM over Soroban RPC and reports its SHA-256, size and exported functions (deterministic, no AI), then calls `deliver_job` with the SHA-256 of that report, or `refund_job` as the agent when the inspection fails. Testnet only (passphrase checked with the RPC), kill switch `AGERO_AGENT_ENABLED`. 117 offline unit tests, including the Agero WASM as a fixture. The agent is not registered on Testnet yet and has sent no transaction; steps in [docs/deploy.md §12](deploy.md#12-agen-nyata-5a). No API, hosted result storage or UI yet (phases 5b/5c) |
| x402 payment verification | 🟡 Simulated | The playground sends the mock reference `MOCK_TX_XLM` to the local gateway demo (`scripts/x402-sim/x402_simulator.js`) or simulates in the browser. Not linked to the escrow |
| Dispute resolution | ⛔ None (by design) | v2 has no arbiter: after delivery the client has 72 h to approve, then anyone can release funds to the agent |
| Escrow token restriction | 🟡 v2 contract only | v2 fixes the token to native XLM at deploy time (the Testnet v2 uses the native XLM SAC); v1 accepts any token |
| Home "Contract pulse" | ✅ Real (read) | `agent_count`, `job_count` and the latest ledger number, read once when the home page loads; loading and error states shown |
| Home "Escrow timeline" | 🟡 Illustration | Labelled "Illustration, not a real job": fixed example values stepped by the user; nothing is read from or sent to the chain |

## Contract addresses (Testnet)

**v2** (deployed 2026-10-29):

```
CA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB
```

> 🔗 v2: [View on Stellar Explorer](https://stellar.expert/explorer/testnet/contract/CA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB) · WASM hash `6e226ba57df163646848f1f7fcdc5a27629f60268ed8bf64025c9997d7093f46`

**v1 (deprecated):**

```
CBEIINKJWTVYY3WNJGWFWJECNLZHT2RA3YXATDLTGKZGFN5ZOMDRBW5X
```

> 🔗 v1 (deprecated): [View on Stellar Explorer](https://stellar.expert/explorer/testnet/contract/CBEIINKJWTVYY3WNJGWFWJECNLZHT2RA3YXATDLTGKZGFN5ZOMDRBW5X) · [View on Stellar Lab](https://lab.stellar.org/r/testnet/contract/CBEIINKJWTVYY3WNJGWFWJECNLZHT2RA3YXATDLTGKZGFN5ZOMDRBW5X)

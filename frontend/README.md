# Agero frontend

React 19 + Vite 8 SPA that reads Agero contract v2 on Stellar Testnet and signs escrow actions in Freighter.
Node 22.12+ (`@stellar/stellar-sdk` 17, vitest 5).

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:5173 |
| `npm test` | Vitest unit tests (`src/` and `server/`, no network) |
| `npm run lint` | oxlint (CI runs `npm run lint -- --deny-warnings`) |
| `npm run build` / `npm run preview` | Production build to `dist/` / serve it locally |

**Env:** every `VITE_*` value has a Testnet default in `src/chain/config.js`; to override, copy `.env.example` to
`.env.local` (`VITE_CONTRACT_ID`, `VITE_RPC_URL`, `VITE_NETWORK_PASSPHRASE`, `VITE_XLM_SAC`, `VITE_EXPLORER_URL`).
They end up in the browser bundle, so never put a secret there.

| Folder | Contents |
|---|---|
| `src/chain/` | `config` (env), `rpc` (simulated reads, one write pipeline), `wallet` (Freighter), `jobs` (status rules), `hash` (SHA-256), `units`, `profile`, `errors` |
| `src/components/` | Pages and widgets: `HireModal`, `MyJobs`, `AgentDashboard`, `EscrowTimeline`, `ContractPulse`, `Playground` (simulated x402), shared `ui` |
| `src/data/` | `sample-agents.json` (seed data, UI-only categories) |
| `server/` | Phase 5a real agent (Contract Inspector): `cli.mjs`, guard, chain, pipeline, store, `executors/`; not part of the web build ([docs/deploy.md §12](../docs/deploy.md#12-agen-nyata-5a)) |

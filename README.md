<p align="center">
  <img src="frontend/public/favicon.svg" width="80" alt="Agero Logo" />
</p>

<h1 align="center">Agero</h1>
<p align="center">
  <strong>Decentralized AI Agent Escrow Platform on Stellar</strong>
</p>

<p align="center">
  <em>Prototype AI agent marketplace with a Soroban escrow contract on Stellar Testnet. The UI reads the agent registry from the contract and signs escrow and agent actions with Freighter; Agero does not run the agents, it records only a hash of each result.</em>
</p>

<p align="center">
  <a href="https://stellar.expert/explorer/testnet/contract/CA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB">
    <img src="https://img.shields.io/badge/Contract%20v2-Testnet-blue?style=for-the-badge&logo=stellar" alt="Contract v2 (Testnet)" />
  </a>
  <a href="https://stellar.expert/explorer/testnet/contract/CBEIINKJWTVYY3WNJGWFWJECNLZHT2RA3YXATDLTGKZGFN5ZOMDRBW5X">
    <img src="https://img.shields.io/badge/Contract%20v1-deprecated-lightgrey?style=for-the-badge&logo=stellar" alt="Contract v1 (deprecated)" />
  </a>
  <img src="https://img.shields.io/badge/Soroban-Rust-orange?style=for-the-badge&logo=rust" alt="Soroban" />
  <img src="https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Build-Vite%208-646CFF?style=for-the-badge&logo=vite" alt="Vite" />
</p>

<p align="center">
  <a href="https://agero.vercel.app/" target="_blank">
    <img src="https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel" alt="Deploy" />
  </a>
  <a href="https://drive.google.com/file/d/1i_Pw92eVZAeQ3LfaRg0Q65tJ-NXu6DQv/view" target="_blank">
    <img src="https://img.shields.io/badge/Demo%20Video-Google%20Drive-red?style=for-the-badge&logo=googledrive" alt="Demo Video" />
  </a>
  <a href="https://gamma.app/docs/Decentralized-AI-Agent-Escrow-Platform-on-Stellar-glmz21u9ypvz74s" target="_blank">
    <img src="https://img.shields.io/badge/Pitch%20Deck-Gamma-purple?style=for-the-badge&logo=powerpoint" alt="Pitch Deck" />
  </a>
</p>

<p align="center">
  <a href="https://agero.vercel.app/"><strong>🌐 Live Deployment</strong></a> &middot; 
  <a href="https://drive.google.com/file/d/1i_Pw92eVZAeQ3LfaRg0Q65tJ-NXu6DQv/view"><strong>🎥 Video Demo</strong></a> &middot; 
  <a href="https://gamma.app/docs/Decentralized-AI-Agent-Escrow-Platform-on-Stellar-glmz21u9ypvz74s"><strong>📊 Pitch Deck</strong></a>
</p>

---

## 📋 Overview

**Agero** is a prototype marketplace where users can discover, hire, and pay AI agents for tasks such as text summarization, image generation, code auditing, voice cloning, and more. The goal is to lock payments in a **Soroban escrow smart contract** and release them when the client approves the work, enabling machine-to-machine (M2M) transactions on the **Stellar network**.

> **Prototype notice:** escrow contract v2 is deployed on Stellar Testnet (CLI smoke test passed on 2026-10-29); the older v1 contract is still live but deprecated. Since phase 3a the web UI reads agents, ratings and jobs from v2 over Soroban RPC, and builds `create_job` / `complete_job` / `refund_job` / `rate_agent` transactions that you sign in Freighter (Testnet only). Since phase 3b an Agent dashboard also builds `register_agent` / `update_agent` / `deliver_job` / `release_job` / `refund_job` (as the agent). The read path has been checked against Testnet. A manual Freighter test on 2026-11-01 ran `register_agent`, `update_agent`, `create_job`, `deliver_job`, `complete_job` and `rate_agent` end to end with two Testnet accounts (job `2`; transactions checked on Horizon and with `get_job` in [docs/deploy.md §11](docs/deploy.md#11-hasil-uji-manual-freighter-testnet-2026-11-01)). `refund_job` (client and agent), `release_job` and the rest of the checklists ([§9](docs/deploy.md#9-checklist-uji-manual-ui--freighter), [§10](docs/deploy.md#10-checklist-uji-manual-3b-dashboard-agen)) have not been tested by hand yet. Agero never runs the agents: owners do the work elsewhere and record only a SHA-256 hash of the result. Still simulated: the x402 playground. See [Status](#-status) and the [audit report](docs/audit/agero-audit.md).

---

## 📌 Status

What actually works today (based on the [2026-10-25 audit](docs/audit/agero-audit.md), §6).

| Feature | Status | Notes |
|---|---|---|
| Escrow contract v2 (source in `contracts/agero-contract`) | ✅ Real | Deadlines, delivery step, 72 h auto-release, fixed XLM token, typed errors, events, TTL extension. 59/59 unit tests pass, including negative auth and audit regression tests. See [docs/contract-v2.md](docs/contract-v2.md) |
| Contract v2 deployed to Testnet | ✅ Real | `CA5CMRJJ…LBDFB`, deployed 2026-10-29. CLI smoke test (register → create → deliver → complete → rate) passed with job_id `1`; contract balance back to 0 afterwards. Interface (14 functions) and WASM hash checked against the local build with stellar CLI. See [docs/deploy.md](docs/deploy.md) |
| Contract v1 on Testnet (`CBEIINKJ…BW5X`) | ⚠️ Deprecated | Still live; built from the v1 source (commit `b706175`), which no longer matches `main`. 1 contract invocation at audit time. Has the issues listed in the audit (F02, F04–F07, F11–F14) |
| Live web app (agero.vercel.app) | ✅ Real | Static React SPA |
| UI reads the contract (registry, ratings, job counts, jobs) | ✅ Real | `@stellar/stellar-sdk` 17.4 over Soroban RPC: read-only simulations of `agent_count`, `agent_at`, `get_agent`, `job_count`, `get_job` (parallel). Checked against Testnet on 2026-10-29. RPC failures show an error with retry; there is no fallback to hardcoded data. Code in `frontend/src/chain/` |
| UI writes as the client: `create_job`, `complete_job`, `rate_agent` | ✅ Real (manual test 2026-11-01) | Build → simulate → assemble → sign in Freighter → send → poll. Run end to end once with Freighter: job `2` (2 XLM, 1 h deadline) created, approved and rated 4 by the client account; each transaction succeeded on Horizon and `get_job` shows `"status": 2`, `"rated": true`. Hashes in [docs/deploy.md §11](docs/deploy.md#11-hasil-uji-manual-freighter-testnet-2026-11-01) |
| UI writes as the client: `refund_job` after the deadline | 🟡 Implemented, manual test pending | Same pipeline; no refund transaction yet. Checklist: [docs/deploy.md §9](docs/deploy.md#9-checklist-uji-manual-ui--freighter) steps 11–12 |
| Freighter signing | ✅ Real (manual test 2026-11-01) | Signed the six transactions above from two Testnet accounts (client and agent owner). Demo mode and the `localStorage` escrow were removed |
| Freighter network and account checks | 🟡 Implemented, manual test pending | Rejects networks other than Testnet and refuses to sign when the active account changed; not exercised by hand yet (§9 steps 3, 5, 14) |
| Deadlines in the UI | 🟡 Implemented, manual test pending | Client picks 1–720 hours (the 1 h choice reached `create_job` as 3600 s in the manual test); My Jobs shows deadline and 72 h review-window countdowns from ledger time and only the actions the contract accepts. Countdowns and button visibility not yet checked by hand |
| Marketplace agents | 🟡 Sample data, seeded on Testnet | The registry shows whatever is registered on v2: 13 agents since 2026-11-01 (the smoke-test agent, the manual-test agent `Uji 3b` without a "Sample" badge, and 11 sample agents, each checked with `get_agent` against `sample-agents.json`; owners in [docs/deploy.md §7](docs/deploy.md#7-seed-11-agen-sampel-fase-3a)). `scripts/seed-agents.ps1` registers the 11 sample agents with a `Sample agent -` description and a placeholder `https://example.invalid/...` endpoint; shown with a "Sample" badge. Since phase 4a the UI shows neutral sample descriptions from `sample-agents.json`; the on-chain descriptions of the 11 seeded agents still hold the original seed text until their owners call `update_agent` ([docs/deploy.md §7](docs/deploy.md#7-seed-11-agen-sampel-fase-3a)) |
| Ratings | ✅ Real (read) / ✅ Real write (manual test 2026-11-01) | Stars and counts come from the contract (one 1–5 rating per Completed job, by that job's client). The manual test rated job `2` with 4 stars; `get_agent` shows `rating_count` 1, `rating_sum` 4. Text reviews were removed: the contract stores only numbers |
| Agent dashboard: `register_agent`, `update_agent`, `deliver_job` | ✅ Real (manual test 2026-11-01) | Phase 3b. Same build → simulate → assemble → Freighter → send → poll pipeline as above. The agent-owner account registered `Uji 3b` at 1 XLM, changed the price to 2 XLM and delivered job `2`; `get_agent` matches. Incoming jobs and the earnings summary come from scanning the newest 200 jobs. The stellar CLI still works as an alternative |
| Agent dashboard: `release_job`, `refund_job` as the agent | 🟡 Implemented, manual test pending | Actions shown only when the contract would accept them (status + ledger time; release at `delivered_at + 72 h`), unit-tested including the exact 72 h boundary. No release or refund transaction yet. Checklist: [docs/deploy.md §10](docs/deploy.md#10-checklist-uji-manual-3b-dashboard-agen) steps 12–14 |
| Result hash in `deliver_job` | ✅ Real (manual test 2026-11-01) | SHA-256 computed in the browser (Web Crypto, tested with NIST vectors) from a file or text; only the 32-byte hash goes into `deliver_job`. For job `2` the hash shown in the UI equals `result_hash` from `get_job` |
| Client file check | 🟡 Implemented, manual test pending | My Jobs shows `result_hash` and compares a file the client received against it, locally. Match / no match not yet checked by hand (§10 step 10). A match says nothing about quality |
| Agent work output | ⛔ Outside Agero (by design) | Agero never runs agents or stores results; owners do the work elsewhere and send it to the client themselves. Sample agents perform no work |
| x402 payment verification | 🟡 Simulated | The playground sends the mock reference `MOCK_TX_XLM` to the local gateway demo (`scripts/x402_simulator.js`) or simulates in the browser. Not linked to the escrow |
| Dispute resolution | ⛔ None (by design) | v2 has no arbiter: after delivery the client has 72 h to approve, then anyone can release funds to the agent |
| Escrow token restriction | 🟡 v2 contract only | v2 fixes the token to native XLM at deploy time (the Testnet v2 uses the native XLM SAC); v1 accepts any token |
| Home "Contract pulse" | ✅ Real (read) | `agent_count`, `job_count` and the latest ledger number, read once when the home page loads; loading and error states shown |
| Home "Escrow timeline" | 🟡 Illustration | Labelled "Illustration, not a real job": fixed example values stepped by the user; nothing is read from or sent to the chain |

### 🔑 Contract Address (Testnet)

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

---

## 🖼️ Screenshots

Captured on 2026-11-01 (`vite preview`, Chromium, live Testnet reads, no wallet connected). Home and Marketplace are from the phase 4d build ([after-4d/](docs/audit/ui-shots/after-4d/)); Agent detail and Agent dashboard are still from phase 4c ([after-4c/](docs/audit/ui-shots/after-4c/)), so their category chip predates the 4d "UI-only" label.

### Home
The hero is an interactive illustration of one escrow job (labelled as such): the XLM moves Client → Escrow → Agent, the deadline meter counts down and the result hash is sealed on delivery. Below it, the "Contract pulse" shows numbers read from the contract when the page loads, and a state diagram of every status change.

<p align="center">
  <img src="docs/audit/ui-shots/after-4d/home-1440.jpg" width="90%" alt="Home page at 1440 px: hero with contract pulse under the buttons, escrow timeline illustration, registered agents, state diagram" />
</p>

### Marketplace and agent detail
Listings, prices, ratings and job counts are read from contract v2 and marked "on contract"; the category (dashed) exists only in the frontend. Each agent has a glyph derived from its owner address. "Sample" marks the seeded agents.

<p align="center">
  <img src="docs/audit/ui-shots/after-4d/marketplace-1440.jpg" width="45%" alt="Marketplace at 1440 px" />
  <img src="docs/audit/ui-shots/after-4c/agent-detail-1440.jpg" width="45%" alt="Agent detail at 1440 px" />
</p>

### Agent dashboard (no wallet connected) and mobile
The former Developer page is now the collapsible "Use the CLI instead" section of the Agent dashboard. Screens that need a connected wallet (My Jobs with jobs, Deliver, Verify, Rate) are not captured here.

<p align="center">
  <img src="docs/audit/ui-shots/after-4c/agent-dashboard-disconnected-1440.jpg" width="60%" alt="Agent dashboard without a wallet at 1440 px" />
  <img src="docs/audit/ui-shots/after-4d/marketplace-375.jpg" width="25%" alt="Marketplace at 375 px" />
</p>

---

## 🏗️ Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                  Agero Frontend (React 19 + Vite 8)           │
│                                                               │
│  ┌──────────┐ ┌─────────────┐ ┌──────────┐ ┌─────────────┐    │
│  │ Home     │ │ Marketplace │ │ My Jobs  │ │ Agent dash. │    │
│  │ (pulse)  │ │ (registry)  │ │ (client) │ │ (+ CLI)     │    │
│  └──────────┘ └─────────────┘ └──────────┘ └─────────────┘    │
│                                                               │
│  src/chain: @stellar/stellar-sdk 17 + Freighter (Testnet)     │
│  x402 playground: simulated, not linked to the escrow         │
└───────────┬───────────────────────────────┬───────────────────┘
            │ reads: simulateTransaction    │ writes: signed in Freighter
            │ (no signature)                │ sendTransaction + poll
            ▼                               ▼
              ┌─────────────────────┐
              │  Soroban RPC        │
              │  (Testnet)          │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │  Soroban Contract   │
              │  v2 (WASM)          │
              │  ─────────────────  │
              │  register_agent     │
              │  update_agent       │
              │  create_job         │
              │  deliver_job        │
              │  complete_job       │
              │  release_job        │
              │  refund_job         │
              │  rate_agent         │
              │  get_job/get_agent  │
              │  job/agent_count    │
              │  agent_at           │
              └─────────────────────┘
```

> Since phase 3b the UI builds every mutating call: My Jobs for the client, the Agent dashboard for the agent (`refund_job` from both sides). None of the write paths has been tested end to end with Freighter yet.

---

## ⚡ Key Features

| Feature | Description |
|---|---|
| **AI Agent Marketplace** (registry from contract v2) | Lists every agent registered on the contract. `scripts/seed-agents.ps1` registers 11 sample agents (Summarizer Bot, Image Generator Pro, Translation Bot XL, Code Auditor AI, Data Analyst Bot, Voice Cloner AI, Music Composer AI, SEO Optimizer Bot, Chatbot Assistant, Sentiment Analyst, Video Generator AI), marked "Sample", with placeholder endpoints |
| **Soroban Escrow** (v2 on Testnet) | v2 locks native XLM in `create_job` with a client-chosen deadline. The agent delivers a result hash; the client approves with `complete_job`, or after 72 h anyone can `release_job` to the agent. The client can refund only after the deadline if nothing was delivered; the agent can refund any time before payout. No arbiter. The UI signs `create_job`, `complete_job`, `refund_job` and `rate_agent` for the client and `register_agent`, `update_agent`, `deliver_job`, `release_job`, `refund_job` for the agent, all in Freighter (manually tested 2026-11-01 except `refund_job` and `release_job`, still pending) |
| **x402 Payment Protocol** (simulated) | A mock payment reference is passed over HTTP to a local gateway demo, or simulated in the browser; not linked to the escrow |
| **Escrow timeline** (illustration) | Home-page hero that steps through one example job (Pending → Delivered → 72 h review → Completed, or Refunded) with Play / Next step / Reset; static and complete under reduced motion |
| **Freighter Integration** (Testnet) | Connect Freighter, check that it is on Testnet, and sign contract calls. Rejections, wrong network, low balance and failed transactions show a clear message |
| **Forest ledger UI** | Flat dark forest surfaces, one teal accent, hash chips and deadline meters; see [docs/design-system.md](docs/design-system.md) |
| **Rating System** (contract v2) | One 1–5 star rating per Completed job, signed by that job's client with `rate_agent`. The UI shows the on-chain average and count; there are no text reviews |

---

## 🚀 Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) with `wasm32` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli) v22+
- [Node.js](https://nodejs.org/) v22.12+ (required by `@stellar/stellar-sdk` 17 and vitest 5)
- [Freighter Wallet](https://freighter.app/) browser extension set to **Testnet** (needed to sign; browsing works without it)

### 1. Clone & Install

```bash
git clone https://github.com/<your-username>/agero.git
cd agero
cd frontend && npm install
```

### 2. Test & Build Smart Contract

```powershell
cd contracts/agero-contract
cargo test            # use PowerShell on Windows; the Git Bash linker fails
stellar contract build
```

### 3. Deploy to Testnet

v2 needs the escrow token (native XLM SAC) as a constructor argument. The script derives it and deploys; full steps, smoke test and how to read the output are in [docs/deploy.md](docs/deploy.md).

```powershell
stellar keys generate agero-deployer --network testnet --fund
.\scripts\deploy-testnet.ps1 -Source agero-deployer
.\scripts\smoke-testnet.ps1 -ContractId <CONTRACT_ID> -Client agero-client -Agent agero-agent
```

### 4. Seed the sample agents (optional)

Registers the 11 sample agents on v2 from 11 new stellar CLI identities (see [docs/deploy.md §7](docs/deploy.md#7-seed-11-agen-sampel-fase-3a)):

```powershell
.\scripts\seed-agents.ps1 -ContractId CA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB
```

### 5. Run Frontend Locally

The frontend defaults to contract v2 on Testnet. To point it elsewhere, copy `frontend/.env.example` to `frontend/.env.local` and edit the `VITE_*` values (all public; never put a secret key there). Details: [docs/deploy.md §8](docs/deploy.md#8-konfigurasi-frontend-vite_).

```bash
cd frontend
npm run dev
npm test        # unit tests (vitest)
```

### 6. Build for Production

```bash
cd frontend
npm run build
```

---

## 📁 Project Structure

```
agero/
├── contracts/
│   └── agero-contract/         # Soroban Rust smart contract
│       ├── src/
│       │   ├── lib.rs           # Contract v2 logic (escrow, agents, jobs)
│       │   ├── test.rs          # Test setup helpers
│       │   └── test/            # flow, auth, validation, events, audit regressions
│       └── Cargo.toml
├── frontend/
│   ├── public/                  # favicon
│   ├── .env.example             # VITE_* chain config (Testnet defaults)
│   ├── src/
│   │   ├── App.jsx              # Pages: home, marketplace, agent detail, my jobs, agent dashboard (incl. CLI)
│   │   ├── chain/               # config, rpc (reads/writes), wallet (Freighter), jobs, profile, hash (SHA-256), units, errors + tests
│   │   ├── components/          # HireModal, MyJobs, AgentDashboard, AgentProfileForm, TxProgress, Playground (simulated x402), ui
│   │   ├── data/sample-agents.json  # Sample agents for the seed script + UI-only categories
│   │   └── index.css            # Role tokens + styles (docs/design-system.md)
│   └── index.html
├── scripts/
│   ├── x402_simulator.js       # Local x402 payment gateway simulator
│   ├── deploy-testnet.ps1      # Build + deploy contract v2
│   ├── smoke-testnet.ps1       # register → create → deliver → complete → rate
│   └── seed-agents.ps1         # Register the 11 sample agents (idempotent)
├── docs/
│   ├── contract-v2.md           # State machine, events, errors, audit → test map
│   ├── deploy.md                # Testnet deploy, seed, frontend config, manual UI checklist
│   ├── audit/                   # Audit reports + phase screenshots (README uses ui-shots/after-4d and after-4c)
│   ├── design-system.md         # Tokens, fonts, usage rules
│   └── *.md                     # Implementation plans
├── tool/
│   └── honesty_gate.sh          # Fails if banned overclaiming phrases appear
├── Cargo.toml                   # Rust workspace configuration
└── README.md
```

---

## 📜 Smart Contract API (v2)

Contract v2 in [`contracts/agero-contract/src/lib.rs`](contracts/agero-contract/src/lib.rs). Unit-tested (59/59), deployed to Testnet as `CA5CMRJJ…LBDFB` (see [Contract Address](#-contract-address-testnet)). Full transition table, events and error codes: [docs/contract-v2.md](docs/contract-v2.md).

### State machine

```
Pending ──deliver_job──► Delivered ──complete_job (client)──────────────► Completed
   │                        └──────release_job (anyone, ≥ 72 h after delivery)──► Completed
   ├──refund_job (client, only after the deadline) ──► Refunded
   └──refund_job (agent, Pending or Delivered) ──────► Refunded
```

### Functions

Signatures with `env: Env` omitted. Amounts and prices are `i128` stroops of native XLM (1 XLM = 10,000,000). Mutating functions return `Result<_, Error>` with typed error codes.

| Function | Parameters | Description |
|---|---|---|
| `__constructor` | `token: Address` | Run once at deploy. Fixes the escrow token (native XLM SAC) for the whole contract |
| `register_agent` | `owner: Address, name: String, description: String, api_url: String, price: i128` | Owner auth, `price > 0`. One agent per address |
| `update_agent` | `owner: Address, name: String, description: String, api_url: String, price: i128` | Owner auth, `price > 0`. Keeps ratings and job count |
| `create_job` | `client: Address, agent_owner: Address, amount: i128, duration_secs: u64` → `u64` | Client auth. Rejects self-deal, `amount <= 0`, `amount < price`, unregistered agent and durations outside 1 h – 30 d. Locks `amount` XLM; `deadline = now + duration_secs` |
| `deliver_job` | `job_id: u64, result_hash: BytesN<32>` | Agent owner auth, job Pending (allowed after the deadline until the client refunds). Moves to Delivered |
| `complete_job` | `job_id: u64` | Client auth, job Delivered. Pays the agent, `total_jobs + 1` |
| `release_job` | `job_id: u64` | No auth (anyone). Job Delivered and at least 72 h since delivery. Pays the agent |
| `refund_job` | `job_id: u64, caller: Address` | Caller auth. Client: only Pending and after the deadline. Agent: Pending or Delivered, any time. Anyone else is rejected |
| `rate_agent` | `client: Address, job_id: u64, rating: u32` | Client auth, that client's Completed job, rating 1–5, once per job |
| `get_agent` | `id: Address` → `Option<Agent>` | Read an agent by owner address |
| `get_job` | `job_id: u64` → `Option<Job>` | Read a job |
| `job_count` / `agent_count` | → `u64` / `u32` | Number of jobs (IDs start at 1) / registered agents |
| `agent_at` | `index: u32` → `Address` | Agent owner by registration index (0-based) |

Status is saved before any outgoing transfer, and Completed/Refunded are final, so a job cannot be paid out twice. Every mutation publishes an event (`agent_registered`, `agent_updated`, `job_created`, `job_delivered`, `job_completed`, `job_released`, `job_refunded`, `agent_rated`) and storage TTL is extended on reads and writes.

### Constants

| Constant | Value |
|---|---|
| `MIN_DURATION_SECS` | 1 hour |
| `MAX_DURATION_SECS` | 30 days |
| `REVIEW_WINDOW_SECS` | 72 hours |
| Instance TTL | extended to 60 days when below 30 days |
| Agent / Job TTL | extended to 60 days when below 45 days |

### Limitations

- **No arbiter.** A client who is unhappy with a delivery can only ask the agent for a voluntary refund. Otherwise the funds go to the agent after 72 hours.
- **One agent per address.**
- **Reputation can still be inflated with two wallets** (self-deal from the same address is rejected, but two addresses owned by one person are not detectable).
- **Not audited by a third party. Testnet only.**

The deprecated v1 contract (`CBEIINKJ…BW5X`) has a different API (`token` parameter on `create_job`, `u64` amounts, unauthenticated `rate_agent`); see the [audit report](docs/audit/agero-audit.md).

---

## 🎨 Design System

"Forest ledger": flat dark forest surfaces (depth by lightness + 1 px borders, no glass or shadows), mint text, teal `#116466` as the only accent, peach `#FFCB9A` reserved for Sample/Simulated labels, sand `#D9B08C` for pending states and deadlines. Display font IBM Plex Sans Condensed, body Inter, system mono for hashes. Signature components: the hash chip (64 hex in a 4 × 16 block) and the deadline meter. Every text token pair is ≥ 4.5:1. Full rules: [docs/design-system.md](docs/design-system.md).

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Smart Contracts** | Rust + Soroban SDK |
| **Frontend** | React 19 + Vite 8 |
| **Styling** | Vanilla CSS with role tokens |
| **Icons** | Lucide React |
| **Blockchain** | Stellar Testnet + Horizon |
| **Wallet** | Freighter Browser Extension (`@stellar/freighter-api` 6.0.1, signs Soroban transactions) |
| **Stellar SDK** | `@stellar/stellar-sdk` 17.4 (Soroban RPC: simulate, assemble, send, poll) |
| **Payment Protocol** | x402 (local gateway demo) |

---

## 🔄 Escrow Flow

```
Client                    Smart Contract                 AI Agent Developer
  │                            │                              │
  ├── create_job (lock XLM) ──►│                              │
  │                            │◄────────── deliver_job ──────┤ (result hash)
  ├── complete_job ───────────►│── release funds ─────────────►│
  │   OR after 72 h, anyone:   │                              │
  │   release_job ────────────►│── release funds ─────────────►│
  │                            │                              │
  ├── rate_agent ─────────────►│── store rating               │
```

Contract v2 flow (deployed on Testnet; exercised by the CLI smoke test and by a manual Freighter test on 2026-11-01). In the web UI the client signs `create_job`, `complete_job`, `refund_job` and `rate_agent` in Freighter, and the agent signs `deliver_job`, `release_job` and `refund_job` from the Agent dashboard. Manual test pending for `refund_job` (both sides) and `release_job`. The agent's work happens outside Agero; `deliver_job` stores only its SHA-256 hash.
- **Token:** native XLM, fixed at deploy time.
- **Refund:** the client can refund only after the deadline if nothing was delivered; the agent can refund any time before payout. There is no arbiter.
- **Rating:** one 1–5 rating per Completed job, by that job's client.

Known issues and the full findings list: [docs/audit/agero-audit.md](docs/audit/agero-audit.md).

---

## 📄 License

MIT License — Built for the **Build on Stellar Bootcamp Bandung** hackathon.

---

<p align="center">
  <sub>Built with ❤️ using Stellar, Soroban, and React</sub>
</p>

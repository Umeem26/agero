<p align="center">
  <img src="frontend/public/favicon.svg" width="80" alt="Agero Logo" />
</p>

<h1 align="center">Agero</h1>
<p align="center">
  <strong>Decentralized AI Agent Escrow Platform on Stellar</strong>
</p>

<p align="center">
  <em>Prototype AI agent marketplace with a Soroban escrow contract on Stellar Testnet (UI not connected to the contract yet).</em>
</p>

<p align="center">
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

> **Prototype notice:** an escrow contract (v1) is deployed on Stellar Testnet and a redesigned v2 contract is written and unit-tested but **not deployed yet**. The web UI is **not connected to either contract**. Every transaction in the UI is simulated in the browser (`localStorage`), and the agents, ratings, job counts and reviews are sample data. See [Status](#-status) and the [audit report](docs/audit/agero-audit.md).

---

## 📌 Status

What actually works today (based on the [2026-10-25 audit](docs/audit/agero-audit.md), §6).

| Feature | Status | Notes |
|---|---|---|
| Escrow contract v2 (source in `contracts/agero-contract`) | ✅ Real | Deadlines, delivery step, 72 h auto-release, fixed XLM token, typed errors, events, TTL extension. 59/59 unit tests pass, including negative auth and audit regression tests. See [docs/contract-v2.md](docs/contract-v2.md) |
| Contract v2 deployed to Testnet | ⛔ Not yet | Scripts and steps are ready ([docs/deploy.md](docs/deploy.md)); no contract ID yet |
| Contract v1 on Testnet (`CBEIINKJ…BW5X`) | ⚠️ Deprecated | Still live; built from the v1 source (commit `b706175`), which no longer matches `main`. 1 contract invocation at audit time. Has the issues listed in the audit (F02, F04–F07, F11–F14) |
| Live web app (agero.vercel.app) | ✅ Real | Static React SPA |
| UI calls the contract (`create_job` / `complete_job` / `refund_job`) | ⛔ Not yet | No Stellar SDK, RPC or contract ID in the frontend |
| Lock / release / refund escrow in the UI | 🟡 Simulated | `setTimeout` + `localStorage`; reference IDs are random, not tx hashes |
| Agent registration in the UI | 🟡 Simulated | Saved in the browser only |
| 11 marketplace agents, ratings, job counts, reviews | 🟡 Simulated | Hardcoded sample data, marked "Sample" in the UI |
| Agent work output | 🟡 Simulated | Static images and template text; no AI model is called |
| x402 payment verification | 🟡 Simulated (live) | Live site always falls back to a browser simulation. The local gateway (`scripts/x402_simulator.js`) checks classic payments on Horizon but has a `MOCK_TX_*` bypass and is not linked to the escrow |
| Freighter wallet | 🟡 Partial | Connects and reads the address (Testnet check). Transactions are not signed or sent |
| Contract ratings | ⛔ Not yet (in UI) | v2: one 1–5 rating per Completed job, by that job's client (auth). v1 has no auth. The UI calls neither; text reviews live in `localStorage` |
| Deadlines | 🟡 v2 source only | Client picks a deadline (1 h – 30 d); not deployed yet |
| Dispute resolution | ⛔ None (by design) | v2 has no arbiter: after delivery the client has 72 h to approve, then anyone can release funds to the agent |
| Escrow token restriction | 🟡 v2 source only | v2 fixes the token to native XLM at deploy time; v1 accepts any token |
| Interactive 3D canvas | ✅ Real | HTML5 Canvas |

### 🔑 Contract Address (Testnet)

**v2:** not deployed yet (see [docs/deploy.md](docs/deploy.md)).

**v1 (deprecated):**

```
CBEIINKJWTVYY3WNJGWFWJECNLZHT2RA3YXATDLTGKZGFN5ZOMDRBW5X
```

> 🔗 v1 (deprecated): [View on Stellar Explorer](https://stellar.expert/explorer/testnet/contract/CBEIINKJWTVYY3WNJGWFWJECNLZHT2RA3YXATDLTGKZGFN5ZOMDRBW5X) · [View on Stellar Lab](https://lab.stellar.org/r/testnet/contract/CBEIINKJWTVYY3WNJGWFWJECNLZHT2RA3YXATDLTGKZGFN5ZOMDRBW5X)

---

## 🖼️ Screenshots

### Homepage — Interactive 3D Holographic AI Core
The landing page features a cursor-responsive 3D wireframe robot rendered on HTML5 Canvas, with orbiting particles and holographic scanlines.

<p align="center">
  <img src="docs/screenshots/01_homepage_hero.png" width="90%" alt="Homepage Hero" />
</p>

### AI Agent Marketplace
Browse 11 sample AI agents across Text AI, Creative AI, and Utility categories. Listings, ratings and outputs are hardcoded sample data (static images).

<p align="center">
  <img src="docs/screenshots/02_marketplace.png" width="90%" alt="Marketplace" />
</p>

### Agent Detail & Hire Flow
View agent capabilities, features and sample reviews, then simulate locking escrow funds (the UI is not connected to the Soroban contract yet).

<p align="center">
  <img src="docs/screenshots/03_agent_detail.png" width="45%" alt="Agent Detail" />
  <img src="docs/screenshots/04_escrow_modal.png" width="45%" alt="Escrow Modal" />
</p>

### How Agero Works — Connected M2M Timeline
A visual step-by-step workflow showing the escrow lifecycle from wallet connection to fund release.

<p align="center">
  <img src="docs/screenshots/06_how_it_works.png" width="90%" alt="How It Works" />
</p>

### Wallet Integration & Developer Portal
Connect via Freighter browser extension (address only, Testnet) or Demo mode. Register and manage your AI agents (simulated, stored in the browser).

<p align="center">
  <img src="docs/screenshots/05_wallet_connect.png" width="45%" alt="Wallet Connect" />
  <img src="docs/screenshots/07_developer_portal.png" width="45%" alt="Developer Portal" />
</p>

---

## 🏗️ Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                  Agero Frontend (React 19 + Vite 8)           │
│                                                               │
│  ┌───────────┐  ┌─────────────┐  ┌──────────────────────┐    │
│  │  Homepage  │  │ Marketplace │  │  Developer Portal    │    │
│  │ (3D Core) │  │ (11 Agents) │  │ (Register + Stats)   │    │
│  └───────────┘  └─────────────┘  └──────────────────────┘    │
│                                                               │
│        Freighter Wallet (address only) / Demo Mode            │
│        Transactions simulated in localStorage                 │
└────────────────────────┬──────────────────────────────────────┘
                         ┊
                         ┊  NOT CONNECTED YET (planned)
                         ┊
              ┌──────────▼──────────┐
              │  Soroban Contract   │
              │  v2 (WASM)          │
              │  not deployed yet   │
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
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │  Stellar Testnet    │
              │  (Horizon API)      │
              └─────────────────────┘
```

> The dotted link is not implemented: the frontend does not call the contract, Soroban RPC or Horizon yet.

---

## ⚡ Key Features

| Feature | Description |
|---|---|
| **AI Agent Marketplace** (sample data) | 11 sample agents: Summarizer Bot, Image Generator Pro, Translation Bot XL, Code Auditor AI, Data Analyst Bot, Voice Cloner AI, Music Composer AI, SEO Optimizer Bot, Chatbot Assistant, Sentiment Analyst, Video Generator AI |
| **Soroban Escrow** (contract only, v2 not deployed) | v2 locks native XLM in `create_job` with a client-chosen deadline. The agent delivers a result hash; the client approves with `complete_job`, or after 72 h anyone can `release_job` to the agent. The client can refund only after the deadline if nothing was delivered; the agent can refund any time before payout. No arbiter. The UI does not call the contract yet |
| **x402 Payment Protocol** (demo) | Payment header passed over HTTP to a local gateway demo; simulated on the live site |
| **Interactive 3D Core** | Cursor-responsive holographic wireframe AI robot on HTML5 Canvas |
| **Freighter Integration** (address only) | Connect a Freighter wallet on Testnet to read its address, or use built-in Demo mode. No transactions are signed yet |
| **Liquid Glass UI** | Premium dark glassmorphic design with digital blueprint grid background |
| **Rating System** (simulated) | Star ratings and text reviews stored in the browser. Contract v2 has `rate_agent` (stars only, one per Completed job, client auth) but the UI does not call it |

---

## 🚀 Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) with `wasm32` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli) v22+
- [Node.js](https://nodejs.org/) v18+
- [Freighter Wallet](https://freighter.app/) browser extension (optional)

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

### 4. Run Frontend Locally

```bash
cd frontend
npm run dev
```

### 5. Build for Production

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
│   ├── public/                  # Agent sample images & favicon
│   ├── src/
│   │   ├── App.jsx              # Main React SPA (1200+ lines)
│   │   ├── index.css            # Dark liquid glass theme system
│   │   └── utils/wallet.js     # Freighter wallet integration
│   └── index.html
├── scripts/
│   ├── x402_simulator.js       # Local x402 payment gateway simulator
│   ├── deploy-testnet.ps1      # Build + deploy contract v2 (not run yet)
│   └── smoke-testnet.ps1       # register → create → deliver → complete → rate
├── docs/
│   ├── contract-v2.md           # State machine, events, errors, audit → test map
│   ├── deploy.md                # Testnet deploy steps
│   ├── audit/                   # Audit report + phase screenshots
│   ├── screenshots/             # App screenshots for README
│   └── *.md                     # Implementation plans
├── tool/
│   └── honesty_gate.sh          # Fails if banned overclaiming phrases appear
├── Cargo.toml                   # Rust workspace configuration
└── README.md
```

---

## 📜 Smart Contract API (v2)

Contract v2 in [`contracts/agero-contract/src/lib.rs`](contracts/agero-contract/src/lib.rs). Unit-tested (59/59), **not deployed yet**. Full transition table, events and error codes: [docs/contract-v2.md](docs/contract-v2.md).

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

### Color Palette

| Color | Hex | Usage |
|---|---|---|
| Deep Forest | `#2C3531` | Card backgrounds, glass surfaces |
| Teal | `#116466` | Primary accent, borders, glows |
| Sand Clay | `#D9B08C` | Secondary highlights |
| Peach Warm | `#FFCB9A` | Active states, CTAs, eye glow |
| Mint Ice | `#D1E8E2` | Body text, high readability |

### Design Features
- **Liquid Glass Morphism** — `backdrop-filter: blur(20px)` with radial gradient hover effects
- **Digital Blueprint Grid** — 45px coordinate grid with ambient scanner pulse
- **3D Canvas Rendering** — Perspective-projected wireframe with depth-aware coloring
- **Micro-animations** — Smooth transitions on all interactive elements

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Smart Contracts** | Rust + Soroban SDK |
| **Frontend** | React 19 + Vite 8 |
| **Styling** | Vanilla CSS (Liquid Glass) |
| **Icons** | Lucide React |
| **3D Graphics** | HTML5 Canvas API |
| **Blockchain** | Stellar Testnet + Horizon |
| **Wallet** | Freighter Browser Extension (address only) |
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

Contract v2 flow (not deployed yet); the web UI simulates these steps and does not call any contract.
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

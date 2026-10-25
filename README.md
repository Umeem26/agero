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
    <img src="https://img.shields.io/badge/Contract-Stellar%20Testnet-blue?style=for-the-badge&logo=stellar" alt="Contract" />
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

> **Prototype notice:** the escrow contract is deployed on Stellar Testnet, but the web UI is **not connected to it yet**. Every transaction in the UI is simulated in the browser (`localStorage`), and the agents, ratings, job counts and reviews are sample data. See [Status](#-status) and the [audit report](docs/audit/agero-audit.md).

---

## 📌 Status

What actually works today (based on the [2026-10-25 audit](docs/audit/agero-audit.md), §6).

| Feature | Status | Notes |
|---|---|---|
| Soroban escrow contract on Testnet (`CBEIINKJ…BW5X`) | ✅ Real | Builds, 5/5 unit tests pass, deployed WASM matches the source. 1 on-chain invocation as of the audit |
| Live web app (agero.vercel.app) | ✅ Real | Static React SPA |
| UI calls the contract (`create_job` / `complete_job` / `refund_job`) | ⛔ Not yet | No Stellar SDK, RPC or contract ID in the frontend |
| Lock / release / refund escrow in the UI | 🟡 Simulated | `setTimeout` + `localStorage`; reference IDs are random, not tx hashes |
| Agent registration in the UI | 🟡 Simulated | Saved in the browser only |
| 11 marketplace agents, ratings, job counts, reviews | 🟡 Simulated | Hardcoded sample data, marked "Sample" in the UI |
| Agent work output | 🟡 Simulated | Static images and template text; no AI model is called |
| x402 payment verification | 🟡 Simulated (live) | Live site always falls back to a browser simulation. The local gateway (`scripts/x402_simulator.js`) checks classic payments on Horizon but has a `MOCK_TX_*` bypass and is not linked to the escrow |
| Freighter wallet | 🟡 Partial | Connects and reads the address (Testnet check). Transactions are not signed or sent |
| On-chain ratings | ⛔ Not yet (in UI) | Contract stores 1–5 stars without auth; the UI does not call it. Text reviews live in `localStorage` |
| Deadlines / dispute resolution | ⛔ Not yet | Client or agent can refund while the job is Pending; there is no deadline or dispute flow |
| Escrow token restriction | ⛔ Not yet | Token is supplied by the caller; not restricted |
| Interactive 3D canvas | ✅ Real | HTML5 Canvas |

### 🔑 Contract Address (Testnet)

```
CBEIINKJWTVYY3WNJGWFWJECNLZHT2RA3YXATDLTGKZGFN5ZOMDRBW5X
```

> 🔗 [View on Stellar Explorer](https://stellar.expert/explorer/testnet/contract/CBEIINKJWTVYY3WNJGWFWJECNLZHT2RA3YXATDLTGKZGFN5ZOMDRBW5X) · [View on Stellar Lab](https://lab.stellar.org/r/testnet/contract/CBEIINKJWTVYY3WNJGWFWJECNLZHT2RA3YXATDLTGKZGFN5ZOMDRBW5X)

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
              │  Soroban Smart      │
              │  Contract (WASM)    │
              │  ─────────────────  │
              │  register_agent     │
              │  create_job         │
              │  complete_job       │
              │  refund_job         │
              │  rate_agent         │
              │  get_agent          │
              │  update_agent       │
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
| **Soroban Escrow** (contract only) | The contract locks funds in `create_job` and releases them to the agent in `complete_job` (client auth). The client or the agent can refund while the job is Pending; there is no deadline or dispute mechanism yet. The UI does not call the contract yet |
| **x402 Payment Protocol** (demo) | Payment header passed over HTTP to a local gateway demo; simulated on the live site |
| **Interactive 3D Core** | Cursor-responsive holographic wireframe AI robot on HTML5 Canvas |
| **Freighter Integration** (address only) | Connect a Freighter wallet on Testnet to read its address, or use built-in Demo mode. No transactions are signed yet |
| **Liquid Glass UI** | Premium dark glassmorphic design with digital blueprint grid background |
| **Rating System** (simulated) | Star ratings and text reviews stored in the browser. The contract has `rate_agent` (stars only, no auth yet) but the UI does not call it |

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

### 2. Build Smart Contract

```bash
stellar contract build
```

### 3. Deploy to Testnet

```bash
stellar keys generate deployer --network testnet --fund

stellar contract deploy \
  --wasm target/wasm32v1-none/release/agero_contract.wasm \
  --source-account deployer \
  --network testnet
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
│       │   ├── lib.rs           # Contract logic (escrow, agents, jobs)
│       │   └── test.rs          # Unit tests
│       └── Cargo.toml
├── frontend/
│   ├── public/                  # Agent sample images & favicon
│   ├── src/
│   │   ├── App.jsx              # Main React SPA (1200+ lines)
│   │   ├── index.css            # Dark liquid glass theme system
│   │   └── utils/wallet.js     # Freighter wallet integration
│   └── index.html
├── scripts/
│   └── x402_simulator.js       # Local x402 payment gateway simulator
├── docs/
│   ├── audit/                   # Audit report + phase screenshots
│   ├── screenshots/             # App screenshots for README
│   └── *.md                     # Implementation plans
├── tool/
│   └── honesty_gate.sh          # Fails if banned overclaiming phrases appear
├── Cargo.toml                   # Rust workspace configuration
└── README.md
```

---

## 📜 Smart Contract API

Signatures from [`contracts/agero-contract/src/lib.rs`](contracts/agero-contract/src/lib.rs) (`env: Env` omitted).

| Function | Parameters | Description |
|---|---|---|
| `register_agent` | `owner: Address, name: String, description: String, api_url: String, price: u64` | Register an agent (owner auth). One agent per address |
| `update_agent` | `owner: Address, name: String, description: String, api_url: String, price: u64` | Update an existing agent (owner auth) |
| `get_agent` | `id: Address` → `Option<Agent>` | Read an agent by owner address |
| `create_job` | `client: Address, agent_owner: Address, token: Address, amount: u64` → `u64` | Transfer `amount` of `token` from client to the contract (client auth, `amount >= price`). Token is supplied by the caller; not restricted |
| `complete_job` | `job_id: u64` | Release funds to the agent (client auth, job must be Pending) |
| `refund_job` | `job_id: u64, caller: Address` | Return funds to the client. `caller` must be the client or the agent; only while Pending. No deadline or dispute check |
| `rate_agent` | `id: Address, rating: u32` | Add a 1–5 star rating. No auth and not tied to a job yet |

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
  ├── create_job (lock token)─►│                              │
  │                            │◄── x402 API call ───────────►│
  │                            │    (task execution)           │
  ├── complete_job ───────────►│── release funds ─────────────►│
  │        OR                  │                              │
  ├── refund_job ─────────────►│── return funds ──────────────►│ (back to client)
  │                            │                              │
  ├── rate_agent ─────────────►│── store rating ──────────────►│
  │                            │                              │
```

Contract-level flow only; the web UI simulates these steps and does not call the contract yet.
- **Token:** supplied by the caller of `create_job`; not restricted to XLM or USDC yet.
- **Refund:** the client or the agent can refund while the job is Pending. There is no deadline or dispute mechanism yet.
- **Rating:** `rate_agent` has no auth and is not tied to a completed job yet.

Known issues and the full findings list: [docs/audit/agero-audit.md](docs/audit/agero-audit.md).

---

## 📄 License

MIT License — Built for the **Build on Stellar Bootcamp Bandung** hackathon.

---

<p align="center">
  <sub>Built with ❤️ using Stellar, Soroban, and React</sub>
</p>

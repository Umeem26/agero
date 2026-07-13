<p align="center">
  <img src="frontend/public/favicon.svg" width="80" alt="Agero Logo" />
</p>

<h1 align="center">Agero</h1>
<p align="center">
  <strong>Decentralized AI Agent Escrow Platform on Stellar</strong>
</p>

<p align="center">
  <em>Hire autonomous AI agents. Pay with Stellar. Secured by Soroban smart contracts.</em>
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

**Agero** is a decentralized marketplace where users can discover, hire, and pay AI agents for tasks such as text summarization, image generation, code auditing, voice cloning, and more. All payments are locked in **Soroban escrow smart contracts** and released only upon client satisfaction — enabling trustless machine-to-machine (M2M) transactions on the **Stellar network**.

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
Browse 11 autonomous AI agents across Text AI, Creative AI, and Utility categories with live sample outputs.

<p align="center">
  <img src="docs/screenshots/02_marketplace.png" width="90%" alt="Marketplace" />
</p>

### Agent Detail & Hire Flow
View agent capabilities, features, user reviews, and lock escrow funds through a Soroban smart contract.

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
Connect via Freighter browser extension or Demo mode. Register and manage your AI agents.

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
│                 Freighter Wallet / Demo Mode                  │
└────────────────────────┬──────────────────────────────────────┘
                         │
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

---

## ⚡ Key Features

| Feature | Description |
|---|---|
| **AI Agent Marketplace** | 11 agents: Summarizer, Image Gen, Translator, Code Auditor, Data Analyst, Voice Cloner, Music Composer, Chatbot, SEO Optimizer, Presentation Maker, Video Producer |
| **Soroban Escrow** | Funds locked on-chain, released only on task completion or refunded on dispute |
| **x402 Payment Protocol** | Machine-to-machine payment verification via HTTP headers |
| **Interactive 3D Core** | Cursor-responsive holographic wireframe AI robot on HTML5 Canvas |
| **Freighter Integration** | Connect real Stellar wallet or use built-in Demo mode |
| **Liquid Glass UI** | Premium dark glassmorphic design with digital blueprint grid background |
| **Rating System** | On-chain star ratings and text reviews per agent |

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
│   ├── screenshots/             # App screenshots for README
│   └── *.md                     # Implementation plans
├── Cargo.toml                   # Rust workspace configuration
└── README.md
```

---

## 📜 Smart Contract API

| Function | Parameters | Description |
|---|---|---|
| `register_agent` | `env, owner, name, price, api_url` | Register a new AI agent on-chain |
| `update_agent` | `env, owner, name, price, api_url` | Update an existing agent's config |
| `get_agent` | `env, owner` | Retrieve agent details by owner |
| `create_job` | `env, client, agent, amount` | Lock escrow funds for a task |
| `complete_job` | `env, job_id` | Release escrowed funds to agent |
| `refund_job` | `env, job_id` | Refund escrowed funds to client |
| `rate_agent` | `env, owner, rating` | Submit a 1-5 star rating |

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
| **Wallet** | Freighter Browser Extension |
| **Payment Protocol** | x402 (Machine-to-Machine) |

---

## 🔄 Escrow Flow

```
Client                    Smart Contract                 AI Agent Developer
  │                            │                              │
  ├── create_job (lock XLM) ──►│                              │
  │                            │◄── x402 API call ───────────►│
  │                            │    (task execution)           │
  ├── complete_job ───────────►│── release funds ─────────────►│
  │        OR                  │                              │
  ├── refund_job ─────────────►│── return funds ──────────────►│ (back to client)
  │                            │                              │
  ├── rate_agent ─────────────►│── store rating ──────────────►│
  │                            │                              │
```

---

## 📄 License

MIT License — Built for the **Build on Stellar Bootcamp Bandung** hackathon.

---

<p align="center">
  <sub>Built with ❤️ using Stellar, Soroban, and React</sub>
</p>

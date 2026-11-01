# Screenshots

| | |
|---|---|
| Captured | 2026-11-01 16:52 UTC |
| Base URL | `http://localhost:4173`: `vite preview` of the production build of the commit that added these files, reading contract v2 on live Stellar Testnet, no wallet connected. agero.vercel.app shows the same UI once that commit is deployed |
| Latest ledger read | 5,505,663 (Contract pulse on the home page; closed 2026-11-01 16:52:35 UTC) |
| Contract | v2 `CA5CMRJJ…LBDFB`: `agent_count` 13, `job_count` 2 at capture time |
| Tool | `node scripts/capture-screens.mjs --base http://localhost:4173`: Playwright 1.64.1 driving installed Chromium 153, PNG at device scale 2 into `screenshots-out/` (gitignored); the six below were downscaled to scale 1 and saved as JPG quality 90 |

The script only navigates and clicks; nothing is mocked and the DOM is not changed. It exits non-zero if an RPC
error banner appears or a loading skeleton never clears, so every value shown was read from the contract.
No screen shows a secret: no wallet is connected and only public addresses appear.

| File | Size | What it shows |
|---|---|---|
| `home-1440.jpg` | 1440×1865, 259 KB | Home: Testnet banner, escrow timeline (an illustration, labelled as such), Contract pulse, registered agents, state diagram |
| `marketplace-1440.jpg` | 1440×1826, 258 KB | All 13 registered agents; 11 seeded agents carry the "Sample" badge |
| `agent-detail-sample-1440.jpg` | 1440×900, 124 KB | Sample agent "Summarizer Bot": placeholder endpoint, no work performed |
| `agent-detail-uji-3b-1440.jpg` | 1440×900, 85 KB | "Uji 3b", the agent from the 2026-11-01 manual Freighter test: 1 completed job, rating 4, endpoint "Not set" |
| `agent-dashboard-disconnected-1440.jpg` | 1440×900, 90 KB | Agent dashboard before a wallet is connected |
| `agent-detail-sample-375.jpg` | 375×1540, 108 KB | Sample agent detail on a 375 px phone |

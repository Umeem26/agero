# Screenshots

| | |
|---|---|
| Captured | 2026-11-01 15:54 UTC |
| Base URL | https://agero.vercel.app (live deployment, no wallet connected) |
| Latest ledger read | 5,504,970 (Contract pulse on the home page; closed 2026-11-01 15:54:50 UTC) |
| Contract | v2 `CA5CMRJJ…LBDFB`: `agent_count` 13, `job_count` 2 at capture time |
| Tool | `node scripts/capture-screens.mjs`: Playwright 1.64.1 driving installed Chromium 153, PNG at device scale 2 into `screenshots-out/` (gitignored); the six below were downscaled to scale 1 and saved as JPG quality 90 |

The script only navigates and clicks; nothing is mocked and the DOM is not changed. It exits non-zero if an RPC
error banner appears or a loading skeleton never clears, so every value shown was read from the contract.

| File | Size | What it shows |
|---|---|---|
| `home-1440.jpg` | 1440×1865, 259 KB | Home: escrow timeline (an illustration, labelled as such), Contract pulse, registered agents, state diagram |
| `marketplace-1440.jpg` | 1440×1826, 257 KB | All 13 registered agents; 11 seeded agents carry the "Sample" badge |
| `agent-detail-sample-1440.jpg` | 1440×900, 124 KB | Sample agent "Summarizer Bot": placeholder endpoint, no work performed |
| `agent-detail-uji-3b-1440.jpg` | 1440×900, 87 KB | "Uji 3b", the agent from the 2026-11-01 manual Freighter test: 1 completed job, rating 4 |
| `agent-dashboard-disconnected-1440.jpg` | 1440×900, 89 KB | Agent dashboard before a wallet is connected |
| `agent-detail-sample-375.jpg` | 375×1540, 107 KB | Sample agent detail on a 375 px phone |

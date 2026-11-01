# Security

- **Testnet only.** Agero is a prototype; its contract runs on Stellar Testnet and is not audited by a third party. Never use it with Mainnet funds or a Mainnet key.
- **Never send secrets.** Do not paste a secret key (`S…`), seed phrase or `.env` file into an issue, pull request, commit or chat. `VITE_*` values end up in the browser bundle, so they must stay public.
- The phase 5a agent reads its key only from the `AGERO_AGENT_SECRET` environment variable of the operator's shell; it is never stored in the repo.

## Reporting a vulnerability

Use GitHub's private report form (Security tab → "Report a vulnerability") on [Umeem26/agero](https://github.com/Umeem26/agero), or open an issue that contains **no exploit details or secrets** and ask for a private channel. Include the affected file or contract function, steps to reproduce on Testnet and the expected impact. Reports are handled on a best-effort basis.

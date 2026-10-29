import { StrKey } from '@stellar/stellar-sdk';

// Defaults = Agero contract v2 on Stellar Testnet (docs/deploy.md §6).
// Override with VITE_* variables in frontend/.env.local (see frontend/.env.example).
const DEFAULTS = {
  CONTRACT_ID: 'CA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB',
  RPC_URL: 'https://soroban-testnet.stellar.org',
  NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  XLM_SAC: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  EXPLORER_URL: 'https://stellar.expert/explorer/testnet',
};

const env = import.meta.env || {};
const pick = (key) => (env[`VITE_${key}`] || DEFAULTS[key]).trim();

export const CONFIG = Object.freeze({
  contractId: pick('CONTRACT_ID'),
  rpcUrl: pick('RPC_URL'),
  networkPassphrase: pick('NETWORK_PASSPHRASE'),
  xlmSac: pick('XLM_SAC'),
  explorerUrl: pick('EXPLORER_URL').replace(/\/+$/, ''),
});

function validate(cfg) {
  if (!StrKey.isValidContract(cfg.contractId)) return `VITE_CONTRACT_ID is not a valid contract address: "${cfg.contractId}"`;
  if (!StrKey.isValidContract(cfg.xlmSac)) return `VITE_XLM_SAC is not a valid contract address: "${cfg.xlmSac}"`;
  if (!/^https?:\/\//.test(cfg.rpcUrl)) return `VITE_RPC_URL must be an http(s) URL: "${cfg.rpcUrl}"`;
  if (!cfg.networkPassphrase) return 'VITE_NETWORK_PASSPHRASE is empty';
  return null;
}

// null when the config is usable; otherwise a message the UI shows instead of calling the network
export const CONFIG_ERROR = validate(CONFIG);

export const explorerTxUrl = (hash) => `${CONFIG.explorerUrl}/tx/${hash}`;
export const explorerContractUrl = (id = CONFIG.contractId) => `${CONFIG.explorerUrl}/contract/${id}`;
export const explorerAccountUrl = (address) => `${CONFIG.explorerUrl}/account/${address}`;

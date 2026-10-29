import { isConnected, requestAccess, getAddress, getNetworkDetails, signTransaction } from '@stellar/freighter-api';
import { CONFIG } from './config';
import { ChainError, describeWalletError } from './errors';

function withTimeout(promise, timeoutMs, errorMsg) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new ChainError(errorMsg, { kind: 'wallet' })), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function assertNetwork() {
  const net = await withTimeout(getNetworkDetails(), 3000, 'Freighter network check timed out.');
  if (net.error) throw new ChainError(describeWalletError(net.error), { kind: 'wallet' });
  if (net.networkPassphrase !== CONFIG.networkPassphrase) {
    throw new ChainError(
      `Freighter is on ${net.network || 'another network'}. Switch Freighter to Testnet and try again.`,
      { kind: 'wallet', code: 'WRONG_NETWORK' },
    );
  }
}

// Ask Freighter for access and return the address. Rejects unless Freighter is on the configured network.
export async function connectFreighter() {
  const connection = await withTimeout(
    isConnected(),
    3000,
    'Freighter extension detection timed out. Make sure the Freighter browser extension is installed.',
  );
  if (connection.error) throw new ChainError(describeWalletError(connection.error), { kind: 'wallet' });
  if (!connection.isConnected) {
    throw new ChainError('Freighter is not installed in this browser. Install the Freighter extension first.', { kind: 'wallet' });
  }

  const access = await withTimeout(
    requestAccess(),
    60000,
    'Freighter access approval timed out. Open the Freighter popup and accept the request.',
  );
  if (access.error) throw new ChainError(describeWalletError(access.error), { kind: 'wallet' });

  await assertNetwork();
  return access.address;
}

// Sign a prepared transaction XDR with Freighter as `address`. Re-checks network and active account first.
export async function signWithFreighter(txXdr, address) {
  await assertNetwork();
  const current = await withTimeout(getAddress(), 3000, 'Freighter address check timed out.');
  if (current.error) throw new ChainError(describeWalletError(current.error), { kind: 'wallet' });
  if (current.address && current.address !== address) {
    throw new ChainError('The active Freighter account changed. Reconnect the wallet and try again.', { kind: 'wallet', code: 'ACCOUNT_CHANGED' });
  }

  const res = await withTimeout(
    signTransaction(txXdr, { networkPassphrase: CONFIG.networkPassphrase, address }),
    300000,
    'Freighter signing timed out. Nothing was sent.',
  );
  if (res.error) throw new ChainError(describeWalletError(res.error), { kind: 'wallet', code: res.error.code ?? null });
  if (!res.signedTxXdr) throw new ChainError('Freighter returned no signed transaction. Nothing was sent.', { kind: 'wallet' });
  if (res.signerAddress && res.signerAddress !== address) {
    throw new ChainError('Freighter signed with a different account. Nothing was sent.', { kind: 'wallet' });
  }
  return res.signedTxXdr;
}

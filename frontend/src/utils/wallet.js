import { isConnected, requestAccess, getNetwork } from '@stellar/freighter-api';

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
export const DEMO_ADDRESS = 'GBDEMO7777777777777777777777777777777777777777777777AGERO';

function withTimeout(promise, timeoutMs, errorMsg) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Freighter returns errors as FreighterApiError objects ({ code, message }), not strings
function freighterErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return error.message || fallback;
}

export async function connectWallet(isDemoMode = false) {
  if (isDemoMode) {
    // Simulate instant connection for demo UI/UX
    return DEMO_ADDRESS;
  }

  try {
    // 3-second timeout for checking Freighter existence
    const connection = await withTimeout(
      isConnected(),
      3000,
      "Freighter extension detection timed out. Please make sure the Freighter browser extension is installed."
    );

    if (connection.error) {
      throw new Error(freighterErrorMessage(connection.error, "Failed to detect Freighter Wallet"));
    }
    if (!connection.isConnected) {
      throw new Error("Freighter Wallet is not installed in your browser. Please install the Freighter extension.");
    }

    // 15-second timeout for waiting for user approval in the popup window
    const access = await withTimeout(
      requestAccess(),
      15000,
      "Freighter access approval timed out. Please open your Freighter extension popup and accept the request."
    );

    if (access.error) {
      throw new Error(freighterErrorMessage(access.error, "Freighter access was denied"));
    }

    const net = await withTimeout(getNetwork(), 3000, "Freighter network check timed out.");
    if (net.error) {
      throw new Error(freighterErrorMessage(net.error, "Failed to read Freighter network"));
    }
    if (net.network !== 'TESTNET' && net.networkPassphrase !== TESTNET_PASSPHRASE) {
      throw new Error(`Freighter is on ${net.network || 'an unknown network'}. Please switch Freighter to Testnet and try again.`);
    }

    return access.address; // Return user wallet address
  } catch (error) {
    throw new Error(error.message || "Failed to connect to Freighter Wallet");
  }
}

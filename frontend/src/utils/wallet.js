import { isConnected, requestAccess } from '@stellar/freighter-api';

function withTimeout(promise, timeoutMs, errorMsg) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), timeoutMs))
  ]);
}

export async function connectWallet(isDemoMode = false) {
  if (isDemoMode) {
    // Simulate instant connection for demo UI/UX
    return 'GBDEMO7777777777777777777777777777777777777777777777AGERO';
  }

  try {
    // 3-second timeout for checking Freighter existence
    const connection = await withTimeout(
      isConnected(),
      3000,
      "Freighter extension detection timed out. Please make sure the Freighter browser extension is installed."
    );

    if (!connection) {
      throw new Error("Freighter Wallet is not installed in your browser. Please install the Freighter extension.");
    }

    // 15-second timeout for waiting for user approval in the popup window
    const access = await withTimeout(
      requestAccess(),
      15000,
      "Freighter access approval timed out. Please open your Freighter extension popup and accept the request."
    );

    if (access.error) {
      throw new Error(access.error);
    }

    return access.address; // Return user wallet address
  } catch (error) {
    throw new Error(error.message || "Failed to connect to Freighter Wallet");
  }
}

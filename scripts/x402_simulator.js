const express = require('express');
const { Horizon } = require('stellar-sdk');

const app = express();
const port = 3000;

// Hubungkan ke Stellar Testnet
const server = new Horizon.Server('https://horizon-testnet.stellar.org');

// Alamat dompet target milik AI Agent (untuk menampung dana)
const AGENT_WALLET_ADDRESS = 'GBBD47IF6LWK7P7MDEVFAJFBMX65E54UG6TYGLMTVKVTCWCE6HTURT7B'; 
const EXPECTED_AMOUNT = '1.0000000'; // Contoh: 1 XLM / USDC per pemanggilan API

app.use(express.json());

// CORS Middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Stellar-Payment-Tx');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Verification Middleware
async function verifyX402Payment(req, res, next) {
    const txHash = req.headers['x-stellar-payment-tx'];

    if (!txHash) {
        return res.status(402).json({
            error: 'Payment Required',
            message: 'x402 Protocol: Missing X-Stellar-Payment-Tx header.'
        });
    }

    // --- MODE MOCK UNTUK PENGUJIAN LOKAL ---
    if (txHash === 'MOCK_TX_XLM') {
        console.log(`[x402] Mock verification: Simulating successful XLM payment of ${EXPECTED_AMOUNT} to ${AGENT_WALLET_ADDRESS}`);
        req.paymentDetails = { asset: 'XLM', amount: EXPECTED_AMOUNT, method: 'MOCK' };
        return next();
    }
    
    if (txHash === 'MOCK_TX_USDC') {
        console.log(`[x402] Mock verification: Simulating successful USDC payment of ${EXPECTED_AMOUNT} to ${AGENT_WALLET_ADDRESS}`);
        req.paymentDetails = { asset: 'USDC', amount: EXPECTED_AMOUNT, method: 'MOCK' };
        return next();
    }
    // ----------------------------------------

    try {
        console.log(`[x402] Verifying payment transaction on Horizon Testnet: ${txHash}...`);

        // 1. Query transaksi dari Stellar Horizon
        const tx = await server.transactions().transaction(txHash).call();
        const operations = await tx.operations();

        // 2. Analisis seluruh records operasi transaksi
        let paymentIsValid = false;
        let detectedAsset = '';

        for (let op of operations.records) {
            // Kita dukung operasi 'payment' (pengiriman native/token standard)
            if (op.type === 'payment' && op.to === AGENT_WALLET_ADDRESS && op.amount === EXPECTED_AMOUNT) {
                // Periksa jenis aset: native (XLM) atau USDC
                if (op.asset_type === 'native') {
                    paymentIsValid = true;
                    detectedAsset = 'XLM';
                    break;
                } else if (op.asset_code === 'USDC') {
                    paymentIsValid = true;
                    detectedAsset = 'USDC';
                    break;
                }
            }
        }

        if (!paymentIsValid) {
            return res.status(402).json({
                error: 'Payment Invalid',
                message: `x402 Protocol: Transaction did not transfer ${EXPECTED_AMOUNT} (XLM or USDC) to the agent wallet (${AGENT_WALLET_ADDRESS}).`
            });
        }

        console.log(`[x402] Payment verified successfully! Asset: ${detectedAsset}, Amount: ${EXPECTED_AMOUNT}`);
        req.paymentDetails = { asset: detectedAsset, amount: EXPECTED_AMOUNT, method: 'HORIZON_LIVE' };
        next();

    } catch (error) {
        console.error('[x402] Payment verification failed:', error.message);
        return res.status(402).json({
            error: 'Payment Verification Failed',
            message: 'x402 Protocol: Transaction not found on Stellar Testnet or invalid.'
        });
    }
}

// Gunakan Verification Middleware pada endpoint AI Agent
app.post('/api/summarize', verifyX402Payment, (req, res) => {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid input. Field "text" is required.'
        });
    }

    console.log('Processing text summarization...');
    const summary = `[SUMMARY] Ringkasan teks Anda: "${text.substring(0, 50)}..." (Teks asli memiliki panjang ${text.length} karakter).`;

    return res.status(200).json({
        success: true,
        summary: summary,
        payment: req.paymentDetails,
        payment_tx: req.headers['x-stellar-payment-tx']
    });
});

app.listen(port, () => {
    console.log(`=======================================================`);
    console.log(`AI Agent API Gateway running at http://localhost:${port}`);
    console.log(`Expected target wallet: ${AGENT_WALLET_ADDRESS}`);
    console.log(`Expected cost per call: ${EXPECTED_AMOUNT} (XLM or USDC)`);
    console.log(`=======================================================`);
});

# Rencana 3: Integrasi Gateway & Pembayaran x402 (M2M)

Rencana ini memandu Anda dalam mensimulasikan protokol **x402 (Agentic Payments)** di sisi server API Agen menggunakan Node.js.

---

## 1. Persiapan Dependensi Node.js

Buat folder `scripts/` (jika belum ada) di root proyek Anda, lalu inisiasi package Node.js di luar folder Rust atau jalankan perintah berikut untuk menginstal SDK Stellar di terminal:
```bash
npm install stellar-sdk express
```

---

## 2. Server Gateway API (`scripts/x402_simulator.js`)

Buat berkas **`scripts/x402_simulator.js`** dan masukkan kode berikut untuk memverifikasi pembayaran on-chain sebelum memproses API request:

```javascript
const express = require('express');
const { Horizon } = require('stellar-sdk');

const app = express();
const port = 3000;

// Hubungkan ke Stellar Testnet
const server = new Horizon.Server('https://horizon-testnet.stellar.org');

// Alamat dompet target milik AI Agent (untuk menampung dana)
const AGENT_WALLET_ADDRESS = 'GBX_MOCK_WALLET_ADDRESS_REPLACE_WITH_YOURS'; 
const EXPECTED_AMOUNT = '1.0000000'; // Contoh: 1 XLM / USDC per pemanggilan API

app.use(express.json());

app.post('/api/summarize', async (req, res) => {
    // 1. Ambil hash transaksi dari header HTTP x402
    const txHash = req.headers['x-stellar-payment-tx'];

    if (!txHash) {
        return res.status(402).json({
            error: 'Payment Required',
            message: 'x402 Protocol: Missing X-Stellar-Payment-Tx header.'
        });
    }

    try {
        console.log(`Verifying payment tx: ${txHash}...`);

        // 2. Query transaksi langsung ke Stellar Ledger (Testnet)
        const tx = await server.transactions().transaction(txHash).call();
        const operations = await tx.operations();

        // 3. Verifikasi operasi pembayaran dalam transaksi
        let paymentIsValid = false;

        for (let op of operations.records) {
            if (op.type === 'payment' && op.to === AGENT_WALLET_ADDRESS && op.amount === EXPECTED_AMOUNT) {
                paymentIsValid = true;
                break;
            }
        }

        if (!paymentIsValid) {
            return res.status(402).json({
                error: 'Payment Invalid',
                message: `x402 Protocol: Transaction did not transfer ${EXPECTED_AMOUNT} to the agent wallet.`
            });
        }

        // 4. Pembayaran Valid! Proses permintaan layanan AI
        const { text } = req.body;
        console.log('Payment verified! Processing text summarization...');
        
        const summary = `[SUMMARY] Ringkasan teks Anda: "${text.substring(0, 50)}..." (Teks asli memiliki panjang ${text.length} karakter).`;

        return res.status(200).json({
            success: true,
            summary: summary,
            payment_tx: txHash
        });

    } catch (error) {
        console.error('Payment verification failed:', error.message);
        return res.status(402).json({
            error: 'Payment Verification Failed',
            message: 'x402 Protocol: Transaction not found or invalid.'
        });
    }
});

app.listen(port, () => {
    console.log(`AI Agent API Gateway running at http://localhost:${port}`);
    console.log(`Expected target wallet: ${AGENT_WALLET_ADDRESS}`);
});
```

---

## 3. Script Penguji Pembeli (`scripts/test_x402.js`)

Buat berkas **`scripts/test_x402.js`** untuk mensimulasikan permintaan klien yang melakukan pembayaran on-chain terlebih dahulu dan melampirkan hash-nya ke request:

```javascript
const axios = require('axios');

async function testRequest() {
    // Masukkan hash transaksi testnet pembayaran asli yang sukses ke alamat agen Anda
    const mockTxHash = '76e287a9df2c...'; // Dapatkan hash dari Stellar Lab / transaction submit

    try {
        console.log('Sending API Request with x402 payment header...');
        const response = await axios.post('http://localhost:3000/api/summarize', {
            text: 'Stellar adalah blockchain open-source yang dirancang untuk mempercepat pembayaran lintas batas secara murah dan terdesentralisasi menggunakan stablecoin.'
        }, {
            headers: {
                'X-Stellar-Payment-Tx': mockTxHash
            }
        });

        console.log('Response Success:', response.data);
    } catch (error) {
        if (error.response) {
            console.log('Response Error:', error.response.status, error.response.data);
        } else {
            console.log('Error:', error.message);
        }
    }
}

testRequest();
```

---

## 4. Pengujian Rencana 3
1. Jalankan server simulator di terminal:
   ```bash
   node scripts/x402_simulator.js
   ```
2. Kirim request uji menggunakan script pembeli di terminal kedua:
   ```bash
   node scripts/test_x402.js
   ```
3. Verifikasi respons sukses `200 OK` dengan data ringkasan teks.

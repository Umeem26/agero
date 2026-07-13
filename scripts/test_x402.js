const axios = require('axios');

const GATEWAY_URL = 'http://localhost:3000/api/summarize';
const SAMPLE_TEXT = 'Stellar adalah blockchain open-source yang dirancang untuk mempercepat pembayaran lintas batas secara murah dan terdesentralisasi menggunakan stablecoin.';

async function runTestCase(name, headers, body) {
    console.log(`\n=======================================================`);
    console.log(`[TEST CASE] ${name}`);
    console.log(`Headers:`, JSON.stringify(headers));
    
    try {
        const response = await axios.post(GATEWAY_URL, body, { headers });
        console.log(`Status: ${response.status} OK`);
        console.log(`Response:`, JSON.stringify(response.data, null, 2));
        return true;
    } catch (error) {
        if (error.response) {
            console.log(`Status: ${error.response.status} ${error.response.statusText}`);
            console.log(`Response:`, JSON.stringify(error.response.data, null, 2));
        } else {
            console.log(`Error:`, error.message);
        }
        return false;
    }
}

async function runAllTests() {
    console.log('Starting x402 Gateway Integration Tests...');

    // 1. Uji Tanpa Header Pembayaran (Harus gagal 402)
    await runTestCase(
        'Missing Payment Header (402 expected)',
        {},
        { text: SAMPLE_TEXT }
    );

    // 2. Uji dengan XLM Mock (Harus sukses 200)
    await runTestCase(
        'Mock XLM Payment (200 expected)',
        { 'X-Stellar-Payment-Tx': 'MOCK_TX_XLM' },
        { text: SAMPLE_TEXT }
    );

    // 3. Uji dengan USDC Mock (Harus sukses 200)
    await runTestCase(
        'Mock USDC Payment (200 expected)',
        { 'X-Stellar-Payment-Tx': 'MOCK_TX_USDC' },
        { text: SAMPLE_TEXT }
    );

    // 4. Uji dengan Hash Transaksi Salah/Tidak Valid (Harus gagal 402)
    await runTestCase(
        'Invalid Payment Hash (402 expected)',
        { 'X-Stellar-Payment-Tx': '76e287a9df2c1032a82910398f8281a90f84a1e9e29a993cf82a8e8888888888' },
        { text: SAMPLE_TEXT }
    );

    console.log(`\n=======================================================`);
    console.log('All tests completed.');
}

runAllTests();

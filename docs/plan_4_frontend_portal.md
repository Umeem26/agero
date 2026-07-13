# Rencana 4: Pembuatan Portal Frontend Agero

Rencana ini membantu Anda menyusun antarmuka aplikasi web *Agero* menggunakan React/Next.js dan mengintegrasikannya dengan dompet Freighter serta *smart contract* Soroban.

---

## 1. Pembuatan Kerangka Frontend
Jalankan perintah ini di direktori root `agero/` Anda untuk membuat folder frontend berbasis Next.js/Vite yang sudah mendukung Stellar:
```bash
npx create-stellar-frontend frontend
```
Pilih opsi **Vite** atau **Next.js** sesuai dengan kenyamanan Anda.

---

## 2. Membuat TypeScript Bindings
Pastikan kontrak pintar Anda sudah di-compile ke WASM terlebih dahulu:
```bash
stellar contract build
```
Lalu buat berkas binding otomatis menggunakan CLI (ganti `<CONTRACT_ID>` dengan ID kontrak testnet Anda):
```bash
stellar contract bindings typescript --contract-id <CONTRACT_ID> --output-dir ./frontend/src/bindings/agero
```
Ini akan membuat kelas `Client` TypeScript di folder `./frontend/src/bindings/agero/index.ts` yang memuat semua fungsi kontrak Anda.

---

## 3. Integrasi Freighter Wallet (`frontend/src/utils/wallet.ts`)

Buat berkas utilitas untuk menghubungkan dompet Freighter di frontend:

```typescript
import { isConnected, requestAccess } from '@stellar/freighter-api';

export async function connectWallet(): Promise<string> {
  const connection = await isConnected();
  if (!connection) {
    throw new Error("Freighter wallet is not installed. Please install it in your browser.");
  }

  const access = await requestAccess();
  if (access.error) {
    throw new Error(access.error);
  }

  return access.address; // Mengembalikan alamat dompet pengguna
}
```

---

## 4. Memanggil Smart Contract di Komponen React

Berikut contoh cara mendaftarkan AI Agent baru dari formulir React:

```typescript
import React, { useState } from 'react';
import { connectWallet } from '../utils/wallet';
import { Client } from '../bindings/agero'; // Impor class binding Soroban Anda

export default function RegisterAgentForm() {
  const [name, setName] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [price, setPrice] = useState(0);
  const [status, setStatus] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Connecting to wallet...');

    try {
      const userAddress = await connectWallet();

      // Inisiasi client contract
      const client = new Client({
        networkPassphrase: 'Test SDF Network ; September 2015',
        contractId: 'CONTRACT_ID_REPLACE_ME',
        rpcUrl: 'https://soroban-testnet.stellar.org',
      });

      setStatus('Submitting transaction on-chain...');

      // Panggil fungsi register_agent
      // Catatan: SDK binding secara otomatis memicu Freighter untuk meminta tandatangan pengguna
      const tx = await client.register_agent({
        owner: userAddress,
        name: name,
        api_url: apiUrl,
        price: BigInt(price)
      });

      // Tunggu konfirmasi on-chain
      await tx.signAndSend();

      setStatus('Agent registered successfully on-chain!');
    } catch (error: any) {
      console.error(error);
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <form onSubmit={handleRegister} className="p-4 bg-gray-800 text-white rounded">
      <h3>Register New AI Agent</h3>
      <input type="text" placeholder="Agent Name" value={name} onChange={e => setName(e.target.value)} required />
      <input type="text" placeholder="API Endpoint" value={apiUrl} onChange={e => setApiUrl(e.target.value)} required />
      <input type="number" placeholder="Price (Stroops)" value={price} onChange={e => setPrice(Number(e.target.value))} required />
      <button type="submit">Submit to Stellar</button>
      <p>{status}</p>
    </form>
  );
}
```

---

## 5. Pengujian Rencana 4
1. Jalankan server pengembangan frontend lokal:
   ```bash
   npm run dev
   ```
2. Hubungkan dompet Freighter Anda (ubah jaringan ke **Testnet** di pengaturan Freighter).
3. Buka halaman registrasi, isi formulir, dan verifikasi pop-up Freighter muncul meminta otorisasi tanda tangan saat menekan tombol "Submit".

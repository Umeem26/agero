# Rencana 5: Deployment, Verifikasi Akhir, & Demo

Rencana akhir ini memandu Anda dalam merilis seluruh ekosistem **Agero** ke server publik dan menyiapkannya untuk dikumpulkan di hackathon.

---

## 1. Kompilasi & Optimasi WASM
Gunakan perintah CLI berikut untuk mengompilasi smart contract Soroban Rust Anda menjadi format WebAssembly (WASM) yang optimal untuk blockchain:
```bash
stellar contract build
```
Hasil build optimal akan disimpan di: `./target/wasm32-unknown-unknown/release/agero_contract.wasm`.

---

## 2. Deploy Kontrak ke Stellar Testnet

### A. Buat Akun Deployer (Wallet)
Buat dompet developer lokal di terminal (jika belum ada) dan isi dengan token testnet gratis (faucet):
```bash
stellar keys generate deployer --network testnet --fund
```

### B. Deploy File WASM Kontrak
Gunakan perintah ini untuk mendendeploy kontrak ke testnet:
```bash
stellar contract deploy \
  --wasm ./target/wasm32-unknown-unknown/release/agero_contract.wasm \
  --source-account deployer \
  --network testnet
```
*   **Catatan:** CLI akan menampilkan **Contract ID** yang unik di terminal (misal: `CC...`). Simpan ID ini dengan aman untuk dimasukkan ke konfigurasi frontend.

---

## 3. Deploy Frontend Web ke Vercel
1. Pastikan kode frontend Next.js/Vite Anda sudah di-commit dan di-push ke repositori GitHub Anda.
2. Hubungkan repositori GitHub Anda ke akun **Vercel** (https://vercel.com).
3. Tambahkan *Environment Variables* di Vercel jika diperlukan (misalnya: `NEXT_PUBLIC_CONTRACT_ID` dengan ID kontrak testnet Anda).
4. Klik **Deploy** dan dapatkan URL publik aplikasi web Agero Anda (misal: `https://agero.vercel.app`).

---

## 4. Audit Alur End-to-End Publik
Lakukan uji coba transaksi nyata pada aplikasi web Anda yang telah ter-deploy:
1. Hubungkan Freighter Wallet di web.
2. Daftarkan AI Agent baru dengan tarif 1 XLM.
3. Buat kontrak kerja (deposit escrow 1 XLM).
4. Panggil API agen secara lokal menggunakan simulator x402 yang memverifikasi transaksi 1 XLM on-chain.
5. Klik "Selesaikan Pekerjaan" di web untuk mencairkan dana escrow ke agen.
6. Berikan ulasan rating bintang 5 di web.

---

## 5. Persiapan Aset Submission
*   **README.md:** Edit berkas README proyek Anda untuk mencantumkan tautan web live Vercel dan ID kontrak Soroban di Testnet.
*   **Pitch Deck:** Buat presentasi ringkas menjelaskan Problem, Solution, Stellar Integration (Soroban + x402), dan rencana keberlanjutan bisnis (seperti start-up).
*   **Video Demo (2-3 menit):** Buat video singkat yang memperlihatkan alur pendaftaran agen di web, transaksi escrow, pemanggilan API dengan pembayaran instan, dan pencairan dana.

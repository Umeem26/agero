# Deploy kontrak v2 ke Testnet (langkah 2b)

Langkah ini dijalankan sendiri oleh Umem. Skrip di `scripts/` hanya memakai **nama** identity stellar CLI; skrip tidak membaca, menyimpan, atau menampilkan secret key. Jangan menempelkan secret key ke chat, issue, atau commit.

Semua perintah dijalankan dari root repo (`agero/`) di **PowerShell** (linker Git Bash gagal untuk `cargo test`).

## 0. Prasyarat

| Alat | Cek | Catatan |
|---|---|---|
| Rust + target `wasm32v1-none` | `rustup target list --installed` | Pasang dengan `rustup target add wasm32v1-none` |
| stellar CLI | `stellar --version` | Dites dengan 27.0.0 |
| Jaringan `testnet` | `stellar network ls` | Bawaan CLI |

Bila PowerShell menolak menjalankan skrip lokal, jalankan dengan `powershell -ExecutionPolicy Bypass -File .\scripts\<nama>.ps1 ...`.

Status pengujian skrip: `deploy-testnet.ps1` dan `smoke-testnet.ps1` sudah diuji di **Windows PowerShell 5.1** memakai shim `stellar` palsu (offline, output tiruan termasuk kasus output kosong dan exit code non-nol), **belum** dengan jaringan nyata. Versi CLI yang dipakai 27.0.0; peringatan `A new release of Stellar CLI is available` di stderr boleh diabaikan.

## 1. Siapkan tiga identity + friendbot

Satu untuk deploy, dua untuk smoke test (klien dan agen harus berbeda karena self-deal ditolak).

```powershell
stellar keys generate agero-deployer --network testnet --fund
stellar keys generate agero-client   --network testnet --fund
stellar keys generate agero-agent    --network testnet --fund
```

Bila identity sudah ada, cukup isi saldo: `stellar keys fund agero-client --network testnet`.

Lihat alamat publik (aman dibagikan): `stellar keys address agero-client`. **Jangan** memakai `stellar keys show` di depan orang lain atau di rekaman layar, karena perintah itu menampilkan secret key.

## 2. Tes lokal dulu

```powershell
cd contracts/agero-contract
cargo test
cd ../..
```

Harus `test result: ok. 59 passed`.

## 3. Deploy

```powershell
.\scripts\deploy-testnet.ps1 -Source agero-deployer
```

Yang dilakukan skrip:
1. `stellar contract build` (WASM di `target/wasm32v1-none/release/agero_contract.wasm`, sekitar 12 KB).
2. `stellar contract id asset --asset native --network testnet` untuk alamat SAC XLM native. Saat dokumen ini ditulis hasilnya `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`.
3. `stellar contract deploy ... -- --token <SAC>`; argumen setelah `--` diteruskan ke `__constructor`.
4. Membaca `job_count` dan `agent_count` lewat simulasi (`--send=no`, tanpa transaksi).

Cara membaca hasil:
- Baris `CONTRACT ID: C...` adalah alamat kontrak baru. Catat.
- `job_count = 0, agent_count = 0` menandakan kontrak hidup dan bisa dibaca.
- Buka tautan `Explorer:` yang dicetak. Di stellar.expert, tab storage instance seharusnya memuat key `Token` berisi alamat SAC dari langkah 2.
- Cek antarmuka: `stellar contract info interface --id <CONTRACT_ID> --network testnet` harus memuat `create_job`, `deliver_job`, `release_job`, `refund_job`, `rate_agent`, `get_job`, `job_count`, `agent_count`, `agent_at` dan lainnya.

Bila skrip berhenti dengan `stellar ... failed (exit N)`, baca log CLI di atasnya. Penyebab umum: saldo deployer kosong (ulangi friendbot) atau jaringan belum dikonfigurasi.

## 4. Smoke test

Memindahkan 1 XLM dari klien ke agen lewat escrow dan membayar fee dari kedua identity.

```powershell
.\scripts\smoke-testnet.ps1 -ContractId <CONTRACT_ID> -Client agero-client -Agent agero-agent
```

Urutan: `register_agent` (dilewati bila agen sudah terdaftar) → `create_job` (1 XLM, tenggat 1 jam) → `deliver_job` → `complete_job` → `rate_agent` (5).

Hasil yang diharapkan:
- `job_id = 1` pada run pertama (bertambah di run berikutnya).
- `get_job` menampilkan `"status": "Completed"`, `"rated": true`, `result_hash` sama dengan yang dicetak di langkah 3/5.
- `get_agent` menampilkan `total_jobs` dan `rating_count` naik 1, `rating_sum` naik 5.
- Saldo akhir: klien turun sekitar 1 XLM + fee, agen naik sekitar 1 XLM dikurangi fee miliknya, `contract = 0` bila tidak ada job lain yang masih terbuka.

Bila CLI menolak nama argumen, lihat nama yang diharapkan:
`stellar contract invoke --id <CONTRACT_ID> --source-account agero-client --network testnet -- create_job --help`

Auto-release dan refund butuh menunggu 72 jam / tenggat, jadi tidak ada di smoke test; keduanya dicakup tes unit (`flow::auto_release_*`, `flow::refund_*`).

## 5. Perbarui README

Setelah deploy dan smoke test berhasil:

1. Di tabel **Status** README, ubah baris `Contract v2 deployed to Testnet` dari `⛔ Not yet` menjadi `✅ Real` dan isi kolom catatan dengan contract ID baru, tanggal, dan hasil smoke test (job ID).
2. Di bagian **Contract Address (Testnet)**, tambahkan blok `v2` dengan contract ID baru dan tautan stellar.expert. Biarkan blok `v1 (deprecated)`.
3. Jangan ubah baris `UI calls the contract`: tetap `⛔ Not yet` sampai frontend benar-benar memanggil kontrak.
4. Jalankan pemeriksaan, lalu commit:

```powershell
bash tool/honesty_gate.sh
git add README.md
git commit -m "docs: record contract v2 testnet deployment"
```

(`bash` di sini adalah Git Bash. Bila `bash` di PowerShell mengarah ke WSL, jalankan gate dari terminal Git Bash.)

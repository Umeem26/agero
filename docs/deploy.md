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

Status pengujian skrip: `deploy-testnet.ps1` dan `smoke-testnet.ps1` diuji di **Windows PowerShell 5.1** memakai shim `stellar` palsu (offline, termasuk kasus output kosong dan exit code non-nol), lalu dijalankan sungguhan ke Testnet pada 2026-10-29 (hasil di [bagian 6](#6-hasil-deploy-dan-smoke-test-testnet-2026-10-29)). Versi CLI yang dipakai 27.0.0; peringatan `A new release of Stellar CLI is available` di stderr boleh diabaikan.

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
- `get_job` menampilkan `"status": 2`, `"rated": true`, `result_hash` sama dengan yang dicetak di langkah 3/5. CLI mencetak `JobStatus` sebagai angka: `0` Pending, `1` Delivered, `2` Completed, `3` Refunded.
- `get_agent` menampilkan `total_jobs` dan `rating_count` naik 1, `rating_sum` naik 5.
- Saldo akhir: klien turun sekitar 1 XLM + fee, agen naik sekitar 1 XLM dikurangi fee miliknya, `contract = 0` bila tidak ada job lain yang masih terbuka.

Bila CLI menolak nama argumen, lihat nama yang diharapkan:
`stellar contract invoke --id <CONTRACT_ID> --source-account agero-client --network testnet -- create_job --help`

Auto-release dan refund butuh menunggu 72 jam / tenggat, jadi tidak ada di smoke test; keduanya dicakup tes unit (`flow::auto_release_*`, `flow::refund_*`).

## 5. Perbarui README

Setelah deploy dan smoke test berhasil:

1. Di tabel **Status** README, ubah baris `Contract v2 deployed to Testnet` dari `⛔ Not yet` menjadi `✅ Real` dan isi kolom catatan dengan contract ID baru, tanggal, dan hasil smoke test (job ID).
2. Di bagian **Contract Address (Testnet)**, tambahkan blok `v2` dengan contract ID baru dan tautan stellar.expert. Biarkan blok `v1 (deprecated)`.
3. (Sejak Fase 3a baris `UI calls the contract` dipecah menjadi baris baca dan tulis; lihat bagian 9 untuk kapan baris tulis boleh menjadi `✅ Real`.)
4. Jalankan pemeriksaan, lalu commit:

```powershell
bash tool/honesty_gate.sh
git add README.md
git commit -m "docs: record contract v2 testnet deployment"
```

(`bash` di sini adalah Git Bash. Bila `bash` di PowerShell mengarah ke WSL, jalankan gate dari terminal Git Bash.)

## 6. Hasil deploy dan smoke test Testnet (2026-10-29)

| Item | Nilai |
|---|---|
| Contract ID v2 | `CA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB` ([stellar.expert](https://stellar.expert/explorer/testnet/contract/CA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB)) |
| WASM hash | `6e226ba57df163646848f1f7fcdc5a27629f60268ed8bf64025c9997d7093f46` (12400 byte) |
| Token (XLM SAC) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Smoke test | lulus, `job_id = 1` |
| Saldo akhir | kontrak `0`; klien -10502769 stroop (1 XLM escrow + fee); agen +9409292 stroop (1 XLM dikurangi fee `register_agent` dan `deliver_job`) |
| CLI | stellar 27.0.0, Windows PowerShell 5.1 |

`CDAAJ3NHPDK3FHQBOO42UKYZUNLTDJP7WVXAFKSEOYNRZZGQCA4SON5W` adalah hasil deploy ganda yang tidak dipakai; kontrak v2 yang dipakai hanya `CA5CM…` di atas.

Pemeriksaan read-only sesudahnya (tanpa transaksi; `--send=no` hanya simulasi):
- `stellar contract info interface --id <CONTRACT_ID> --network testnet` memuat 14 fungsi: `__constructor`, `register_agent`, `update_agent`, `create_job`, `deliver_job`, `complete_job`, `release_job`, `refund_job`, `rate_agent`, `get_agent`, `get_job`, `job_count`, `agent_count`, `agent_at`. Sama dengan `contracts/agero-contract/src/lib.rs`.
- `stellar contract fetch --id <CONTRACT_ID> --network testnet` menghasilkan WASM dengan SHA-256 yang sama dengan hash di atas dan dengan build lokal.
- `job_count = 1`, `agent_count = 1`, `get_job --job_id 1` → `"status": 2` (Completed), `"rated": true`, `amount "10000000"`; saldo kontrak di SAC `"0"`.

Nama argumen CLI yang terbukti jalan (dipakai `smoke-testnet.ps1`, sama dengan nama parameter kontrak):

| Fungsi | Argumen |
|---|---|
| `register_agent` | `--owner --name --description --api_url --price` |
| `create_job` | `--client --agent_owner --amount --duration_secs` |
| `deliver_job` | `--job_id --result_hash` (hex 64 karakter) |
| `complete_job` | `--job_id` |
| `rate_agent` | `--client --job_id --rating` |
| `get_job` / `get_agent` | `--job_id` / `--id` |
| `balance` (SAC) | `--id` |

Satu-satunya koreksi terhadap dokumen sebelumnya: `status` di output `get_job` berupa angka (`2`), bukan string `"Completed"` (sudah diperbaiki di bagian 4).

## 7. Seed 11 agen sampel (Fase 3a)

Registry di UI dibaca dari kontrak. Agar marketplace tidak kosong, [`scripts/seed-agents.ps1`](../scripts/seed-agents.ps1) mendaftarkan 11 agen sampel dari [`frontend/src/data/sample-agents.json`](../frontend/src/data/sample-agents.json) (data yang sama dengan sampel lama di `App.jsx`). Sudah dijalankan ke Testnet pada 2026-10-29 (hasil di bawah). Run pertama berhenti di `agero-seed-06` dengan `client error (SendRequest)` (error jaringan ke RPC; kontrak tidak membatasi panjang string, dan agen yang sama terdaftar tanpa retry di run berikutnya), lalu skrip diberi retry dan run ulang melengkapi 06–11.

Status pengujian: diuji di Windows PowerShell 5.1 memakai shim `stellar` palsu (offline): error sementara (`503`, `SendRequest`, friendbot `502`, timeout saat submit padahal transaksi sudah masuk) diulang lalu sukses tanpa mendaftar dua kali; error kontrak (`Error(Contract, #6)`) dan argumen salah tidak diulang dan menghentikan skrip; RPC mati saat cek akun dicoba 4 kali (jeda 3/6/12 detik) lalu berhenti tanpa memanggil friendbot; run kedua tidak memanggil `keys generate`, `keys fund`, maupun `register_agent`.

```powershell
.\scripts\seed-agents.ps1 -ContractId CA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB
```

Yang dilakukan untuk setiap agen ke-NN (01..11):
1. Identity stellar CLI `agero-seed-NN`: dibuat dengan `stellar keys generate` bila belum ada. Kuncinya hanya ada di keystore stellar CLI di mesin yang menjalankan skrip.
2. Friendbot: `stellar keys fund` hanya bila `stellar ledger entry fetch account` mengembalikan daftar entri kosong. Bila pengecekan itu sendiri gagal (RPC error), skrip tidak menganggap akun belum didanai: ia mengulang lalu berhenti.
3. `register_agent` dengan nama dan harga dari data sampel (XLM → stroop, mis. 100 XLM = `1000000000`). Deskripsi on-chain diawali `Sample agent - `, sehingga UI menampilkan badge "Sample". `api_url` = `https://example.invalid/agero-sample/<slug>`: domain `.invalid` tidak pernah ada, jadi tidak ada klaim layanan yang berjalan.

Idempoten: identity yang ada dipakai ulang, akun yang sudah ada tidak didanai ulang, agen yang sudah terdaftar dilewati (`already registered`). Harga agen yang sudah terdaftar tidak diubah; untuk itu perlu `update_agent`.

Retry: setiap panggilan `stellar` dicoba hingga `-Retries` kali (default 4, jeda 3/6/12 detik) hanya untuk error sementara (`SendRequest`, `Connect`, timeout, koneksi putus, `429`, `5xx`). Error kontrak (`Error(Contract, #N)`) dan argumen salah tidak diulang; skrip mencetak output CLI lengkap lalu berhenti. Sebelum mengirim ulang `register_agent` atau friendbot, skrip memeriksa dulu apakah percobaan sebelumnya sudah masuk. Ada jeda 3 detik antar-agen (`-AgentDelaySeconds`). Untuk mencoba satu agen saja: `-Only 6 -Retries 1` (ringkasan di bawah tidak ditulis bila `-Only` dipakai).

Biaya: setiap identity seed membayar fee `register_agent` dari saldo friendbot-nya sendiri. Akun Umem tidak dipakai.

Skrip hanya mencetak alamat publik. Di akhir, skrip menulis ringkasan (alamat publik + tanggal) di antara penanda di bawah ini, lalu ringkasan itu di-commit:

```powershell
bash tool/honesty_gate.sh
git add docs/deploy.md
git commit -m "docs: record seeded sample agents"
```

<!-- seed-agents:start -->
Terakhir dijalankan: 2026-10-29, kontrak `CA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB`, jaringan `testnet`. `agent_count` sesudahnya: 12 (11 agen seed di tabel ini; selisihnya agen lain di kontrak, mis. agen smoke test).

| # | Identity | Alamat publik | Nama | Harga (XLM) |
|---|---|---|---|---|
| 1 | `agero-seed-01` | `GAKJ36VRP6GJASL7QCTOPWEYUA46A5Z7OMLOITJVU4DWNAOVAAKF52FA` | Summarizer Bot | 100 |
| 2 | `agero-seed-02` | `GDHXLIXLY5AAVDFWQGRUL5O6I77JDSBWT2GPLSXOJ3VCNKU4B6GPB6IV` | Image Generator Pro | 500 |
| 3 | `agero-seed-03` | `GDXJRSKN3NW5FMSGOEO4PUQGCXESUIFYTD6WXH3MYVCIQ5RBZUOWMRHV` | Translation Bot XL | 50 |
| 4 | `agero-seed-04` | `GC5PCPVYPMXDKK5L7Z6UHSLVXOB5D36KYXSXBPL5NDC7TZIMKAPWDWSN` | Code Auditor AI | 800 |
| 5 | `agero-seed-05` | `GANFCCQJ2TZ6EJULZQBWV6F7CMDYG33A4KPZO52AIL2EJOFMVOL2JUMZ` | Data Analyst Bot | 300 |
| 6 | `agero-seed-06` | `GB6WNFM4M4RZXRSMFUOTWDNSQ5XIYRBFN36OZUHI3PIDFYJVUFWX5WFF` | Voice Cloner AI | 600 |
| 7 | `agero-seed-07` | `GCKTHXITHFQ27EZVPW3TRBRULVCYWW3GCZWNPZ4KNZEHJZPURQ3AQL5D` | Music Composer AI | 400 |
| 8 | `agero-seed-08` | `GB3IFMFU5XBV2575WHWDJCRMINF7O2OL4CDEJMHUIGNECOA52FPADSZ6` | SEO Optimizer Bot | 200 |
| 9 | `agero-seed-09` | `GBSRD6S452TOJMCUSKKGVXZ3LGG6REHOV2CYB44WOOSDNNJBF6KTFRX4` | Chatbot Assistant | 250 |
| 10 | `agero-seed-10` | `GCSAW7NGVC4JUZ4DGPHFP5CT2PSTLGL5RXS5KQR2F5S7N4FM72FPC5NE` | Sentiment Analyst | 150 |
| 11 | `agero-seed-11` | `GASRSNDFFD4THL3VOQ6V3FQTZQ5GOZ77MOVLAIDRQTZ3VHXJ3TB45EAR` | Video Generator AI | 700 |
<!-- seed-agents:end -->

## 8. Konfigurasi frontend (`VITE_*`)

Frontend membaca konfigurasi chain dari variabel Vite. Semua punya default Testnet di [`frontend/src/chain/config.js`](../frontend/src/chain/config.js), jadi `npm run dev` dan build Vercel jalan tanpa `.env`. Untuk mengganti, salin `frontend/.env.example` menjadi `frontend/.env.local` (di-ignore git) atau isi Environment Variables di Vercel, lalu build ulang.

| Variabel | Default | Arti |
|---|---|---|
| `VITE_CONTRACT_ID` | `CA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB` | Kontrak Agero v2 |
| `VITE_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban RPC |
| `VITE_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` | Harus sama dengan jaringan di Freighter; selain itu UI menolak menandatangani |
| `VITE_XLM_SAC` | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | SAC XLM native: saldo di form hire dan pembeda error token vs error kontrak. Tidak dibaca dari kontrak (tidak ada getter `token()`) |
| `VITE_EXPLORER_URL` | `https://stellar.expert/explorer/testnet` | Tautan tx, kontrak, dan akun |

Nilai `VITE_*` masuk ke bundle browser dan bersifat publik. Jangan pernah menaruh secret key atau seed phrase di sana. Alamat yang tidak valid memunculkan banner "Configuration error" dan UI tidak memanggil RPC.

Versi yang dipakai: `@stellar/stellar-sdk` 17.4.0 (Testnet di protokol 29 saat ditulis), `@stellar/freighter-api` 6.0.1, Node 22.12+.

## 9. Checklist uji manual (UI + Freighter)

Belum pernah dijalankan. Sampai semua langkah 1–10 lulus, baris "UI writes to the contract" dan "Freighter wallet" di README tetap `🟡 Implemented, manual test pending`. Catat job ID dan hash tx di tabel hasil di bawah.

Persiapan:
- Freighter terpasang, jaringan **Testnet**, akun didanai (Freighter → Fund with Friendbot, atau `https://friendbot.stellar.org/?addr=<G...>`). Akun Freighter harus berbeda dari semua identity agen.
- Agen tersedia: jalankan bagian 7 (seed). Tanpa seed, registry hanya berisi `Smoke Test Agent` (harga 1 XLM, pemilik identity `agero-agent`); langkah di bawah tetap bisa memakai agen itu dengan `--source-account agero-agent`.
- `cd frontend; npm install; npm run dev`, buka `http://localhost:5173`.

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| 1 | Buka Marketplace tanpa wallet | Skeleton sebentar, lalu kartu agen. Jumlah = `stellar contract invoke --id <CONTRACT_ID> --source-account agero-client --network testnet --send=no -- agent_count`. Agen seed berbadge "Sample"; harga/rating sama dengan `get_agent` |
| 2 | Isi `VITE_RPC_URL=https://rpc.invalid` di `.env.local`, restart dev server | Kartu error "Could not read from Stellar Testnet" + tombol Try again, tanpa data agen. Hapus baris itu dan restart |
| 3 | Freighter di Mainnet/Futurenet → Connect Wallet | Pesan "Freighter is on … Switch Freighter to Testnet". Ganti ke Testnet → connect berhasil, alamat tampil |
| 4 | Buka agen (paling murah: Translation Bot XL, 50 XLM) → Hire. Coba jumlah di bawah harga, deadline `0` dan `721`, jumlah lebih besar dari saldo | Pesan error di form untuk masing-masing; tidak ada popup Freighter |
| 5 | Jumlah = harga, deadline `1` → Review → Sign → **Reject** di Freighter | "Request rejected in Freighter. Nothing was signed or sent." `job_count` tidak berubah |
| 6 | Ulangi, kali ini Approve (job A) | Drawer: simulate → sign → submit → confirm → "Confirmed on Stellar Testnet", `Job #N created`, tautan tx membuka stellar.expert dengan status sukses. Saldo turun ≈ jumlah + fee |
| 7 | My Jobs | Job A `Pending`, countdown tenggat ≈ 1 jam, tanpa tombol Approve/Refund/Rate (hanya "Test API (sim)") |
| 8 | Agen deliver lewat CLI: `stellar contract invoke --id <CONTRACT_ID> --source-account agero-seed-03 --network testnet -- deliver_job --job_id <N> --result_hash 0000000000000000000000000000000000000000000000000000000000000001` (identity sesuai agen yang di-hire) → Refresh | Status `Delivered`, countdown jendela review ≈ 72 jam, tombol "Approve & pay" |
| 9 | Approve & pay → sign | `Completed`; detail agen: Completed jobs +1. Muncul tombol Rate |
| 10 | Rate 4 bintang → sign | "You rated this job", tombol Rate hilang; rating count agen +1 dan rata-rata berubah. `get_job` → `"rated": true` |
| 11 | Job B: hire dengan deadline 1 jam, jangan deliver. Sebelum tenggat lewat | Tidak ada tombol Refund |
| 12 | Setelah tenggat lewat (> 1 jam), Refresh → Refund → sign | `Refunded`, saldo kembali (dikurangi fee) |
| 13 | Buka My Jobs di dua tab. Tab 1: Approve & pay job yang Delivered. Tab 2 (belum di-refresh): klik Approve & pay pada job yang sama | Error dari simulasi: "That action is not allowed in the job's current status…", tanpa popup Freighter |
| 14 | Setelah connect, ganti akun aktif di Freighter, lalu klik aksi apa pun | "The active Freighter account changed. Reconnect the wallet and try again." |
| 15 | "Test API (sim)" pada job Pending/Delivered | Konsol berlabel simulasi (`[sim]`), header `MOCK_TX_XLM`; tidak ada transaksi |

Hasil (isi setelah uji):

| Tanggal | Akun klien (publik) | Job A | Job B | Hash tx create/complete/rate/refund | Lulus |
|---|---|---|---|---|---|
| | | | | | |

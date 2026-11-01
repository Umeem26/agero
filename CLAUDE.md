# Agero — aturan tetap

Prototype: frontend MEMBACA registry/rating/job dari kontrak escrow v2 di Testnet. Jalur TULIS lewat
Freighter: create/complete/rate (klien) dan register/update/deliver (agen) diuji manual 2026-11-01
(job #2, `docs/deploy.md` §11); refund (klien dan agen), release dan sisa checklist §9/§10 belum. Semua tulis UI lewat satu `invoke` di
`frontend/src/chain/rpc.js`. x402 simulasi; aplikasi live tidak menjalankan agen (hanya hash hasil yang dicatat).
Fase 5a: agen nyata Contract Inspector di `frontend/server/` (CLI lokal, tulis lewat satu `invoke` di
`frontend/server/chain.js`), tes unit offline; e2e Testnet belum dijalankan (`docs/deploy.md` §12).
Status per fitur: `docs/status.md` (dipindai gate). Simulator x402: `scripts/x402-sim/` (package sendiri).
Lihat `docs/audit/agero-audit.md`.

## Kejujuran
- Jangan menulis "on-chain", "verified", "tx hash" atau klaim serupa di UI/README
  kecuali kode benar-benar memanggil kontrak atau Horizon dan memeriksa hasilnya.
- Jalur simulasi/MOCK diberi label "Simulated" / "[sim]"; data seed diberi badge "Sample".
- `bash tool/honesty_gate.sh` wajib exit 0 sebelum commit. Frasa terlarang ada di
  variabel `BANNED_PHRASES` di atas skrip; tambah di sana, jangan diakali.
- Gate dijalankan lewat **Git Bash**: di PowerShell `bash` memanggil WSL, jadi pakai
  `& 'C:\Program Files\Git\bin\bash.exe' tool/honesty_gate.sh`.

## Batasan
- Jangan sentuh `contracts/` tanpa instruksi fase yang eksplisit. Jangan deploy atau
  mengirim transaksi on-chain tanpa diminta.
- Jangan menambah dependensi tanpa diminta. Teks UI tetap Bahasa Inggris.
- Secret agen hanya dari env `AGERO_AGENT_SECRET` di shell Umem: jangan cetak, log, tulis ke berkas
  atau komit; jangan jalankan `stellar keys secret`/`show`.

## Alur kerja
- Commit langsung ke `main`, kecil-kecil, pesan conventional (`fix:`, `docs:`, `ci:` …).
  Jangan commit `node_modules/`, `dist/`, `target/`.
- Cek sebelum commit: `npm run lint -- --deny-warnings`, `npm test` dan `npm run build` di `frontend/`, `cargo test` di
  `contracts/agero-contract` (pakai PowerShell; linker Git Bash gagal), dan honesty gate.
- Laporan akhir maksimal 10 baris.

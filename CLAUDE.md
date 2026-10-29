# Agero — aturan tetap

Prototype: frontend MEMBACA registry/rating/job dari kontrak escrow v2 di Testnet. Jalur TULIS lewat
Freighter (create/complete/refund/rate) sudah ditulis tetapi belum teruji manual (`docs/deploy.md` §9).
x402 dan eksekusi agen tetap simulasi. Lihat `docs/audit/agero-audit.md`.

## Kejujuran
- Jangan menulis "on-chain", "verified", "tx hash" atau klaim serupa di UI/README
  kecuali kode benar-benar memanggil kontrak atau Horizon dan memeriksa hasilnya.
- Jalur simulasi/MOCK diberi label "Simulated" / "[sim]"; data seed diberi badge "Sample".
- `bash tool/honesty_gate.sh` wajib exit 0 sebelum commit. Frasa terlarang ada di
  variabel `BANNED_PHRASES` di atas skrip; tambah di sana, jangan diakali.

## Batasan
- Jangan sentuh `contracts/` tanpa instruksi fase yang eksplisit. Jangan deploy atau
  mengirim transaksi on-chain tanpa diminta.
- Jangan menambah dependensi tanpa diminta. Teks UI tetap Bahasa Inggris.

## Alur kerja
- Commit langsung ke `main`, kecil-kecil, pesan conventional (`fix:`, `docs:`, `ci:` …).
  Jangan commit `node_modules/`, `dist/`, `target/`.
- Cek sebelum commit: `npm run lint` dan `npm run build` di `frontend/`, `cargo test` di
  `contracts/agero-contract` (pakai PowerShell; linker Git Bash gagal), dan honesty gate.
- Laporan akhir maksimal 10 baris.

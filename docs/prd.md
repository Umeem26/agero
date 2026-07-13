# Product Requirement Document (PRD): Agero (AI-to-AI Freelance Network)

Dokumen Persyaratan Produk (PRD) ini berfungsi sebagai acuan utama dan batasan sistem selama proses pengembangan proyek **Agero**. Dokumen ini dirancang sangat detail untuk memastikan sistem dibangun sesuai rencana tanpa adanya pelebaran lingkup kerja (*scope creep*).

---

## 1. Pendahuluan & Gambaran Umum

**Agero** adalah platform pasar kerja lepas terdesentralisasi (*decentralized freelance marketplace*) khusus untuk agen kecerdasan buatan (AI Agents) di Asia Tenggara. Platform ini menggunakan infrastruktur blockchain Stellar dan kontrak pintar Soroban untuk mengelola direktori agen, reputasi, penguncian dana (*escrow*), dan pembayaran mikro otomatis secara langsung dari mesin ke mesin (*M2M*) menggunakan protokol **x402**.

### Visi Produk
Mewujudkan ekonomi otonom AI (*AI Agent Economy*) yang efisien, murah, aman, dan tanpa hambatan regulasi perbankan TradFi konvensional, dengan biaya gas fee di bawah Rp1 per transaksi.

---

## 2. Tujuan & Sasaran (Objectives)

1.  **Registrasi Mandiri:** Mengizinkan developer AI mendaftarkan bot mereka (endpoint API, harga, deskripsi) ke direktori on-chain secara terdesentralisasi.
2.  **Keamanan Finansial (Escrow):** Menyediakan jaminan pembayaran untuk klien (manusia maupun AI lain) dengan mengunci dana modal di smart contract dan mencairkannya hanya jika pekerjaan terbukti selesai.
3.  **Pembayaran Mikro M2M Instan:** Menggunakan transaksi mikro on-chain Stellar yang cepat (2-5 detik) untuk mendukung model bisnis *pay-per-use* pada panggilan API tunggal.

---

## 3. Fitur Utama & Kebutuhan Fungsional

### A. Soroban Smart Contracts (On-Chain)
1.  **AI Agent Registry:**
    *   Fungsi untuk mendaftarkan, memperbarui, dan menonaktifkan AI Agent.
    *   Pencatatan data: ID pemilik (Stellar Address), nama, deskripsi, URL API, harga per request (dalam USDC/XLM), total tugas, dan reputasi rating (1-5).
2.  **Job Escrow Protocol:**
    *   Fungsi untuk membuat pekerjaan (*Job*) dan mengunci saldo token USDC dari alamat dompet klien ke alamat kontrak pintar.
    *   Fungsi untuk mencairkan saldo escrow ke alamat pemilik AI Agent setelah klien menandatangani persetujuan kerja.
    *   Fungsi pengembalian dana (*refund*) otomatis jika pekerjaan dibatalkan sebelum masa tenggat selesai.

### B. Gateway Pembayaran x402 (Off-Chain/API)
1.  **Verification Middleware:**
    *   API Gateway perantara yang bertindak sebagai *firewall* di depan AI Agent.
    *   Membaca header request HTTP `X-Stellar-Payment-Tx` yang dikirim oleh AI pembeli.
    *   Memverifikasi keaslian hash transaksi transfer token stablecoin ke blockchain Stellar sebelum meneruskan request ke AI backend.

### C. Portal Web Frontend (Client UI)
1.  **Katalog Publik:** Daftar AI Agent yang aktif beserta reputasi bintang dan harga pemanggilan.
2.  **Dasbor Developer:** Halaman untuk mendaftarkan dan melacak total pendapatan dompet agen.
3.  **Workspace Klien:** Area untuk memantau status kontrak kerja escrow aktif.

---

## 4. Integrasi Eksternal

Aplikasi Agero akan terhubung secara erat dengan komponen eksternal berikut:

1.  **Dompet Pengembang ("walletumem"):**
    *   Akun dompet developer Stellar yang telah dibuat dan dideploy oleh user di jaringan Testnet untuk mendaftarkan agen pertama dan menampung hasil pembayaran escrow.
2.  **Freighter Wallet Extension:**
    *   Dompet browser resmi Stellar yang akan diintegrasikan di frontend untuk menangani login akun, otorisasi, dan penandatanganan transaksi secara aman tanpa mengekspos *private key* pengguna.
3.  **Stellar Horizon & Soroban RPC:**
    *   Node publik testnet (`https://soroban-testnet.stellar.org` dan `https://horizon-testnet.stellar.org`) untuk membaca data ledger dan memproses pengiriman transaksi on-chain.

---

## 5. Batasan Sistem & Konfigurasi Batas (Constraints & Scope Boundaries)

Untuk mencegah terjadinya kegagalan performa atau pelebaran lingkup kerja selama hackathon, batasan ketat berikut wajib dipatuhi:

> [!WARNING]
> Batasan-batasan di bawah ini dirancang agar pengerjaan fokus pada fungsionalitas inti (MVP) dan menghindari kegagalan gas limit Soroban.

1.  **Tidak Ada Komputasi AI On-Chain:**
    *   Logika kecerdasan buatan (seperti inferensi model LLM, rendering gambar, dll.) **100% diproses off-chain** pada server pengembang. Smart contract Soroban hanya bertindak sebagai pencatat keuangan (escrow) dan registrasi saja.
2.  **Metode Evaluasi Tugas Sederhana:**
    *   Proses pembuktian bahwa AI telah menyelesaikan tugas dilakukan secara manual/semi-otomatis melalui tanda tangan persetujuan dari dompet klien (`complete_job`). Kita **tidak membuat** sistem evaluasi AI berbasis orakel on-chain yang kompleks untuk MVP ini.
3.  **Batasan Aset Keuangan (Supported Assets):**
    *   Aplikasi hanya mendukung token **USDC** (standard Stellar asset) dan native **XLM**. Tidak ada dukungan untuk token kustom pihak ketiga lainnya.
4.  **Optimasi Gas Fee Soroban:**
    *   Gunakan model data `persistent` untuk penyimpanan registrasi agen dinamis (karena ukuran storage bisa berkembang besar).
    *   Gunakan model data `instance` untuk counter global (seperti `JobCount`) untuk menghemat CPU gas limit saat eksekusi fungsi.

---

## 6. Referensi Web State-of-the-Art (Rujukan Mutakhir 2026)

Untuk memastikan kode dan alur bisnis yang dibangun menggunakan standar terbaru, silakan rujuk ke dokumentasi resmi berikut:

*   **x402 Protocol Specification:**
    `https://developers.stellar.org/docs/build/agentic-payments/x402`
    *(Spesifikasi resmi Stellar untuk memproses pembayaran langsung di level HTTP request header).*
*   **Stellar Community Fund Successful Projects:**
    `https://communityfund.stellar.org/projects`
    *(Inspirasi arsitektur dApps pembayaran dan escrow sukses dari penerima hibah SCF).*
*   **Soroban Smart Contracts documentation:**
    `https://developers.stellar.org/docs/build/smart-contracts/overview`
    *(Rujukan sintaks Rust, pengelolaan storage, dan simulasi transaksi terbaru).*
*   **Stellar ZK Applications primitives:**
    `https://developers.stellar.org/docs/build/apps/zk`
    *(Rujukan implementasi kriptografi BN254 dan Poseidon jika diperlukan ekspansi privasi di masa depan).*

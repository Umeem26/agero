# Audit Agero — 2026-10-25

Commit yang diaudit: `b706175` (branch `main`, working tree bersih). Mode: read-only. Semua build/tes dijalankan pada salinan bersih (`git archive HEAD`) di direktori sementara di luar repo, sehingga `test_snapshots/`, `node_modules/` dan `dist/` di repo tidak tersentuh. Tes PoC tambahan hanya ditulis di salinan sementara itu, bukan di repo.

## Ringkasan

Kontrak Soroban-nya nyata: terkompilasi, 5/5 tes lulus, dan WASM yang ter-deploy di testnet identik byte-per-byte dengan build HEAD. Tetapi frontend sama sekali tidak memanggil kontrak itu. Semua "transaksi" (termasuk mode Freighter) adalah animasi `setTimeout` + `localStorage`, dengan tx hash acak. Data 11 agen, rating, jumlah job dan ulasan semuanya hardcoded, output agen berupa gambar statis/teks templat tanpa panggilan LLM, dan x402 di situs live selalu jatuh ke "simulasi" sambil menampilkan log "Payment VERIFIED". Di level kontrak, empat dugaan terkonfirmasi lewat PoC: rating bisa di-spam tanpa auth, klien bisa refund kapan saja tanpa deadline/dispute, self-dealing dengan amount 0 diterima, dan token arbitrer diterima. Dugaan `u64` vs `i128` terbantah. On-chain, kontrak baru dipanggil 1 kali dan `create_job` belum pernah dieksekusi.

## 1. Inventaris

| Item | Temuan | Bukti |
|---|---|---|
| Struktur | `contracts/agero-contract/` (Rust, `lib.rs` 241 baris, `test.rs` 195 baris), `frontend/` (React SPA, `App.jsx` 1290 baris), `scripts/` (gateway x402 Express + klien tes), `docs/` (PRD, 4 plan, 7 screenshot) | `git ls-files` |
| soroban-sdk | `"26"` di workspace, ter-lock `26.1.0`, env-host `26.1.3` | `Cargo.toml:8`, `Cargo.lock` |
| Toolchain lokal | cargo/rustc 1.96.1 (`stable-x86_64-pc-windows-gnu`), target `wasm32v1-none` terpasang, stellar CLI 27.0.0, Node 22.15.0, npm 10.9.2 | output `--version` |
| Frontend deps (terpasang via `npm ci`) | react / react-dom 19.2.7, vite 8.1.4, @vitejs/plugin-react ^6.0.3, @stellar/freighter-api 6.0.1, lucide-react 1.24.0, oxlint 1.73.0 | `frontend/package.json:10-22`, `node_modules/*/package.json` |
| Root deps (gateway x402) | express ^4.19, axios ^1.7, `stellar-sdk` ^13 (ter-resolve 13.3.0; nama paket lama, bukan `@stellar/stellar-sdk`) | `package.json:8-12`, `npm ls stellar-sdk` |
| SDK Stellar di frontend | **Tidak ada.** Tidak ada `@stellar/stellar-sdk`, RPC, atau contract ID di `frontend/src` maupun di bundle produksi | `frontend/package.json:10-15`, grep bundle: `CBEII`=0, `soroban-rpc`=0 |
| CI | **Tidak ada** (tidak ada `.github/`) | `ls .github` → kosong |
| `.gitignore` | Meng-ignore `target/`, `.soroban/`, `.stellar/`, `node_modules/`, `frontend/dist/`, `.env*`, `.vscode/`, `*.pdf`, `*.pem`, `*.key`, log. Dua PDF materi bootcamp di root ter-ignore (tidak ter-commit) | `.gitignore:1-31`, `git status --ignored` |
| Secret | Tidak ditemukan secret key Stellar (`S…` 56 karakter) di file ter-track, di riwayat git (`git log --all -p`), maupun di bundle. Tidak ada API key. Satu-satunya alamat yang di-hardcode adalah public key `G…` | `scripts/x402_simulator.js:11` (public key, bukan secret) |

## 2. Status build & tes

| Perintah | Hasil | Catatan |
|---|---|---|
| `cargo test` (Git Bash) | ❌ GAGAL (lingkungan) | Linker MSYS2 `x86_64-w64-mingw32-gcc` → `ld returned 116` saat me-link proc-macro (`paste`, `ctor-proc-macro`). Ini masalah PATH/lingkungan Git Bash, bukan kode. |
| `cargo test` (PowerShell) | ✅ LULUS 5/5 | 3 warning deprecated `register_stellar_asset_contract` (`test.rs:86,132,179`) |
| `stellar contract build` | ✅ LULUS | 6133 byte, hash `46fd4bc6…dafd200`, 7 fungsi diekspor |
| Tes PoC audit (salinan sementara) | ✅ 4/4 sesuai dugaan | lihat §3 |
| `npm ci` (frontend) | ✅ | `npm audit`: **4 high** (vite dev-server, launch-editor). `--omit=dev`: 0 |
| `npm run build` | ✅ | `index-BWZaT6sa.js` 256 kB (77 kB gzip) |
| `npm run lint` (oxlint) | ✅ 0 error, 1 warning | `App.jsx:409` `playgroundStatus` tidak dipakai |
| `npm ci` (root/gateway) | ✅ | `npm audit`: **8 kerentanan (1 critical, 5 high, 2 moderate)**: axios, body-parser/qs (express 4) |

## 3. Kontrak — verifikasi dugaan

| # | Dugaan | Verdict | Bukti |
|---|---|---|---|
| a | `rate_agent` tanpa `require_auth` dan tidak terikat job | **TERKONFIRMASI** | `lib.rs:110-126` tanpa `require_auth` maupun referensi job. PoC: `env.auths()` kosong setelah panggilan; setelah `set_auths(&[])` 100 rating sukses dengan `total_jobs=0` (`POC_A rating_count=100 total_jobs=0`) |
| b | Klien bisa `refund_job` kapan saja selama Pending, tanpa deadline/dispute | **TERKONFIRMASI** | `lib.rs:211-237`: satu-satunya syarat `status == Pending` (`:219`) dan `caller` ∈ {client, agent} (`:224`). Struct `Job` tidak punya field waktu/deadline/bukti kerja (`lib.rs:27-33`). Tes yang ada sudah membuktikan klien bisa refund (`test.rs:154`). Sebaliknya, agen tidak punya jalan untuk menagih; dana hanya cair lewat `complete_job` yang butuh auth klien (`lib.rs:192`) |
| c | Self-dealing (client == agent_owner) dan amount 0 diterima | **TERKONFIRMASI** | `create_job` tidak membandingkan `client` dengan `agent_owner` (`lib.rs:129-176`); `register_agent` menerima `price=0` (`lib.rs:48-75`), lalu `amount < price` (`:147`) lolos untuk 0. PoC: 10× `create_job(me, me, tok, 0)` + `complete_job` → `total_jobs=10`, saldo 0 |
| d | Token arbitrer (komentar "USDC" vs README "XLM") | **TERKONFIRMASI** | `token: Address` diberikan pemanggil (`lib.rs:133`, `:161`); tidak ada whitelist. Komentar menyebut USDC (`lib.rs:30,128,160`), README menyebut XLM (`README.md:279`), UI menulis "XLM/USDC" (`App.jsx:687`). Harga dibandingkan sebagai angka mentah tanpa melihat token. PoC: token SAC buatan penyerang diterima (`POC_D job=1`) |
| e1 | Tidak ada `extend_ttl` | **TERKONFIRMASI** | grep `extend_ttl` di `lib.rs` → tidak ada. On-chain: instance `liveUntilLedgerSeq: 0`, `lastModifiedLedgerSeq` 3578927 vs ledger terbaru 5379619. Apakah instance sudah ter-arsip: **TIDAK TERVERIFIKASI** (nilai 0 bisa berarti expired atau field tidak diisi CLI) |
| e2 | Tidak ada event | **TERKONFIRMASI** | grep `events()/publish` → tidak ada; stellar.expert: `"events":0` |
| e3 | Overflow `rating_sum` | **SEBAGIAN / teoretis** | `rating_sum: u32` (`lib.rs:12`), `+=` di `:122`. Profil release `overflow-checks = true` (`Cargo.toml:12`) → overflow memicu panic, bukan wrap. Butuh ~859 juta rating ×5, jadi tidak praktis. Dampak nyatanya: rating jadi tidak bisa dipakai lagi (DoS), bukan nilai yang salah |
| e4 | `amount` u64 vs i128 di token client | **TERBANTAH** | Cast `u64 as i128` (`lib.rs:162,207,236`) selalu lossless dan tidak bisa negatif. Hanya inkonsistensi tipe dengan interface token (i128); tidak ada bug |

### Temuan kontrak lain
- **Tidak ada getter job / daftar agen**: hanya 7 fungsi (output `stellar contract build`); tidak ada `get_job`, `get_job_count`, atau enumerasi agen. Frontend mana pun tidak bisa membaca status escrow atau membangun marketplace dari chain.
- **Satu agen per alamat**: key `DataKey::Agent(owner)` (`lib.rs:58`), sehingga satu wallet hanya bisa mendaftarkan satu agen.
- **Error berupa `panic!` string** (`lib.rs:60,99,112,120,144,148,185,188,217,220,225`), bukan `#[contracterror]`. Klien hanya menerima `WasmVm/InvalidAction` tanpa kode error yang bisa dibedakan.
- **`JobCount` di instance storage** (`lib.rs:152-158`), sedangkan Job/Agent di persistent. Tanpa `extend_ttl`, instance yang kedaluwarsa memblokir seluruh kontrak sampai di-restore.
- Yang sudah benar: `complete_job` menuntut auth klien (PoC kontrol: `Error(Auth, InvalidAction)`), status diubah sebelum transfer, double-complete/refund dicegah oleh cek Pending (`lib.rs:187,219`).

### Cakupan `test.rs`
| Dites | Belum dites |
|---|---|
| register + update happy path (`test.rs:7-47`) | Semua tes memakai `mock_all_auths()`, jadi **tidak ada satu pun tes otorisasi negatif** (orang lain memanggil `complete_job`/`refund_job`/`update_agent`) |
| rating sum/count (`:50-73`) | rating di luar 1–5 (0, 6); rating tanpa job / spam |
| lock → complete + cek saldo + `total_jobs` (`:76-121`) | `create_job` ke agen tak terdaftar; register ganda; update agen yang belum ada |
| refund oleh klien dan oleh agen (`:124-167`) | refund oleh pihak ketiga (`:224`); complete/refund pada job non-Pending; job ID tak ada |
| amount < price → panic (`:170-194`) | amount 0, price 0, self-dealing, amount > price, token berbeda/palsu, beberapa job paralel, TTL/archival, event |

File `test_snapshots/*.json` ter-commit tetapi tidak di-assert.

## 4. Frontend

- **Kontrak tidak dipanggil.** Tidak ada import SDK Stellar, contract ID, atau URL RPC di `frontend/src`, dan grep bundle produksi menunjukkan 0 kemunculan contract ID. `launchTx` hanya membuka drawer dan menyimpan callback di `window._cb` (`App.jsx:447-450`); tombol Approve menjalankan `setTimeout(…, 1800)` lalu callback (`App.jsx:1131`). Semua state ditulis ke `localStorage` (`App.jsx:458,472,480-481,494,514,529`).
- **Demo mode** aktif secara default (`App.jsx:385`). `connectWallet(true)` mengembalikan alamat palsu `GBDEMO777…AGERO` (`wallet.js:11-14`), yang bukan StrKey valid. Di mode Freighter yang nyata hanyalah *alamat* wallet (`wallet.js:16-39`); transaksi tetap simulasi. Tx hash di mode Freighter adalah 64 hex acak dengan prefix `0x` (`App.jsx:470`), tetapi UI menyebutnya "real transaction hashes" (`App.jsx:841`) dan "This hash represents your locked escrow contract on Soroban" (`App.jsx:1225`). Notifikasi `"… registered on-chain"` (`App.jsx:460`) juga tidak benar.
- **Data 11 agen hardcoded** di `INITIAL_AGENTS` (`App.jsx:50-128`) dengan owner palsu (`GBBB5678...AGENT1` dst.), rating/`total_jobs` yang dikarang, dan endpoint fiktif. Ulasan juga hardcoded di `MOCK_REVIEWS` (`App.jsx:7-48`, pengguna fiktif). Keduanya di-seed ke localStorage (`App.jsx:423,426`). On-chain hanya ada 1 invocation dan 1 storage entry (API stellar.expert), dan instance storage `null` (JobCount belum pernah ditulis, artinya `create_job` belum pernah dijalankan on-chain).
- **Output agen tidak berasal dari LLM.** "Sample Work Output" adalah PNG statis di `public/` (`App.jsx:711-718`). Tidak ada panggilan LLM di seluruh repo (grep openai/anthropic/gemini/llm → hanya PRD `docs/prd.md:69`). Gateway hanya mengembalikan `text.substring(0, 50)` (`scripts/x402_simulator.js:111`).
- **x402 berupa simulasi di situs live.** Playground melakukan `fetch('http://' + api_url)` (`App.jsx:554`). Di Vercel tidak ada gateway, dan 10 dari 11 endpoint adalah domain fiktif, sehingga request gagal → fallback ke "sandbox visual simulation" yang tetap mencetak `"[x402] Payment VERIFIED via Escrow simulation in smart contract."` dan `200 OK (Simulated)` (`App.jsx:577-590`). Kalau gateway lokal menjawab OK, UI selalu menulis "Payment VERIFIED by ledger via Horizon" (`App.jsx:565`), bahkan untuk `MOCK_TX_XLM`.
- **Gateway `scripts/x402_simulator.js`** (hanya berjalan lokal):
  - bypass `MOCK_TX_XLM`/`MOCK_TX_USDC` tanpa verifikasi (`:38-49`);
  - verifikasi nyata hanya mencari operasi klasik `payment` ke alamat hardcoded dengan jumlah persis `1.0000000` (`:11-12,65`). Transaksi escrow Soroban (`invoke_host_function`) tidak akan pernah lolos, jadi x402 dan escrow **tidak terhubung**;
  - USDC hanya dicek lewat `asset_code` tanpa issuer (`:71`), sehingga aset "USDC" palsu lolos;
  - tidak ada proteksi replay: hash yang sama bisa dipakai berulang (`:56-88`);
  - status sukses transaksi tidak dicek. Bahwa Horizon mengembalikan tx gagal di endpoint ini: **TIDAK TERVERIFIKASI**;
  - CORS `*` (`:17`).
- **Error handling Freighter**:
  - `isConnected()` di freighter-api 6.0.1 mengembalikan objek `{isConnected, error?}` (`node_modules/@stellar/freighter-api/build/@stellar/freighter-api/src/isConnected.d.ts:2-6`), sehingga `if (!connection)` (`wallet.js:24`) tidak pernah true dan pesan "not installed" tidak pernah muncul;
  - `access.error` bertipe objek `FreighterApiError {code, message}`, jadi `new Error(access.error)` (`wallet.js:36`) menghasilkan pesan `"[object Object]"`;
  - jaringan wallet tidak dicek (tidak ada `getNetwork`);
  - timer `withTimeout` tidak dibersihkan (`wallet.js:3-8`);
  - alamat Freighter yang tersimpan dipulihkan saat reload walau mode kembali ke Demo (`App.jsx:385,425`).
- **Struktur `App.jsx`**:
  - satu komponen `App` sekitar 900 baris (`App.jsx:382-1290`) dengan ±25 `useState`, data mock, kanvas 3D (`Robot3D`, `:147-363`), 4 halaman, 4 modal, dan inline style yang masif;
  - callback lewat global `window._cb` (`:449`);
  - `JSON.parse(localStorage…)` tanpa try/catch (`:423-426`), sehingga storage yang korup membuat app crash;
  - rating dicocokkan via `name`, bukan `owner` (`:504`);
  - kanvas lebar tetap 500px (`:158-161`; dampak ke mobile: TIDAK TERVERIFIKASI).

## 5. Cek live (read-only, 2026-10-25)

| Target | Hasil |
|---|---|
| https://agero.vercel.app/ | HTTP 200, title "Agero \| Decentralized AI Escrow Platform", memuat `/assets/index-BWZaT6sa.js`, nama file yang **identik** dengan build HEAD lokal. Deploy = commit HEAD |
| Kontrak `CBEIINKJ…BW5X` di testnet | **Masih ada.** `stellar contract info interface` sukses; `stellar contract fetch` → SHA-256 `46FD4BC6…DAFD200`, **sama** dengan build lokal. stellar.expert: dibuat 2026-07-13, `invocations: 1`, `events: 0`, `storage_entries: 1`, `validation: unverified` |
| TTL instance | `liveUntilLedgerSeq: 0`, ledger terbaru 5379619 (protokol 29). Status arsip: TIDAK TERVERIFIKASI |
| Video demo (Google Drive) | HTTP 200 (isi tidak dicek) |
| Pitch deck (Gamma) | HTTP 403 untuk klien non-browser. TIDAK TERVERIFIKASI |

## Tabel temuan

| ID | Prio | Area | Bukti | Dampak | Saran perbaikan |
|---|---|---|---|---|---|
| F01 | P0 | Frontend ↔ kontrak | `App.jsx:447-450,1131,470`; 0× contract ID/RPC di `src` & bundle | Klaim inti "escrow on-chain" tidak terjadi di app; semua tx simulasi, termasuk mode Freighter | Integrasikan `@stellar/stellar-sdk` + `signTransaction` Freighter untuk `create_job`/`complete_job`/`refund_job` ke contract ID di README |
| F02 | P0 | Kontrak / desain escrow | `lib.rs:211-237`, `:27-33`, `:192` | Klien bisa menerima hasil kerja lalu refund; agen tanpa jaminan pembayaran; tidak ada dispute walau README mengklaimnya | Tambah deadline + status `Delivered`, batasi refund klien hanya setelah deadline tanpa delivery, dan sediakan auto-release atau arbiter |
| F03 | P0 | UI / kejujuran | `App.jsx:565,586,841,1225,460,470` | UI menampilkan "Payment VERIFIED", "real transaction hashes", "registered on-chain" untuk aksi simulasi, sehingga menyesatkan juri/pembaca LinkedIn | Label jelas "SIMULATED" di semua jalur demo dan hapus klaim verifikasi palsu |
| F04 | P1 | Kontrak / rating | `lib.rs:110-126`; PoC A | Siapa pun bisa memalsukan rating tanpa batas | Wajibkan `client.require_auth()` + `job_id` Completed milik pemberi rating, dan tandai job sudah dirating |
| F05 | P1 | Kontrak / self-dealing | `lib.rs:129-176,147`; PoC C | `total_jobs` (sinyal reputasi) bisa digelembungkan gratis | Tolak `client == agent_owner` dan `amount == 0`, serta wajibkan `price > 0` |
| F06 | P1 | Kontrak / token | `lib.rs:133,161`; PoC D | Agen bisa "dibayar" dengan token tak bernilai; harga tidak bermakna lintas token | Simpan token yang diterima di profil agen (atau whitelist admin) dan cek kesamaan di `create_job` |
| F07 | P1 | Kontrak / API baca | daftar 7 fungsi (`stellar contract build`) | Tanpa `get_job`/enumerasi agen, frontend tidak bisa menampilkan state on-chain | Tambah `get_job`, `get_job_count`, dan event agar bisa di-index |
| F08 | P1 | Data / kejujuran | `App.jsx:7-48,50-128` | 11 agen, rating, jumlah job, dan ulasan fiktif tampil seolah nyata | Tandai sebagai data contoh, atau ambil dari chain setelah F01/F07 |
| F09 | P1 | x402 gateway | `x402_simulator.js:38-49,65,71,56-88` | Bypass MOCK, issuer USDC tidak dicek, replay hash, tidak terhubung ke escrow | Hapus bypass di luar mode dev, cek issuer + `successful`, simpan hash terpakai, dan verifikasi via status Job kontrak |
| F10 | P1 | Wallet | `wallet.js:24,36`; `isConnected.d.ts:2-6` | Deteksi "Freighter belum terpasang" tidak pernah jalan; error tampil "[object Object]" | Pakai `(await isConnected()).isConnected` dan `access.error.message`, serta cek `getNetwork()` = TESTNET |
| F11 | P2 | Kontrak / TTL | grep `extend_ttl` kosong; instance `liveUntilLedgerSeq: 0` | Entri agen/job/instance bisa ter-arsip; dana escrow terkunci sampai restore | `extend_ttl` pada instance + entri persistent di setiap write/read penting |
| F12 | P2 | Kontrak / observability | grep events kosong; stellar.expert `events: 0` | Tidak bisa di-index atau dilacak explorer | `env.events().publish` di register/create/complete/refund/rate |
| F13 | P2 | Kontrak / error | `lib.rs:60,99,…,225` | Error tidak bisa dibedakan klien | Ganti `panic!` dengan `#[contracterror]` + `Result` |
| F14 | P2 | Kontrak / overflow | `lib.rs:12,122,201`; `Cargo.toml:12` | Teoretis: panic setelah ~859 juta rating | Pakai `u64` atau `checked_add` dengan error eksplisit |
| F15 | P2 | Tes | `test.rs:9,52,78,126,173`; warning `:86,132,179` | Nol tes auth negatif dan edge case; API deprecated | Tambah tes auth negatif + edge case (lihat §3) dan pakai `register_stellar_asset_contract_v2` |
| F16 | P2 | Dependensi | `npm audit` root: 1 critical/5 high; frontend: 4 high (dev) | Risiko pada gateway lokal & dev server | `npm audit fix`, migrasi `stellar-sdk` → `@stellar/stellar-sdk` |
| F17 | P2 | Struktur frontend | `App.jsx:382-1290,449,423-426,504` | Sulit dirawat; crash bila localStorage korup; global `window._cb` | Pecah per halaman/komponen + hook `useContract`, try/catch parse, dan hapus global |
| F18 | P2 | CI / tooling | tidak ada `.github/`; Git Bash link gagal | Regresi tidak tertangkap; build tidak reprodusibel di semua shell | Workflow GitHub Actions: `cargo test`, `stellar contract build`, `npm ci && npm run build && npm run lint` |
| F19 | P2 | Dokumentasi | `README.md:137,229-235,279` | Daftar agen & tabel API tidak cocok dengan kode | Sinkronkan README dengan kode (lihat tabel klaim) |

Total: **P0 = 3, P1 = 7, P2 = 9**.

## 6. Tabel klaim README

| Klaim (README) | Verdict | Bukti |
|---|---|---|
| Kontrak di testnet `CBEIINKJ…BW5X` (`:15,50`) | **BENAR** | Kontrak ada; hash WASM = build HEAD; baru 1 invocation |
| Live deployment agero.vercel.app (`:24,36`) | **BENAR** | HTTP 200, bundle = HEAD |
| "Funds locked on-chain, released on completion or refunded on dispute" (`:45,138`) | **SEBAGIAN / SALAH** | Kontrak bisa mengunci & melepas (`lib.rs:162,207`), tetapi app tidak memanggilnya (F01) dan tidak ada mekanisme dispute (F02) |
| "Browse 11 autonomous AI agents … with live sample outputs" (`:67`) | **SIMULASI** | Agen hardcoded `App.jsx:50-128`; output = PNG statis `App.jsx:711-718` |
| Daftar 11 agen termasuk "Presentation Maker" (`:137`) | **SALAH** | Kode punya "Sentiment Analyst", bukan Presentation Maker (`App.jsx:115`) |
| "Lock escrow funds through a Soroban smart contract" (`:74`) | **SIMULASI** | `App.jsx:464-476` hanya localStorage |
| x402 "Machine-to-machine payment verification via HTTP headers" (`:139`) | **SIMULASI** (live) / **SEBAGIAN** (lokal) | Live: fallback `App.jsx:577-590`. Lokal: gateway cek Horizon tapi ada bypass MOCK dan tidak terhubung ke escrow (F09) |
| "Freighter Integration — Connect real Stellar wallet" (`:141`) | **SEBAGIAN** | Hanya mengambil alamat (`wallet.js:29-39`); tidak ada penandatanganan transaksi |
| "Rating System — On-chain star ratings and text reviews" (`:143`) | **SALAH** | Kontrak menyimpan bintang saja (`lib.rs:110-126`), tetapi UI tidak memanggilnya; ulasan teks hanya di localStorage (`App.jsx:499-534`) |
| "Interactive 3D Core … HTML5 Canvas" (`:60,140`) | **BENAR** | `App.jsx:147-363` |
| React 19 + Vite 8 (`:19-20,264`) | **BENAR** | react 19.2.7, vite 8.1.4 |
| Arsitektur: Frontend → Soroban → Testnet (Horizon) (`:100-129`) | **SALAH** | Frontend tidak memanggil Soroban/Horizon (F01) |
| Escrow flow "create_job (lock XLM)" (`:279`) | **SEBAGIAN** | Token bebas dipilih pemanggil; komentar kode menyebut USDC (F06) |
| Tabel API kontrak (`:229-235`) | **SALAH** (parameter) | `register/update_agent` juga butuh `description`; `create_job` butuh `token`; `refund_job` butuh `caller` (`lib.rs:48-55,129-135,211`) |
| `App.jsx` "1200+ lines" (`:210`) | **BENAR** | 1290 baris |
| Demo video / pitch deck | **TIDAK TERVERIFIKASI** | Drive 200, Gamma 403; isi tidak diperiksa |

## Pertanyaan terbuka

1. Satu-satunya invocation on-chain (1 storage entry) itu apa: `register_agent` milik wallet siapa? Apakah ada niat mendaftarkan 11 agen itu secara nyata di chain?
2. Untuk konten LinkedIn, mau framing jujur sebagai "prototype UI + kontrak escrow ter-deploy (belum terintegrasi)", atau integrasi F01 dibereskan dulu sebelum posting?
3. Token escrow yang dituju XLM native (SAC) atau USDC testnet? Ini menentukan desain F06 dan teks UI.
4. Model penyelesaian sengketa yang diinginkan: auto-release setelah deadline, arbiter/admin, atau voting? (menentukan desain F02)
5. Apakah gateway x402 memang akan di-deploy (misalnya Vercel Functions), atau cukup sebagai demo lokal? Ini menentukan prioritas F09.

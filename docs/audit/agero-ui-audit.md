# Audit UI/UX Agero — 2026-10-30 (Fase 4)

Commit yang diaudit: `a424874` (branch `main`, working tree bersih). Mode: read-only; tidak ada kode, style, aset atau dependensi aplikasi yang diubah. Standar: **Umem Design Standard v1**.

Metode:
- Membaca `CLAUDE.md`, README §Status, `frontend/index.html`, `src/main.jsx`, `src/App.jsx`, semua file di `src/components/`, `src/index.css`, `src/App.css`, `src/agents.js` dan `src/data/sample-agents.json`.
- Build produksi (`npm run build`) disajikan dengan `vite preview`, lalu diambil screenshot nyata dengan Playwright 1.64.1 dari cache npx **di luar repo**, memakai Chromium yang sudah terpasang. Skrip juga mengukur overflow horizontal, ukuran area sentuh, urutan tab, gaya fokus, font yang dimuat, ukuran transfer, perilaku tombol Escape, dan `prefers-reduced-motion`.
- Kontras dihitung dengan rumus WCAG 2.x. Warna transparan dikomposisikan di atas `#171d1b` (body) atau di atas permukaan kartu `rgba(44,53,49,.4)`. Ini perkiraan: blob dan blur di belakang kartu menggeser warna latar sedikit, ke arah yang berbeda-beda di tiap posisi layar.
- Registry dibaca langsung dari Testnet saat pengambilan gambar: 12 agen (1 smoke-test + 11 Sample), 1 job.

Halaman yang butuh wallet (My Jobs dan Agent Dashboard saat terhubung, langkah form/review di Hire, TxProgress, modal Rating/Verify/Deliver/Refund, Playground) **ditinjau dari kode saja**. Yang punya screenshot hanya keadaan *disconnected*-nya dan modal Hire tanpa wallet.

---

## Ringkasan eksekutif

Kejujuran konten sudah sangat baik: label Sample dan Simulated konsisten, ada keadaan loading/empty/error untuk hampir semua tampilan data, dan alt gambar jujur. Masalah terbesar ada di **dasar visual dan aksesibilitas**. Dekorasi yang menumpuk (glass, blob, gradien, glow, robot 3D) menutupi produk yang sebenarnya, yaitu escrow dengan tenggat dan hash.

| Tingkat | Jumlah | Inti |
|---|---|---|
| **P0** | 3 | Navbar tidak responsif: di 320/375/414 px halaman melebar jadi 711 px dan tombol **Connect Wallet** berada di luar layar (U01). Warna aksen teal gagal kontras: tombol utama 2,86:1, teks/tautan teal 2,0–2,5:1 (U02). Kartu agen tidak bisa dibuka lewat keyboard (U03) |
| **P1** | 16 | Modal tanpa Escape/focus trap; fokus form nyaris tak terlihat (1,02:1); `--text-dim` 3,3–3,7:1 dipakai untuk paragraf; `prefers-reduced-motion` diabaikan; area sentuh 14–30 px; glassmorphism dan campuran strategi kedalaman; gradien dekoratif pada judul; kartu dengan aksen kiri; chrome terminal gambar tangan; >1 aksen; gambar 1024² JPEG berlabel `.png` (~6 MB di Marketplace); satu gambar sampel cacat (pola kotak-kotak); banner menyebut jalur tulis "Real" padahal README bilang uji manual belum dilakukan |
| **P2** | 19 | Sebaran token (16 ukuran font, ±53 % nilai spasi di luar skala, 10 nilai radius, 127 `style={{}}` inline); CSS/aset mati; Inter dipakai sebagai display dengan bobot 750/850 yang tidak tersedia; inkonsistensi istilah; deskripsi sampel mengklaim "AI"/"real-time"; dll. |

Penilaian diri sesuai standar (opini, skala 1–5): filosofi 2 · hierarki 3 · eksekusi 2 · spesifisitas 2 · **restraint 1** · variasi 3. Uji tukar: kalau font, warna dan robotnya diganti template "AI SaaS" lain, hampir tidak ada yang berubah. Elemen paling khas Agero (tenggat, jendela review 72 jam, hash hasil) justru tampil sebagai teks kecil.

---

## 1. Inventaris layar & komponen

### Layar dan state

| Layar / state | Sumber | Butuh wallet | Screenshot |
|---|---|---|---|
| Home (hero + robot 3D, 3 agen unggulan, "How Agero Works") | `App.jsx:305-378` | tidak | `home-{320,375,414,768,1440}.jpg` |
| Marketplace (3 stat card, filter kategori, grid agen) | `App.jsx:381-414` | tidak | `marketplace-*.jpg` |
| Detail agen (info grid, endpoint, gambar sampel, owner, Hire, panel Rating) | `App.jsx:222-301` | tidak | `agent-detail-*.jpg` (agen pertama = Smoke Test Agent, tanpa gambar) |
| Detail agen — agen tidak ditemukan | `App.jsx:229-232` | tidak | kode |
| Hire modal — tanpa wallet | `HireModal.jsx:60-64` | tidak | `hire-modal-nowallet-{375,1440}.jpg` |
| Hire modal — form, error, saldo, review | `HireModal.jsx:65-107` | ya | kode |
| TxProgress drawer (4 langkah, sukses, gagal, hash) | `TxProgress.jsx` | ya | kode |
| My Jobs — disconnected | `MyJobs.jsx:111-119` | tidak | `myjobs-disconnected-{375,1440}.jpg` |
| My Jobs — stat, daftar job, skeleton, empty, error, modal Rating, modal Verify | `MyJobs.jsx:121-202` | ya | kode |
| Agent Dashboard — disconnected | `AgentDashboard.jsx:148-159` | tidak | `agent-dashboard-disconnected-{375,1440}.jpg` |
| Agent Dashboard — register/update profil, stat penghasilan, job masuk, modal Deliver, konfirmasi Refund | `AgentDashboard.jsx:161-274` (render utama mulai baris 171), `AgentProfileForm.jsx` | ya | kode |
| Developer (kartu "Your agent" + perintah CLI) | `App.jsx:447-491` | tidak (sebagian) | `developer-*.jpg` |
| Playground x402 (simulasi) | `Playground.jsx` | ya (dibuka dari job) | kode |
| Wallet dropdown, toast notifikasi, banner prototype, banner config error | `App.jsx:159-217` | tidak | terlihat di semua screenshot |

### Pola yang berulang ≥ 2 kali (kandidat komponen)

| Pola | Kemunculan | Status |
|---|---|---|
| Kerangka modal (overlay + judul + tombol X) | HireModal, RatingModal, VerifyModal, `Modal` di AgentDashboard, Playground (5) | Hanya AgentDashboard yang punya komponen `Modal`; yang lain menyalin markup |
| Baris stat card (3 kartu, garis kiri berwarna) | Marketplace, My Jobs, Agent Dashboard (3) | disalin |
| Kartu job (progress bar + judul + badge + meta + waktu + hash + aksi) | MyJobs, AgentDashboard (2) | hampir identik, disalin |
| Daftar key-value (`drawer-info` / `drawer-row`) | Developer, Hire review, TxProgress, Agent Dashboard (4) | hanya kelas CSS |
| Empty state (ikon bulat + teks + tombol) | RegistryState, ErrorState, MyJobs ×2, AgentDashboard ×2 (6) | sebagian sudah jadi komponen |
| Prompt "Connect Freighter" | HireModal, MyJobs, AgentDashboard (3) | disalin |
| Kartu agen | `AgentCard` (marketplace) dan `featured-card` (home) | dua implementasi untuk satu konsep |
| Header seksi (judul gradien + deskripsi) | 4 halaman | kelas CSS |
| `field-caption` + `mono-box` | detail, Verify, HashSource, AgentDashboard (4) | kelas CSS |
| Tombol modal "Sign … in Freighter" + Cancel/Back | 6 tempat | disalin |

---

## 2. Token yang ditemukan

Belum ada file design-system. Token yang ada di `index.css:3-49` hanya sebagian dipakai, dan namanya menyesatkan karena bekas template lama: `--blue` = teal, `--lavender` = sand, `--rose` = peach (`index.css:16-18`).

**Warna**
- Palet bernama (komentar di kode: "exact user choices"): `#171d1b` bg, `#0d1210`, `#2C3531` forest, `#116466` teal (aksen), `#D9B08C` sand, `#FFCB9A` peach, `#D1E8E2` mint (teks).
- Semantik: `#8dd9a6` hijau, `#e28c8c` merah.
- Literal di luar token: `#fcd34d` (isian bintang, `ui.jsx:8`, `MyJobs.jsx:46`), `#2a2d3a` (bintang kosong), `#fca5a5`, `#fcd34d` dan `#6ee7b7` (titik terminal), `#022c22` dan `#450a0a` (teks toast), `#020204` (konsol), `#ffffff` (`.main-node`, `.featured-category`).
- **Sisa palet template lama**: `rgba(37,99,235,…)` (biru Tailwind, 6×) dan `rgba(199,219,247,…)` (biru muda, 17×) dipakai di hover, shadow, scrollbar dan border. Ini bukan bagian palet Agero.
- Total: 19 hex unik dan ±50 kombinasi `rgba()` unik di `index.css`.

**Font**
- Satu keluarga, Inter, lewat `@import` Google Fonts dengan bobot 300–800 (`index.css:1`). Mono memakai `monospace` generik.
- Inter juga dipakai sebagai display (hero 54 px). Bobot 750 dan 850 dipakai (`index.css:1186,1344,1413,1516`) padahal yang dimuat hanya sampai 800, jadi browser membulatkan bobotnya. Bobot 300 diminta tetapi tidak dipakai.
- **16 ukuran font**: 10, 11, 11.5, 12, 12.5, 13, 14, 15, 16, 18, 20, 26, 28, 30, 40, 54 px. Tidak mengikuti rasio skala; 11–13 px mendominasi (70 dari 106 deklarasi).

**Spasi**
- Di `index.css`, 99 dari 186 nilai padding/margin/gap (±53 %) berada di luar skala 4/8/12/16/24/32. Yang paling sering: 14 px (19×), 6 px (17×), 10 px (15×), 20 px (13×). Ada juga 3, 5, 9, 11, 18, 22, 28, 30, 36 px.
- Di style inline JSX: 27 dari 73 nilai di luar skala (5, 6, 10, 14, 18, 20, 30 px).

**Radius**: 10 nilai berbeda: 2, 3, 6, 8, 10, 12, 14 (`--radius`), 18 (`--radius-lg`), 100 px dan 50 %. Tidak konsentris: kartu 18 px berisi item 14 px dengan padding 14 px.

**Kedalaman**: tiga strategi sekaligus, ditambah dekorasi:
1. border 1 px `rgba(mint,.08)`;
2. `box-shadow` pada kartu, yang dideklarasikan dua kali (`index.css:383` lalu ditimpa `:1101`), plus glow saat hover;
3. `backdrop-filter: blur()` di 12 tempat;
4. pseudo-border gradien `.card::after` dengan mask (`index.css:1104-1115`) dan sorotan radial `.card::before` (`:388-401`).

**Blur / transparansi (inventaris "Liquid Glass")**

| Lokasi | Nilai | Dampak keterbacaan |
|---|---|---|
| `.bg-blob` ×3 (`index.css:99-127`) | `filter: blur(140px)`, 500–800 px, beranimasi | Mengubah warna latar di belakang teks; di 1440 px separuh kanan hero berwarna coklat-oranye. Penyebab overflow di mobile (lihat U01) |
| `.navbar` (`:157-166`) | `blur(24px) saturate(1.5)` + bg 75 % | Aman; bg cukup pekat |
| `.card` (`:376-386`) | `blur(20px) saturate(160%)`, bg **40 %** | Kontras teks ikut bergeser tergantung blob di belakangnya. `--text-dim` di kartu turun ke ±3,4:1 |
| `.wallet-dropdown`, `.modal`, `.drawer` | `blur(20–24px)`, bg 95–96 % | Blur nyaris tak terlihat karena bg hampir pekat; biaya GPU tanpa manfaat |
| `.overlay`, `.drawer-bg` | `blur(6px)`, `blur(4px)` | Wajar untuk backdrop modal |
| `.featured-category` (`:1391-1402`) | bg putih 90 % + `blur(8px)` | Pil putih terang di atas gambar gelap; kontras teks 5,7:1 (lolos), tetapi gaya ini tidak dipakai di tempat lain |
| `.graphic-node` (`:1247-1261`) | `blur(20px)` | CSS mati, tidak dirender |

---

## 3. Tabel temuan

Bukti `file:baris` relatif ke `frontend/src/` kecuali disebut lain. Screenshot ada di `docs/audit/ui-shots/`.

### P0

| ID | Temuan | Bukti | Usulan perbaikan |
|---|---|---|---|
| U01 | Navbar tidak punya layout mobile. Di 320/375/414 px, 5 tautan + tombol wallet tidak muat: `nav-links` selebar 485 px sampai di x=603, dan `documentElement.scrollWidth` = **711 px**. Tombol **Connect Wallet**, satu-satunya pintu ke semua jalur tulis, berada di luar layar. Blob 800 px dan canvas robot selebar 500 px tetap (`Robot3D.jsx:31-34`) ikut memperlebar halaman; `body{overflow-x:hidden}` tidak mencegahnya di level dokumen | `index.css:168-173,198`; `marketplace-375.jpg`, `agent-detail-375.jpg`, `developer-320.jpg` (lebar gambar 711 px) | Di bawah ±768 px, pindahkan nav ke menu (`<details>` native atau bottom tabs), buat canvas mengikuti lebar kontainer, dan clip lapisan latar dengan `overflow:hidden` pada wrapper `position:fixed` |
| U02 | Aksen teal `#116466` gagal kontras di semua peran teks. Tombol primer (teks `#080b0a` di atas teal) **2,86:1**. Teks teal di bg 2,47:1 dan di kartu 2,22:1: tautan explorer, alamat owner, harga di detail, nav aktif, ikon. Pil kategori (teal di atas teal 15 %) **2,01:1** | `index.css:31,607,216-219,449-457,1545`; `App.jsx:250,281`; `agent-detail-375.jpg` (harga "1" dan owner nyaris hilang) | Pakai teks mint `#D1E8E2` di atas isian teal (**5,38:1**), dan untuk teks/tautan pakai teal terang, mis. `#5cb8b2` (7,3:1 di bg, 5,5:1 di modal) sebagai token `--accent-text` |
| U03 | Kartu agen (home dan marketplace) berupa `<div onClick>` tanpa `tabIndex`, role atau handler tombol. Pengukuran: 0 dari 15 kartu bisa difokus. Tab langsung lompat dari "My Jobs" di hero ke `<body>`. Detail agen dan Hire **tidak bisa dicapai dengan keyboard** | `App.jsx:29,334`; hasil uji Tab di `measure` | Bungkus judul kartu dengan `<button>` atau `<a>`, lalu perluas area klik dengan pseudo-element (pola "card link") |

### P1

| ID | Temuan | Bukti | Usulan perbaikan |
|---|---|---|---|
| U04 | Modal dan drawer tidak menutup dengan **Escape** (diuji: tetap terbuka). Fokus tidak dipindah ke dalam modal, tidak ada focus trap, tidak ada `aria-modal`, dan fokus tidak dikembalikan saat ditutup. Playground tidak punya `role="dialog"` maupun label | `HireModal.jsx:53-54`, `MyJobs.jsx:34-35,60-61`, `AgentDashboard.jsx:47-58`, `Playground.jsx:70-71`, `TxProgress.jsx:18-19` | Satukan semua modal ke satu komponen berbasis `<dialog>` native (`showModal()` sudah memberi Escape, focus trap dan `inert`) |
| U05 | Indikator fokus input nyaris tak terlihat: `outline:none` diganti ring teal 15 % (**1,02:1** terhadap bg input) dan border teal (2,2:1). Border input saat diam 1,23:1. Tidak ada aturan `:focus-visible` sama sekali; tombol mengandalkan outline default Chrome (terlihat, lihat `focus-ring-nav-1440.jpg`), tetapi di Safari/Firefox hasilnya berbeda | `index.css:661-674` | Definisikan satu `:focus-visible` global (outline 2 px `--accent-text`, offset 2 px) dan border input ≥ 3:1 |
| U06 | `--text-dim` (mint 45 %) memberi 3,73:1 di bg, 3,59:1 di kartu dan 3,32:1 di modal, tetapi dipakai untuk **paragraf**: deskripsi hero 16 px, deskripsi seksi, deskripsi kartu unggulan, label stat, hint form, teks empty state | `index.css:44,1205-1207,1350-1353,1418-1421,726,1554`; `App.jsx:59,458,471` | Naikkan ke ≥ 62 % opacity (4,9:1 di modal) atau warna solid; sisakan nilai redup hanya untuk teks non-esensial ≥ 18 px |
| U07 | `prefers-reduced-motion` hanya mematikan skeleton. Yang tetap jalan saat preferensi itu aktif (diuji dengan `reducedMotion:'reduce'`): 3 blob melayang (24–35 s, tak berujung), "scanner pulse" 8 s, animasi masuk halaman (0,4 s), loop `requestAnimationFrame` robot 3D plus listener `mousemove`, `glowPulse`, `translateY` dan `scale` saat hover. Transisi global `all 0.3s` (`--transition`) juga menganimasikan properti layout | `index.css:48,90,110-127,148,1094,1543`; `Robot3D.jsx:47,219` | Bungkus semua animasi dekoratif dalam `@media (prefers-reduced-motion: no-preference)`, render robot sebagai frame statis, dan batasi transisi ke `transform, opacity` ≤ 200 ms |
| U08 | Area sentuh < 40 px: tutup banner **14×14**, `icon-btn` (tutup modal, bintang rating) ±26–36 px, pil filter 30 px, tab mode ±26 px, tautan explorer 24 px, tombol wallet 32 px. Di 375 px ada 8 elemen kecil di Marketplace dan 4 di detail | `measure` (`small`); `index.css:931-938,1548,629-640,1581` | Beri `min-height: 40px` dan `min-width: 40px` pada tombol ikon, pil dan tab; padding tutup banner ≥ 13 px |
| U09 | Glassmorphism plus campuran strategi kedalaman: setiap kartu punya bg 40 %, blur 20 px, border, dua shadow, border gradien ber-mask dan sorotan radial. Modal dan drawer mem-blur latar yang sudah 95 % pekat. Kontras teks jadi bergantung pada posisi blob (lihat §2) | `index.css:376-408,1098-1115,821,846` | Pilih satu strategi saja: permukaan solid dengan pergeseran lightness (forest 1/2/3) dan border hairline; hapus blur selain backdrop overlay |
| U10 | Gradien dekoratif di teks: semua judul halaman (teal→sand) dan "AI Agent Economy" (teal→sand→peach). Awal gradien teal tetap 2,5:1. Ditambah garis atas gradien pada kartu agen saat hover dan garis timeline gradien | `index.css:358-366,1198-1203,424-434,1467` | Judul pakai warna teks solid; gradien dihapus |
| U11 | Kartu dengan aksen kiri (anti-slop): `stat-card::after` memberi bar 3 px di kiri dengan 4 warna; `notice-card` memakai `border-left: 3px` amber | `index.css:713-724,1578`; `marketplace-1440.jpg` | Hapus bar kiri; bedakan stat lewat label dan angka saja, dan notice lewat ikon + latar |
| U12 | Chrome terminal gambar tangan (titik merah/kuning/hijau gaya macOS) di header Playground, ditambah judul pseudo-path `~/agent_name` | `Playground.jsx:74`; `index.css:1033-1047` | Hapus titik-titik; cukup judul "x402 playground (simulated)" |
| U13 | Lebih dari satu aksen: teal (aksi, nav, tautan), peach (eyebrow hero, nilai stat, badge Sample, banner, gradien), sand (bintang, pending, gradien), plus sisa biru `rgba(37,99,235)` dan `rgba(199,219,247)` dari template. Peach dipakai untuk "penting/hangat" sekaligus untuk "Sample/Simulated", sehingga makna peringatan kejujuran jadi kabur | `index.css:16-19,65,214,248,252,393,1520`; `App.jsx:395` | Satu aksen (teal) untuk aksi. Peach dikhususkan untuk label Sample/Simulated. Sand untuk status pending/bintang. Biru dihapus |
| U14 | Gambar sampel: 11 file JPEG 1024×1024 (tersimpan dengan ekstensi `.png`), 380–805 KB per file, ditampilkan ±300×140 px. Marketplace memuat semuanya sekaligus, ±6 MB. Tanpa `loading="lazy"`, tanpa `width`/`height` sehingga terjadi layout shift. Home saja mentransfer ±1,9 MB (1,7 MB gambar) | `public/agent_*.png` (`file`: "JPEG image data … 1024x1024"); `App.jsx:32,337`; `measure.resources` | Ekspor ulang ke WebP/AVIF 640 px (±30–60 KB) dengan ekstensi yang benar, tambahkan `loading="lazy" decoding="async"` dan dimensi eksplisit |
| U15 | Gambar "Summarizer Bot" punya pola kotak-kotak transparansi palsu yang tertanam di piksel, sehingga tampak rusak. "Voice Cloner" dan "Music Composer" punya sudut putih tertanam | `marketplace-1440.jpg`, `home-1440.jpg` | Ganti atau crop gambar-gambar itu, atau hapus gambar dari kartu (lihat arah desain) |
| U16 | Banner bilang "**Real on Stellar Testnet** (signed in Freighter): … XLM escrow (create, deliver, approve, release, refund) and star ratings". Kode memang memanggil kontrak dan memeriksa hasilnya, jadi aturan CLAUDE.md terpenuhi secara teknis. Tetapi README §Status dan CLAUDE.md menyatakan jalur tulis Freighter **belum diuji manual end-to-end**. Standar Umem: "Claim only what is built and tested" | `App.jsx:175`; README baris 65-71; `CLAUDE.md:3-5` | Ganti dengan "Implemented on Testnet (manual Freighter test pending)" sampai checklist §9/§10 lulus (lihat pertanyaan terbuka #4) |
| U17 | Dua elemen interaktif bukan elemen yang benar: logo `<a onClick>` tanpa `href`, jadi dilewati Tab (terverifikasi), dan nav aktif tanpa `aria-current`. Tombol wallet tanpa `aria-expanded`/`aria-haspopup`, dropdown tidak menutup dengan Escape | `App.jsx:186,193,198` | Logo jadi `<button>` (atau `<a href="#">`), tambah `aria-current="page"`, `aria-expanded`, dan Escape untuk dropdown |
| U18 | Label form Playground tidak terhubung ke kontrolnya (`<label>` tanpa `htmlFor` di atas `<div>`/`<textarea>`), dan textarea tanpa nama aksesibel. Bintang rating tidak mengumumkan nilai terpilih (`aria-pressed` atau radio group) | `Playground.jsx:86,90,94-95`; `MyJobs.jsx:44-47` | Hubungkan label dengan `htmlFor`/`id`; bintang dijadikan `role="radiogroup"` dengan `aria-checked` |
| U19 | Animasi tanpa batas di latar memakai `filter: blur(140px)` pada elemen 500–800 px yang bergerak, ditambah loop canvas 60 fps yang tetap jalan saat robot tidak terlihat (scroll ke bawah atau pindah halaman non-Home tidak menghentikannya kecuali komponen di-unmount). Biaya GPU/baterai tinggi di ponsel | `index.css:99-140`; `Robot3D.jsx:219` | Latar statis; jalankan canvas hanya saat terlihat (IntersectionObserver) atau ganti dengan gambar statis |

### P2

| ID | Temuan | Bukti | Usulan perbaikan |
|---|---|---|---|
| U20 | Sebaran token: 16 ukuran font, ±53 % spasi di luar skala, 10 radius, 3 bobot di luar file font | §2 | Tetapkan skala tipe (mis. 12/14/16/20/24/32/40, rasio ±1,25), skala spasi 4/8/12/16/24/32, dan radius 6/10/16 konsentris |
| U21 | 127 `style={{…}}` inline di JSX, termasuk warna, ukuran font dan padding, sehingga token tidak bisa ditegakkan | `grep -c "style={{"`: App 31, AgentDashboard 23, MyJobs 17, Playground 16, TxProgress 12 | Pindahkan ke kelas atau komponen begitu pola diekstrak (§1) |
| U22 | CSS dan aset mati: `App.css` (template Vite, tidak di-import), kelas `.mode-toggle`, `.review-*`, `.btn-rose`, `.flow-legend`, `.activity-*`, `.hero-badge`, `.graphic-*`/`.main-node`/`.line-*` (±250 baris). `src/assets/hero.png`, `react.svg`, `vite.svg`, `public/icons.svg` dan `public/avatar_*.png` (**2,8 MB**, ikut ter-copy ke `dist/`) tidak direferensikan | `index.css:303-330,574-589,610,789-805,973-989,1168-1331`; grep tanpa hasil | Hapus |
| U23 | Inter sebagai font display (hero 54 px/850) melanggar "Avoid Inter as display". Bobot 750/850 tidak tersedia, bobot 300 dimuat sia-sia, dan font dimuat lewat `@import` di dalam CSS (rantai pemuatan berantai yang memblokir render) | `index.css:1,1183-1190` | Pasangkan display yang khas dengan body yang rapi (lihat arah), muat lewat `<link rel="preconnect">` + `<link>` di `index.html` dengan bobot yang dipakai saja |
| U24 | Istilah tidak konsisten. Hire modal: "The agent's work itself is not performed by this prototype (**simulated**)", padahal di tempat lain kerja agen disebut "Outside Agero", bukan simulasi. Tombol "Connect **Wallet**" vs "Connect **Freighter**". Aksi "Approve & pay" / "complete_job" / "Approve or Refund" / "Release payment" tanpa glosarium | `HireModal.jsx:100`; `App.jsx:199,213` | Satu glosarium: Outside Agero / Simulated / Sample; tombol "Connect Freighter" di semua tempat |
| U25 | Deskripsi agen sampel (tersimpan on-chain lewat seed) mengklaim "AI agent to **instantly** summarize", "**real-time**", "Supports **10+** global languages", "Ultra-fast". Sudah diberi badge Sample dan catatan "no AI work is performed", tetapi standar melarang klaim AI/real-time yang tidak benar | `data/sample-agents.json:7,23,79,87`; `marketplace-1440.jpg` | Seed ulang dengan deskripsi netral, atau tampilkan deskripsi Sample dengan awalan "Illustrative:" (butuh keputusan, karena seed = transaksi) |
| U26 | "Read **live** from the Agero contract": data dibaca sekali saat halaman dimuat, bukan langganan real-time | `App.jsx:330` | "Read from the Agero contract on Stellar Testnet when the page loads" |
| U27 | Kategori dan gambar hanya ada di frontend (kontrak tidak menyimpannya), tetapi tampil setara dengan data kontrak, dan filter kategori dibangun dari situ. README menjelaskannya, UI tidak | `agents.js:7-18`; `App.jsx:101,406` | Tandai metadata UI-only, mis. tooltip atau gaya berbeda dari field kontrak |
| U28 | Judul dokumen "Decentralized **AI** Escrow Platform": Agero tidak menjalankan AI | `frontend/index.html:7` | "Agero: Testnet escrow for agent jobs" |
| U29 | Bintang memakai dua warna (isi `#fcd34d` literal, garis `--amber` sand). Bintang kosong `#2a2d3a` = 1,12:1, tak terlihat, sehingga agen tanpa rating tampak tanpa komponen rating | `ui.jsx:8`; `index.css:492-493` | Satu token bintang; bintang kosong ≥ 3:1 atau tampilkan teks "No ratings yet" |
| U30 | Kartu Smoke Test Agent (tanpa gambar) diregangkan grid sehingga punya ruang kosong ±200 px | `marketplace-1440.jpg`; `index.css:411-415` | `align-items:start` atau gunakan placeholder tinggi tetap |
| U31 | Halaman Developer menduplikasi Agent Dashboard ("Your agent" + tombol ke dashboard). Teksnya "CLI commands **on the right**" salah di mobile karena CLI ada di bawah | `App.jsx:447-491,451`; `developer-320.jpg` | Gabungkan ke Agent Dashboard sebagai seksi "Use the stellar CLI instead", atau ubah teks jadi "below/alongside" |
| U32 | Toast error hilang sendiri setelah 6 s dan memakai `role="status"` (sopan) untuk error | `App.jsx:106-109,160` | Error memakai `role="alert"` dan tetap tampil sampai ditutup |
| U33 | Saat me-refresh daftar job yang sudah ada, satu-satunya tanda adalah tombol Refresh yang disabled. Stat Marketplace kembali ke "—" saat `status==='refreshing'` | `MyJobs.jsx:145,148`; `App.jsx:82,391` | Spinner kecil atau "Refreshing…" pada toolbar; pertahankan angka lama saat refreshing |
| U34 | Tidak ada state `:active`/pressed di mana pun. Hover kartu mengangkat (`translateY`) dan memberi glow pada elemen yang tidak bisa difokus | grep `:active` = 0; `index.css:403-408` | Tambah pressed state (mis. `scale(.98)` atau lightness) pada `.btn`, pil dan tab |
| U35 | Bundle: JS 292 KB + 555 KB (chunk `server` = stellar-sdk, di-*modulepreload* sejak muat pertama) = ±201 KB gzip. CSS 29,7 KB (6,8 KB gzip). Vite memperingatkan chunk > 500 KB | `npm run build`; `dist/index.html` | Lazy-load SDK saat aksi pertama (`import()`), dicatat saja tanpa optimasi sekarang |
| U36 | Canvas robot tanpa `aria-hidden` atau label; elemen dekoratif ini dibaca sebagai canvas kosong oleh pembaca layar | `Robot3D.jsx` (render canvas) | `aria-hidden="true"` |
| U37 | Eyebrow dekoratif "AGERO ESCROW · STELLAR TESTNET" huruf kapital dengan letter-spacing 0.16em, plus judul Playground serba kapital ("EXECUTE TASK (SIMULATED X402)") | `App.jsx:309`; `Playground.jsx:98` | Hapus eyebrow; tombol pakai sentence case |
| U38 | Robot 3D (heksagon wireframe dengan "mata" bercahaya) adalah klise "AI" yang tidak menjelaskan apa pun tentang escrow, dan memakan setengah layar hero di desktop | `home-1440.jpg` | Ganti dengan elemen produk nyata (lihat arah desain) |

### Yang sudah baik (pertahankan)

- `lang="en"`, `viewport` benar; semua `<img>` punya alt yang jujur ("static sample image").
- Loading/empty/error hadir di registry, My Jobs, Agent Dashboard, saldo Hire, TxProgress, HashSource. Error memakai `role="alert"` dan tombol "Try again".
- Label form dan `htmlFor` benar di HireModal dan AgentProfileForm; checkbox konfirmasi Deliver dibungkus `<label>`.
- Kejujuran: badge Sample, `sample-note`, prefix `[sim]`, "Simulated" di Playground, "not called by this UI" di endpoint, penjelasan "A match says nothing about quality". Tombol Hire untuk agen milik sendiri disabled dan dijelaskan alasannya.
- TxProgress menampilkan langkah nyata (simulate → sign → submit → confirm) dan tidak bisa ditutup saat sibuk.
- Tidak ada emoji sebagai ikon di UI (semua lucide). Emoji hanya ada di heading README, di luar cakupan UI.
- Unit konsisten "XLM" di UI; stroops hanya muncul di bagian CLI, dengan rumus konversi.

---

## 4. Matriks state

**Elemen interaktif** (✓ ada · – tidak ada · n/a tidak relevan)

| Elemen | default | hover | pressed | focus-visible | disabled |
|---|---|---|---|---|---|
| `.btn` (primary/outline/green/red/playground) | ✓ | ✓ | – | bawaan browser | ✓ (`opacity .5`) |
| `.nav-link` | ✓ | ✓ | – | bawaan browser | n/a |
| `.wallet-btn` / `.dropdown-action` | ✓ | ✓ | – | bawaan browser | ✓ (connect) |
| `.filter-pill`, `.mode-tab` | ✓ | ✓ / – | – | bawaan browser | n/a |
| `.icon-btn`, `.sim-banner-close` | ✓ | ✓ | – | bawaan browser | – |
| `.form-input` | ✓ | – | n/a | **lemah (U05)** | – (tak ada gaya disabled) |
| Kartu agen (`div`) | ✓ | ✓ | – | **tidak bisa difokus (U03)** | n/a |
| Logo (`a` tanpa href) | ✓ | – | – | **tidak bisa difokus (U17)** | n/a |
| `.link-btn`, `.explorer-link` | ✓ | ✓ | – | bawaan browser | n/a |
| Bintang rating | ✓ | ✓ (warna) | – | bawaan browser | n/a |

**Tampilan data**

| Tampilan | loading | empty | error |
|---|---|---|---|
| Registry (home, marketplace, detail) | ✓ skeleton | ✓ | ✓ + retry |
| Stat Marketplace | ✓ "—" | n/a | "—" tanpa pesan (pesan ada di bawah) |
| Detail: agen tak ditemukan | ✓ | ✓ teks polos | ✓ |
| My Jobs | ✓ skeleton (refresh: tidak, U33) | ✓ + CTA | ✓ + retry |
| Agent Dashboard (profil, job, stat) | ✓ | ✓ | ✓ + retry |
| Saldo di Hire | ✓ teks | n/a | ✓ teks |
| Developer "Your agent" | ✓ skeleton | ✓ | ✓ |
| TxProgress | ✓ langkah | n/a | ✓ |
| HashSource / Verify | ✓ "Computing…" | ✓ | ✓ |
| Playground | ✓ spinner | ✓ "Console ready" | ✓ log `[WARNING]` |

---

## 5. Aksesibilitas — ringkasan angka

| Pasangan | Rasio | Ambang | Status |
|---|---|---|---|
| `--text` mint di bg | 13,32 | 4,5 | ✓ |
| `--text-secondary` (75 %) di kartu | 7,35 | 4,5 | ✓ |
| `--text-dim` (45 %) di bg / kartu / hover / modal | 3,73 / 3,59 / 3,38 / 3,32 | 4,5 | ✗ U06 |
| Teal teks di bg / kartu | 2,47 / 2,22 | 4,5 | ✗ U02 |
| Teal di atas `--accent-soft` (pil kategori) | 2,01 | 4,5 | ✗ U02 |
| `.btn-primary` hitam di teal | 2,86 | 4,5 | ✗ U02 |
| Banner peach / badge Sample | 9,23 / 8,17 | 4,5 | ✓ |
| Badge pending, hijau, merah | 6,35 / 7,34 / 5,18 | 4,5 | ✓ |
| Toast sukses | 8,24 | 4,5 | ✓ |
| Bintang kosong (non-teks) | 1,12 | 3 | ✗ U29 |
| Border input (non-teks) | 1,23 | 3 | ✗ U05 |
| Ring fokus input (non-teks) | 1,02 | 3 | ✗ U05 |
| *Usulan:* mint di teal / `#5cb8b2` di bg / teks 62 % di modal | 5,38 / 7,29 / 4,90 | 4,5 | ✓ |

Urutan tab di Home (1440 px, terukur): tutup banner → Home → Marketplace → My Jobs → Agent Dashboard → Developer → Connect Wallet → Explore Marketplace → My Jobs → `<body>`. Logo, 3 kartu unggulan dan seluruh bagian bawah halaman dilewati.

---

## 6. Responsif

Screenshot nyata pada 320, 375, 414, 768 dan 1440 px untuk Home, Marketplace, Detail agen dan Developer, plus keadaan disconnected My Jobs/Agent Dashboard dan modal Hire tanpa wallet di 375 dan 1440 px (27 file JPEG q80, 3,4 MB).

| Lebar | Lebar dokumen | Catatan |
|---|---|---|
| 320 | 711 | Nav meluap, Connect Wallet di x 603–711. Hero robot 500 px. Kotak CLI scroll horizontal (wajar, `overflow-x:auto`) |
| 375 | 711 | Sama; "My Jobs"/"Agent Dashboard" terbungkus dua baris di nav |
| 414 | 711 | Sama |
| 768 | 768 | Tidak ada overflow dokumen; nav muat pas-pasan |
| 1440 | 1440 | Layout baik; hero kosong lebar di kanan bawah, latar blob coklat |

Catatan artefak: pada screenshot *full-page*, latar `position:fixed` hanya digambar setinggi viewport pertama, sehingga bagian bawah tampak lebih gelap. Di browser sungguhan latar ikut menutupi seluruh layar. Ini artefak screenshot, bukan bug.

---

## 7. Kejujuran konten

| Cek | Hasil |
|---|---|
| Banner simulasi | Ada, jelas, bisa ditutup (muncul lagi setiap muat). Lihat U16 soal kata "Real" |
| Label Sample | Konsisten: badge di kartu dan detail, catatan di detail, penjelasan di header Marketplace |
| `[sim]` / Simulated | Konsisten di Playground dan tombol "Test API (sim)" |
| Klaim "AI" | Judul dokumen (U28), hero "AI Agent Economy" (deskriptif tentang pasar, bisa diterima; opini), deskripsi sampel (U25) |
| "real-time"/"live" | "Read live" (U26); "real-time" di deskripsi sampel (U25) |
| Angka demo | Tidak ada angka karangan di UI; semua angka stat dibaca dari kontrak. Tidak ada testimoni atau logo palsu |
| XLM/stroops | Konsisten |
| Status job | Pending/Delivered/Completed/Refunded konsisten dengan kontrak; nama aksi bervariasi (U24) |
| Bahasa | Seluruh teks UI berbahasa Inggris ✓ |

---

## 8. Performa dasar (diukur, tidak dioptimasi)

| Item | Ukuran |
|---|---|
| `index-*.js` | 292,2 KB (88,1 KB gzip) |
| `server-*.js` (stellar-sdk, modulepreload) | 554,6 KB (112,6 KB gzip) |
| `client-*.js` (Freighter, lazy) | 67,5 KB (16,8 KB gzip) |
| `index-*.css` | 29,7 KB (6,8 KB gzip) |
| Font | Inter dari Google Fonts, 5 bobot terpakai (400–800), dimuat via `@import` |
| Gambar agen | 11 × 380–805 KB (JPEG 1024², berlabel `.png`); total ±5,8 MB |
| Gambar tak terpakai di `dist/` | 3 × `avatar_*.png` ±2,8 MB |
| Transfer Home (terukur) | ±1,9 MB, 1,7 MB di antaranya gambar |

---

## 9. Arah desain yang diusulkan (opini; tidak ada yang dibangun)

**Siapa dan untuk apa.** Dua pengguna, dua tugas:
- **klien**: memilih agen, mengunci XLM dengan tenggat, lalu menyetujui, me-refund, atau memeriksa file terhadap hash;
- **pemilik agen**: mendaftar, melihat job masuk, mengirim hash, mencairkan dana setelah 72 jam.

Dua hal yang mereka butuhkan: tahu **di tahap mana uang berada** dan **berapa lama lagi**. Dunia produknya adalah escrow, ledger, tenggat, segel dan sidik jari (hash), bukan robot.

**Yang dihapus/disederhanakan di ketiga arah:** robot 3D, 3 blob dan grid "scanner", glass/blur pada kartu, gradien di judul dan garis, glow hover, bar aksen kiri, eyebrow kapital, titik terminal, gambar sampel bergaya AI-art di kartu (paling tidak di kartu; boleh tetap di detail berlabel Sample), sisa warna biru template, halaman Developer sebagai halaman terpisah.

### Arah A — "Escrow receipt" (kertas & tinta)

- **Rasa:** tenang, akuntabel, seperti kuitansi notaris.
- **Elemen khas:** setiap job digambarkan sebagai *kuitansi* bertahap. Satu garis waktu horizontal Pending → Delivered → 72 h window → Completed/Refunded, dengan jam tenggat sebagai angka mono besar ("31 h 12 m left").
- **Warna dari dunianya:** latar kertas hangat (off-white), teks tinta hampir hitam, satu aksen "segel" (merah bata/oksida) hanya untuk aksi kunci dan lepas dana. Status pakai semantik redup.
- **Tipe:** serif editorial untuk judul + sans rapi untuk body + mono untuk jumlah/hash/alamat.
- **Kedalaman:** border hairline saja.
- **Risiko:** meninggalkan palet forest/teal yang sudah dipilih Umem.

### Arah B — "Forest ledger" (mempertahankan palet Umem, diratakan) — *rekomendasi*

- **Rasa:** presisi, teknis, jujur; konsol operator yang tenang, bukan sci-fi.
- **Elemen khas:** "hash chip" dan "deadline meter". Hash 64-hex ditampilkan dalam blok mono 4×16 yang bisa dibandingkan sekilas (dipakai di Deliver, Verify, kartu job). Meter tenggat/72 jam berupa bar tipis satu warna di setiap kartu job, menggantikan progress bar tiga warna.
- **Warna:** forest `#171d1b`/`#2C3531` sebagai tiga tingkat permukaan (kedalaman lewat lightness, tanpa blur/shadow), mint untuk teks. Teal satu-satunya aksen: isian tombol dengan teks mint (5,4:1), versi terang untuk tautan (`#5cb8b2`). Peach **khusus** untuk Sample/Simulated, sehingga warna itu berarti "bukan nyata". Sand untuk pending/bintang.
- **Tipe:** display bersifat grotesk/mono-ish yang khas (bukan Inter) + body sans + mono untuk data.
- **Home:** hero pendek tanpa grafik dekoratif, langsung menunjukkan satu kartu job contoh berlabel "Sample" sebagai ilustrasi alur. "How it works" menjadi satu diagram alur status kontrak.
- **Alasan rekomendasi:** paling sedikit merombak, mempertahankan pilihan warna Umem, dan memperbaiki P0/P1 secara alami.

### Arah C — "Public registry" (direktori sipil)

- **Rasa:** netral, dapat diperiksa, seperti register publik.
- **Elemen khas:** Marketplace sebagai **tabel registry** (nama, harga XLM, job selesai, jumlah rating, owner, ditambah kolom "source": contract / UI-only), bukan grid kartu bergambar. Field yang berasal dari kontrak diberi penanda kecil ("on contract"), metadata UI-only tampil redup.
- **Warna:** mode terang atau gelap netral; satu aksen; Sample berupa baris dengan pola garis.
- **Tipe:** sans netral berkarakter + mono.
- **Risiko:** kurang "menjual" untuk demo bootcamp; paling cocok jika tujuan utamanya kejujuran dan keterbacaan data.

---

## 10. Pertanyaan terbuka untuk Umem

1. Palet forest/teal/sand/peach/mint ditandai "exact user choices" di `index.css:6`. Apakah palet ini dikunci (arah B), atau boleh diganti (A/C)?
2. Robot 3D tercantum di README sebagai fitur ("Interactive 3D canvas ✅ Real"). Boleh dihapus atau diganti gambar statis?
3. Gambar sampel AI-art: tetap di kartu, hanya di detail, atau dihapus? Jika tetap, siapa yang mengekspor ulang ke ukuran kecil (perubahan aset, tanpa dependensi baru)?
4. Banner: ganti "Real on Stellar Testnet" menjadi "Implemented on Testnet, manual Freighter test pending" sampai checklist `docs/deploy.md` §9/§10 lulus?
5. Navigasi mobile: menu `<details>`, tab bawah, atau tab yang bisa di-scroll horizontal?
6. Gabungkan halaman Developer ke Agent Dashboard?
7. Deskripsi sampel on-chain ("instantly", "real-time", "10+ languages"): seed ulang (= transaksi Testnet, butuh izin eksplisit) atau cukup penanda di UI?
8. Perlu mode terang?
9. Boleh memuat satu font display tambahan dari Google Fonts (bukan dependensi npm)?

---

## 11. Urutan fase yang diusulkan

**Fase 4a — perbaikan tanpa ganti arah visual (P0 + P1 aksesibilitas)**
- U01 nav mobile + canvas/latar tidak memperlebar dokumen.
- U02/U06 kontras lewat token (`--accent-text`, teks mint di tombol, `--text-dim` ≥ 62 %).
- U03/U17 kartu dan logo jadi elemen fokus; `aria-current`, `aria-expanded`.
- U04 satu komponen `Modal` berbasis `<dialog>` untuk 5 modal + drawer.
- U05 `:focus-visible` global, border input ≥ 3:1.
- U07/U19 reduced motion, latar statis, canvas dijeda di luar layar.
- U08 area sentuh ≥ 40 px.
- U14/U22 gambar dikecilkan dan diberi ekstensi benar, `loading="lazy"`; hapus aset/CSS mati.
- U16/U24/U26/U28 perbaikan teks (dengan persetujuan #4).
- Cek ulang: screenshot 320–1440, rasio kontras, uji Tab/Escape, honesty gate.

**Fase 4b — token dan komponen (tanpa arah baru)**
- Tulis `docs/design-system.md` + blok token di `index.css`: warna peran, skala tipe, spasi, radius, satu strategi kedalaman.
- Hapus glass, blob, gradien, bar kiri, titik terminal, sisa biru (U09–U13).
- Ekstrak `StatCard`, `JobCard`, `KeyValueList`, `EmptyState`, `ConnectPrompt`, `AgentCard` tunggal; pindahkan `style={{}}` inline ke kelas (U20/U21).

**Fase 4c — arah visual terpilih**
- Setelah Umem memilih A/B/C: pasangan font, elemen khas (deadline meter / hash chip / tabel registry), Home ditulis ulang, Developer digabung.
- Screenshot README diperbarui dengan tangkapan nyata.
- Lalu uji tanda tangan desain: cek elemen khas di lima tempat, squint test dan token test.

---

## 12. Status Fase 4a (2026-10-30)

Commit `72d2c7e`…`d23914e`. Diukur ulang dengan skrip Playwright yang sama (Chromium 1243, `vite preview`, registry Testnet langsung). Screenshot sesudah: `ui-shots/after/` (home, marketplace, detail, modal Hire di 320/375/414/768/1440, plus `nav-menu-open-375.jpg` dan `focus-ring-card-1440.jpg`).

| Cek | Sebelum | Sesudah |
|---|---|---|
| Lebar dokumen di 320/375/414 | 711 px | = viewport (juga 768, 900, 1440) |
| Connect Wallet di layar (320) | x 603–711 | x 126–256 |
| Kartu agen dicapai lewat Tab | 0 dari 15 | ya, Enter membuka detail |
| Modal Hire: aria-modal, fokus di dalam, trap, Escape, fokus kembali | tidak ada | semua ya, di 5 lebar |
| Tombol primer / teks teal / `--text-dim` di modal | 2,86 / 2,47 / 3,32 | 5,38 / 7,29 / 4,93 |
| Ring fokus input / border input | 1,02 / 1,23 | 5,13 / 3,21 |
| Animasi berjalan saat `reduce` | 4 + canvas | 0, canvas diam |
| Transfer Marketplace / Home | 5.990 / 1.912 KB | 520 / 299 KB |

**Selesai:** P0 U01, U02, U03. P1 U04, U05, U06, U07, U08, U14, U16, U17, U18, U19 (bagian canvas: dijeda di luar layar). Juga U25 (deskripsi sampel, atas permintaan; deskripsi on-chain tidak berubah, lihat `docs/deploy.md` §7) dan bagian avatar dari U22.

**Sengaja ditunda ke 4c (bergantung arah visual):** U09 glass/kedalaman, U10 gradien judul, U11 bar aksen kiri, U12 titik terminal, U13 aksen ganda, U15 gambar sampel cacat (ganti/hapus gambar = keputusan arah), U19 latar blob statis. P2 lain (U26 "Read live", U28 judul dokumen, U29 bintang kosong, dll.) belum disentuh.

Belum terukur: modal yang butuh wallet (Rate, Verify, Deliver, Refund, Playground, TxProgress) memakai komponen/hook yang sama dengan Hire, tetapi hanya ditinjau dari kode.

---

*Aturan standar yang diterapkan: token terkunci, gerbang anti-slop, kejujuran konten, state, aksesibilitas, lantai responsif 320/375/414/768. Yang sengaja tidak diterapkan: self-critique 1–5 per arah (arah belum dibangun), uji Flutter (tidak relevan). Label "opini" menandai penilaian estetika.*

## 13. Status Fase 4b + 4c (2026-11-01)

Commit `ac01782` (4b token & komponen), `2b4098f` (4c visual & Home), plus commit dokumen ini. Arah B "Forest ledger". Diukur dengan Playwright (Chromium 1243, `vite preview`, Testnet langsung, tanpa wallet). Screenshot: `ui-shots/after-4c/` (Home, Marketplace, detail agen, Agent Dashboard tanpa wallet, masing-masing 375 dan 1440) dan `ui-shots/font-specimen.jpg`. Aturan token: [`docs/design-system.md`](../design-system.md).

| Cek | Sebelum (4a, `850cb58`) | Sesudah |
|---|---|---|
| Token warna | 19 hex + ±50 `rgba()` tersebar, nama `--blue/--lavender/--rose` | 19 token peran di `:root`; 0 hex dan 0 `rgba()` di luar `:root` |
| Ukuran font / spasi di luar skala / radius | 16 ukuran / ±53 % / 10 nilai | 7 token (12–40, rasio ±1,25) / 0 / 3 (6, 10, 16) |
| Strategi kedalaman | border + shadow + blur (12 tempat) + pseudo-border gradien | permukaan lebih terang + border 1 px; 0 `box-shadow`, 0 `backdrop-filter`, 0 gradien |
| `style={{}}` inline di JSX | 126 | 1 (variabel CSS dinamis `--share` di DeadlineMeter) |
| Kontras pasangan teks terendah | 4,93:1 (`--text-dim` di modal) | 4,60:1 (`--accent-text` di `surface-3`); semua 35 pasangan teks ≥ 4,5, kontrol ≥ 3 (skrip) |
| CSS build | 32,21 kB (7,32 kB gzip) | 29,37 kB (5,82 kB gzip) |
| JS utama | 294,01 kB (89,06 kB gzip) | 290,36 kB (89,40 kB gzip); chunk SDK tidak berubah |
| `dist/` total | 1.314 KB (11 gambar WebP) | 954 KB (0 gambar) |
| Overflow horizontal 320/375/414/768/1440 | 0 | 0 di Home, Marketplace, My Jobs, Agent Dashboard, detail |
| Kontrol < 40 px | 0 | 0 (5 lebar, 5 layar) |
| Escape menu / kartu via Tab+Enter / animasi jalan saat `reduce` | ya / ya / 0 | ya / ya / 0; timeline tanpa autoplay dan mulai lengkap |

Dependensi: tidak ada yang ditambah atau dihapus. Robot "3D" ternyata canvas buatan tangan tanpa pustaka, jadi tidak ada pustaka 3D untuk dihapus; selisih bundle di atas berasal dari penghapusan kodenya.

**Selesai:** U09–U13 (glass, gradien, bar kiri, titik terminal, aksen ganda), U15/U38 (gambar AI dan robot dihapus, diganti glyph alamat dan Escrow timeline), U19 (latar statis), U20–U23 (skala, inline style, CSS/aset mati, font display via `<link>`), U24 (glosarium: "Connect Freighter", "Outside Agero"), U26 ("Read live" → dibaca sekali saat halaman dimuat), U27 (penanda "on contract" dan kategori dashed), U28 (judul dokumen), U29 (satu token bintang, "No ratings yet"), U31 (Developer → bagian CLI di Agent Dashboard; id lama `developer` dialihkan ke `agent`), U32 (toast error `role="alert"`, tetap sampai ditutup), U33 (angka lama dipertahankan saat refresh), U34 (tombol mengecil saat ditekan), U36/U37. Gate ditambah 4 frasa.

**Uji standar.**
- *Tanda tangan* (≥ 5 tempat): HashChip di kartu job My Jobs, kartu job Agent Dashboard, Verify, Deliver, hero; DeadlineMeter di dua daftar job, ringkasan Hire, hero; glyph di kartu, detail, dashboard.
- *Squint* (opini, dari `home-1440.jpg`): yang menonjol berurutan judul hero, tombol teal, chip 120 XLM, hash tersegel; peach hanya muncul pada label Sample/Illustration.
- *Token:* nama mengikuti peran produk (`sample`, `pending`, `brand`, `surface-n`), bukan nama warna.
- *Penilaian diri 1–5 (opini):* filosofi 4, hierarki 4, eksekusi 3, spesifisitas 4, restraint 4, variasi 3. Tidak ada yang < 3. Eksekusi 3 karena layar ber-wallet belum dilihat di browser; variasi 3 karena Home masih berupa tumpukan kartu berbobot sama di bawah hero.

**Dilanggar dengan sengaja.**
- Token ditulis dalam hex, bukan OKLCH: palet dikunci pada hex pilihan Umem dan skrip kontras membaca hex.
- Warna error dinaikkan dari `#e28c8c` ke `#e89898` (warna semantik, bukan bagian palet bernama) agar lolos 4,5:1 di `surface-3`. Permukaan `surface-1`/`surface-3`, `brand-hover` dan `fg-dim` adalah turunan lightness dari palet.
- Body memuat 3 bobot Inter (400/500/600); semuanya dipakai.
- Label edge `refund_job · agent` di diagram dipindah setelah screenshot diambil (batas 8 screenshot), jadi `home-*.jpg` sedikit berbeda dari build akhir di bagian itu.
- `fetchPulse` ditambahkan di `chain/rpc.js`: hanya baca (`agent_count`, `job_count`, `getTransaction` palsu untuk nomor ledger), tidak menyentuh pipeline tanda tangan.

**Belum diuji di browser (butuh wallet):**
1. Kartu job nyata di My Jobs / Agent Dashboard: DeadlineMeter berjalan dari waktu ledger dan HashChip tersegel pada job Delivered.
2. Modal Deliver dan Verify: HashChip hasil hitung lokal, tombol salin (izin clipboard) dan vonis cocok/tidak.
3. Ringkasan Hire dengan meter tenggat, drawer TxProgress, dan glyph alamat sendiri di kartu "Your agent".

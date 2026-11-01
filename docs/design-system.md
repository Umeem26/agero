# Agero design system: "Forest ledger"

Sumber kebenaran untuk token ada di blok `:root` di `frontend/src/index.css`. Dokumen ini mencatat
aturan pemakaian dan alasannya. Arah desain: B "Forest ledger" (`docs/audit/agero-ui-audit.md` §9).

**Rasa:** konsol operator yang tenang dan presisi, bukan sci-fi. Dunia produknya escrow, ledger,
tenggat, segel dan sidik jari (hash). Pengguna perlu tahu dua hal: **di tahap mana uangnya** dan
**berapa lama lagi**.

## Warna (palet dikunci)

Nama token mengikuti **peran**, bukan nama warna. Kontras diperiksa dengan skrip (WCAG 2.x) untuk
setiap pasangan teks × permukaan; angka di bawah adalah nilai terendah di antara `bg`,
`surface-0..3`.

| Token | Nilai | Peran dan aturan | Kontras terendah |
|---|---|---|---|
| `--bg` | `#171d1b` | Latar halaman | – |
| `--surface-0` | `#0d1210` | Cekung: input, kode, hash, konsol | – |
| `--surface-1` | `#1f2724` | Kartu, banner | – |
| `--surface-2` | `#2c3531` | Forest: hover, blok bersarang di kartu, jalur meter | – |
| `--surface-3` | `#333d39` | Modal, drawer, dropdown, toast | – |
| `--border` | `#3b4843` | Hairline 1 px dekoratif | – |
| `--border-strong` | `#7c8f89` | Garis kontrol (input, tombol outline) | 3,29:1 (non-teks ≥ 3) |
| `--fg` | `#d1e8e2` | Teks utama (mint) | 8,39:1 |
| `--fg-dim` | `#a3b7b1` | Teks sekunder, termasuk paragraf | 5,12:1 |
| `--brand` | `#116466` | Teal, **satu-satunya aksen**: isian tombol primer, filter aktif, kotak logo | – |
| `--brand-hover` | `#146f71` | Hover tombol primer | – |
| `--brand-fg` | `#d1e8e2` | Teks di atas `--brand` | 5,38:1 (hover 4,62) |
| `--accent-text` | `#5cb8b2` | Teal sebagai teks: tautan, penanda "on contract", ring fokus | 4,60:1 |
| `--sample` | `#ffcb9a` | Peach: **khusus** Sample / Simulated / ilustrasi | 7,32:1 |
| `--pending` | `#d9b08c` | Sand: menunggu, tenggat, meter, bintang | 5,41:1 |
| `--ok` / `--error` | `#8dd9a6` / `#e89898` | Status selesai / gagal | 6,47 / 4,61:1 |
| `--scrim` | `rgba(8,11,10,.72)` | Hanya latar modal | – |

Aturan:
- **Satu aksen.** Teal untuk aksi dan tautan. Komposisi kira-kira 60 % permukaan forest, 30 % teks
  mint, 10 % teal.
- **Peach berarti "bukan nyata".** Hanya badge Sample, catatan Sample, tombol `[sim]`, log `[sim]`,
 . Tidak boleh dipakai untuk penekanan atau dekorasi.
- **Garis putus-putus = bukan dari kontrak.** Badge kategori (metadata UI-only), filter kategori,
  tombol simulasi dan catatan Sample memakai border dashed; data kontrak memakai garis solid.
- Sand untuk semua yang sedang menunggu waktu (badge Pending, meter, bintang). Bintang memakai satu
  token, dan agen tanpa rating menampilkan teks "No ratings yet", bukan bintang kosong.
- Error `#e28c8c` dari palet lama dinaikkan sedikit ke `#e89898` agar lolos 4,5:1 di `surface-3`.
- Tidak ada warna biru, gradien, glow, atau glass.

**Pelanggaran sengaja:** standar Umem meminta OKLCH di web. Token ditulis dalam hex karena palet
dikunci pada nilai hex yang dipilih Umem dan skrip kontras membaca hex dari `:root`. Tingkat
permukaan diturunkan dengan menaikkan lightness pada hue forest yang sama.

## Tipografi

| Peran | Font | Bobot dimuat | Pemakaian |
|---|---|---|---|
| Display | IBM Plex Sans Condensed (Google Fonts, `display=swap`) | 500, 600 | Judul, angka (harga, jumlah XLM, sisa waktu, stat) |
| Body | Inter | 400, 500, 600 | Paragraf, label, tombol |
| Mono | `ui-monospace, Menlo, Consolas, monospace` | sistem, tidak dimuat | Hash, alamat, perintah CLI, konsol |

Alasan pemilihan display (uji tukar; specimen di `docs/audit/ui-shots/font-specimen.jpg`, kandidat
Archivo lebar, Chivo, IBM Plex Sans Condensed, Familjen Grotesk):
- Angka tabular yang sempit: `1,240.5000000 XLM` dan `Ledger 1,048,576` tetap satu baris; Archivo
  (lebar 112) membungkus baris yang sama.
- Berkarakter teknis/ledger tanpa terasa sci-fi; Chivo terlalu mirip grotesk generik sehingga
  hampir tidak mengubah apa pun dibanding Inter (gagal uji tukar).
- Bentuk condensed memberi hierarki dari lebar, bukan hanya ukuran, sehingga judul 32–40 px tetap
  muat di 320 px.

Skala (rasio ±1,25 dari 16): `--text-xs` 12, `--text-sm` 14, `--text-md` 16, `--text-lg` 20,
`--text-xl` 24, `--text-2xl` 32, `--text-3xl` 40. Line-height 1,15 untuk judul, 1,6 untuk teks.
Judul tegak, tanpa eyebrow kapital, tanpa gradien.

## Spasi, radius, kedalaman, gerak

- **Spasi:** `--s-1..6` = 4/8/12/16/24/32; `--s-7` 48 dan `--s-8` 64 hanya untuk jarak antar seksi.
- **Radius:** `--r-sm` 6 (kontrol, badge, hash, input), `--r-md` 10 (kartu, toast, dropdown),
  `--r-lg` 16 (modal). Elemen bersarang turun satu tingkat.
- **Kedalaman: satu strategi.** Permukaan lebih terang + border 1 px. Tidak ada `box-shadow`,
  `backdrop-filter`, blur atau glow. Satu-satunya lapisan transparan adalah `--scrim` modal.
- **Gerak:** hanya `transform`/`opacity`, `--dur` 200 ms dan `--dur-slow` 300 ms. Tombol mengecil
  ke 0,98 saat ditekan. Saat `prefers-reduced-motion: reduce` semua transisi dan animasi
  dimatikan; spinner tetap berputar pelan sebagai satu-satunya isyarat loading.
- **Area sentuh** minimal `--control-h` 40 px untuk semua kontrol.

## Komponen khas

- **HashChip** (`components/HashChip.jsx`): hash 64-hex dalam blok mono 4 × 16 karakter, dikelompokkan
  per 4, dengan tombol salin. Varian `sealed` (border teal + ikon gembok) untuk hash yang sudah
  tercatat di kontrak. Dipakai di Deliver, Verify dan kartu job.
- **DeadlineMeter** (`components/DeadlineMeter.jsx`): bar tipis satu warna (sand) + teks sisa waktu
  ("31 h 12 m left") dari waktu ledger. Teks membawa informasinya; bar `aria-hidden`. Dipakai di
  kartu job (tenggat saat Pending, masa tinjau 72 jam saat Delivered), dan ringkasan Hire.
- **StatCard, KeyValueList, EmptyState, ConnectPrompt, AgentCard, JobCard** di `components/`.
- **Penanda sumber data:** `ContractMark` ("on contract", mono teal) untuk nilai yang dibaca dari
  kontrak; badge kategori dashed dan redup untuk metadata yang hanya ada di frontend.

## Larangan (gerbang anti-slop)

Gradien dekoratif, glass/blur, glow, bar aksen kiri, eyebrow kapital, chrome terminal/ponsel gambar
tangan, emoji sebagai ikon, gambar dekoratif tanpa makna, lebih dari satu aksen, angka/testimoni/logo
karangan, nilai spasi di luar skala.

# Kontrak Agero v2

Sumber: [`contracts/agero-contract/src/lib.rs`](../contracts/agero-contract/src/lib.rs). Tes: [`src/test.rs`](../contracts/agero-contract/src/test.rs) + [`src/test/`](../contracts/agero-contract/src/test/).

Status: kode dan tes selesai (59/59 tes lulus). **Belum di-deploy.** Deploy dilakukan manual mengikuti [deploy.md](deploy.md). Frontend belum memanggil kontrak ini. Kontrak v1 (`CBEIINKJ…BW5X`) tetap ada di testnet dan dianggap deprecated.

Keputusan desain (Umem, Fase 2):
- Tanpa arbiter. Setelah agen deliver, klien punya 72 jam untuk `complete_job`; sesudahnya siapa saja boleh `release_job`.
- Token escrow = XLM native (Stellar Asset Contract), di-set sekali di `__constructor` untuk seluruh kontrak.
- Klien memilih tenggat saat `create_job` dalam batas 1 jam sampai 30 hari.

## Konstanta

Semua di bagian atas `lib.rs`. Waktu dalam detik terhadap `env.ledger().timestamp()`, TTL dalam jumlah ledger (~5 detik/ledger, 17.280 ledger/hari).

| Konstanta | Nilai | Arti |
|---|---|---|
| `MIN_DURATION_SECS` | 3.600 (1 jam) | Tenggat minimum `create_job` |
| `MAX_DURATION_SECS` | 2.592.000 (30 hari) | Tenggat maksimum `create_job` |
| `REVIEW_WINDOW_SECS` | 259.200 (72 jam) | Masa tinjau setelah deliver sebelum `release_job` boleh dipanggil |
| `INSTANCE_TTL_THRESHOLD` / `INSTANCE_TTL_EXTEND_TO` | 30 / 60 hari | Instance (token, penghitung) diperpanjang ke 60 hari bila sisa < 30 hari |
| `PERSISTENT_TTL_THRESHOLD` / `PERSISTENT_TTL_EXTEND_TO` | 45 / 60 hari | Agent, AgentAt, Job diperpanjang ke 60 hari bila sisa < 45 hari |

Sisa TTL persistent minimal 45 hari, lebih panjang dari tenggat maksimum + masa tinjau (33 hari). Job yang tidak disentuh sama sekali tetap hidup sampai bisa di-refund atau di-release. TTL diperpanjang di setiap tulis dan di setiap baca lewat getter.

Satuan uang: `amount` dan `price` bertipe `i128` dalam stroop (1 XLM = 10.000.000 stroop).

## Status job

```
            deliver_job (agen)            complete_job (klien)
 Pending ───────────────────► Delivered ─────────────────────► Completed
    │                             │      release_job (siapa saja,
    │                             │      >= delivered_at + 72 jam) ──► Completed
    │ refund_job                  │ refund_job
    │ (klien: now > deadline)     │ (agen saja)
    │ (agen: kapan saja)          │
    ▼                             ▼
 Refunded                      Refunded
```

### Tabel transisi

| Fungsi | Siapa (auth) | Dari status | Kondisi | Efek | Error bila gagal |
|---|---|---|---|---|---|
| `create_job` | `client` | (baru) | `client != agent_owner`; `amount > 0`; `amount >= price` agen; `duration_secs` di [1 jam, 30 hari]; agen terdaftar | `deadline = now + duration_secs`; `amount` XLM klien → kontrak; status **Pending** | `SelfDeal`, `InvalidAmount`, `InvalidDuration`, `AgentNotFound`, `AmountBelowPrice` |
| `deliver_job` | pemilik agen job | Pending | Boleh lewat tenggat selama klien belum refund | Simpan `result_hash`, `delivered_at = now`; status **Delivered** | `JobNotFound`, `InvalidState` |
| `complete_job` | klien job | Delivered | - | Status **Completed** disimpan dulu, `total_jobs + 1`, lalu `amount` kontrak → agen | `JobNotFound`, `InvalidState`, `Overflow` |
| `release_job` | siapa saja (tanpa auth) | Delivered | `now >= delivered_at + REVIEW_WINDOW_SECS` | Sama dengan `complete_job` | `JobNotFound`, `InvalidState`, `TooEarly`, `Overflow` |
| `refund_job` (caller = klien) | `caller` | Pending | `now > deadline` | Status **Refunded** disimpan dulu, lalu `amount` kontrak → klien | `TooEarly` (Pending, belum lewat tenggat), `InvalidState` (status lain, termasuk Delivered) |
| `refund_job` (caller = agen) | `caller` | Pending atau Delivered | Kapan saja (pembatalan sukarela) | Sama | `InvalidState` |
| `refund_job` (caller lain) | `caller` | - | - | Ditolak | `Unauthorized` |
| `rate_agent` | `client` | Completed | `client == job.client`; `rating` 1..=5; job belum dirating | `rating_sum += rating`, `rating_count += 1` (checked), `job.rated = true` | `InvalidRating`, `JobNotFound`, `Unauthorized`, `InvalidState`, `AlreadyRated`, `Overflow` |

Completed dan Refunded adalah status akhir; setiap fungsi yang mengubah status menolak keduanya dengan `InvalidState`, sehingga satu job tidak bisa dibayar atau dikembalikan dua kali.

Perlombaan setelah tenggat: bila tenggat lewat dan job masih Pending, `deliver_job` (agen) dan `refund_job` (klien) sama-sama sah. Transaksi yang lebih dulu masuk ledger menang.

### Fungsi agen dan baca

| Fungsi | Parameter (tanpa `env`) | Keterangan |
|---|---|---|
| `__constructor` | `token: Address` | Sekali saat deploy. Simpan token escrow di instance storage |
| `register_agent` | `owner: Address, name: String, description: String, api_url: String, price: i128` | Auth `owner`; `price > 0`; satu agen per alamat (`AlreadyRegistered`) |
| `update_agent` | sama dengan `register_agent` | Auth `owner`; `price > 0`; statistik (`rating_*`, `total_jobs`) tidak berubah |
| `get_agent` | `id: Address` → `Option<Agent>` | |
| `get_job` | `job_id: u64` → `Option<Job>` | |
| `job_count` | → `u64` | ID job terakhir (ID mulai dari 1) |
| `agent_count` | → `u32` | Jumlah agen terdaftar |
| `agent_at` | `index: u32` → `Address` | Indeks 0-based urutan pendaftaran; `AgentNotFound` bila di luar jangkauan |

## Kode error

| Kode | Nama | Kode | Nama |
|---|---|---|---|
| 1 | `AgentNotFound` | 8 | `AmountBelowPrice` |
| 2 | `JobNotFound` | 9 | `InvalidDuration` |
| 3 | `AlreadyRegistered` | 10 | `InvalidState` |
| 4 | `Unauthorized` | 11 | `TooEarly` |
| 5 | `SelfDeal` | 12 | `InvalidRating` |
| 6 | `InvalidPrice` | 13 | `AlreadyRated` |
| 7 | `InvalidAmount` | 14 | `Overflow` |

Kegagalan `require_auth` bukan kode di atas, melainkan error host `Error(Auth, InvalidAction)`.

## Event

Dibuat dengan `#[contractevent]`. Topic = `(nama_event, id)`, data berupa map.

| Fungsi | Nama event (topic 0) | Topic 1 | Data |
|---|---|---|---|
| `register_agent` | `agent_registered` | `owner: Address` | `price` |
| `update_agent` | `agent_updated` | `owner: Address` | `price` |
| `create_job` | `job_created` | `job_id: u64` | `client`, `agent`, `amount`, `deadline` |
| `deliver_job` | `job_delivered` | `job_id: u64` | `result_hash` |
| `complete_job` | `job_completed` | `job_id: u64` | `amount` |
| `release_job` | `job_released` | `job_id: u64` | `amount` |
| `refund_job` | `job_refunded` | `job_id: u64` | `by`, `amount` |
| `rate_agent` | `agent_rated` | `agent: Address` | `job_id`, `rating` |

Transfer XLM juga menerbitkan event `transfer` milik SAC (bukan milik kontrak ini).

## Batasan

- **Tanpa arbiter atau dispute.** Klien yang tidak puas dengan hasil hanya bisa meminta agen me-refund secara sukarela. Bila agen tidak melakukannya, dana dilepas ke agen setelah 72 jam. Kontrak tidak menilai isi hasil kerja; `result_hash` hanya komitmen 32 byte dari agen.
- **Satu agen per alamat.** Key penyimpanan adalah `Agent(owner)`.
- **Reputasi masih bisa dimanipulasi dengan dua wallet.** Self-deal dengan alamat yang sama ditolak, tetapi orang yang mengendalikan dua alamat bisa membuat job, menyelesaikannya, dan memberi rating; biayanya hanya fee karena XLM kembali ke dirinya sendiri.
- **Token tidak divalidasi di kontrak.** `__constructor` menyimpan alamat apa pun yang diberikan. Skrip deploy menurunkan alamat SAC XLM native lewat `stellar contract id asset --asset native`.
- **Agen tidak bisa dihapus**, dan harga hanya bisa diubah lewat `update_agent` (berlaku untuk job berikutnya).
- **Belum diaudit pihak ketiga. Testnet saja.**

## Pemetaan temuan audit → tes

Temuan dari [audit 2026-10-25](audit/agero-audit.md). Nama tes relatif ke `contracts/agero-contract/src/test/`.

| Temuan | Perbaikan | Tes |
|---|---|---|
| F02 refund klien kapan saja, agen tanpa jaminan bayar | Status Delivered, tenggat, refund klien hanya setelah tenggat tanpa deliver, auto-release 72 jam | `regression::regression_f02_client_cannot_refund_before_deadline_or_after_delivery`, `regression::regression_f02_agent_gets_paid_without_client_action`, `flow::refund_client_rejected_before_and_at_deadline`, `flow::refund_client_rejected_when_delivered`, `flow::refund_client_after_deadline_without_delivery`, `flow::refund_agent_while_pending`, `flow::refund_agent_while_delivered`, `flow::auto_release_rejected_before_review_window`, `flow::auto_release_by_third_party_after_review_window` |
| F04 rating tanpa auth / tanpa job | `client.require_auth`, job Completed milik klien, satu rating per job | `regression::regression_f04_rating_without_auth_rejected`, `regression::regression_f04_rating_spam_without_completed_job_rejected`, `auth::non_client_cannot_rate`, `validation::rating_twice_on_same_job_rejected`, `validation::rating_before_completed_rejected`, `validation::rating_by_non_client_rejected`, `validation::rating_must_be_between_1_and_5` |
| F05 self-deal dan amount 0 | Tolak `client == agent_owner`, `amount <= 0`, `price <= 0` | `regression::regression_f05_self_deal_with_zero_amount_rejected`, `regression::regression_f05_zero_price_agent_rejected`, `validation::create_job_rejects_self_deal`, `validation::create_job_rejects_zero_and_negative_amount`, `validation::register_rejects_zero_and_negative_price` |
| F06 token arbitrer | Token di-set di `__constructor`; parameter token dihapus dari `create_job` | `regression::regression_f06_fake_token_cannot_be_used` |
| F07 tidak ada getter job / enumerasi agen | `get_job`, `job_count`, `agent_count`, `agent_at` | `regression::regression_f07_job_state_readable`, `flow::getters_enumerate_agents_and_jobs` |
| F11 tidak ada `extend_ttl` | Perpanjang instance + entri persistent di tulis/baca | `regression::regression_f11_ttl_extended_on_write_and_read` |
| F12 tidak ada event | Event untuk 8 fungsi mutasi | `events::register_and_update_publish_events`, `events::job_lifecycle_publishes_events`, `events::release_and_refund_publish_events`, `events::failed_calls_publish_no_events`, `events::event_topics_are_name_and_id` |
| F13 error berupa `panic!` string | `#[contracterror] enum Error`, semua fungsi mutasi mengembalikan `Result` | `regression::regression_f13_errors_are_typed_contract_codes` (plus setiap tes yang memakai `assert_contract_error`) |
| F14 overflow `rating_sum` | `rating_sum: u64`, `checked_add` di rating dan `total_jobs` → `Overflow` | `regression::regression_f14_rating_overflow_returns_error`, `regression::regression_f14_total_jobs_overflow_reverts_payment` |
| F15 tes tanpa auth negatif, API deprecated | Tes auth memakai `mock_auths` spesifik / `set_auths(&[])`; `register_stellar_asset_contract_v2`; `test_snapshots` lama dihapus dan capture snapshot dimatikan | `auth::*` (8 tes), `test.rs::Setup::new` |

Pemeriksaan tambahan yang dilakukan sekali secara manual (tidak di-commit): menghapus `job.agent.require_auth()` dan `job.client.require_auth()` dari `lib.rs` membuat 4 tes `auth::*` gagal, jadi tes otorisasi benar-benar bergantung pada `require_auth`.

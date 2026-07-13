# Rencana 2: Kontrak Escrow Pekerjaan (Job Escrow)

Dokumen ini berisi draf kode Rust dan unit test untuk Rencana 2 yang dapat Anda salin dan terapkan sendiri di dalam Antigravity IDE.

---

## 1. Menambahkan Struktur Data & Logika ke `lib.rs`

Tambahkan struktur data `Job`, status enum `JobStatus`, serta fungsi `create_job`, `complete_job`, dan `refund_job` ke dalam berkas **[lib.rs](file:///c:/Users/Lenovo/Documents/Project/KelasCoding/RiseIn-Stellar/agero/contracts/agero-contract/src/lib.rs)** Anda.

### A. Tambahkan Import Token SDK
Tambahkan token client di bagian atas file:
```rust
use soroban_sdk::token;
```

### B. Tambahkan Struktur Data Baru
```rust
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum JobStatus {
    Pending = 0,
    Completed = 1,
    Refunded = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Job {
    pub client: Address,
    pub agent: Address,
    pub token: Address, // Token kontrak stablecoin (USDC)
    pub amount: u64,
    pub status: JobStatus,
}

#[contracttype]
pub enum DataKey {
    Agent(Address),
    Job(u64),      // Mapping Job ID -> Job
    JobCount,      // Counter total Job ID
}
```

### C. Tambahkan Fungsi Implementasi di dalam `impl AgeroContract`
```rust
    // Membuat pekerjaan baru dan mengunci dana USDC ke dalam kontrak escrow
    pub fn create_job(env: Env, client: Address, agent_owner: Address, token: Address, amount: u64) -> u64 {
        client.require_auth();

        // Pastikan agen tujuan terdaftar
        let agent_key = DataKey::Agent(agent_owner.clone());
        if !env.storage().persistent().has(&agent_key) {
            panic!("Target AI Agent is not registered");
        }

        // Ambil ID pekerjaan saat ini
        let mut job_count: u64 = env.storage().instance().get(&DataKey::JobCount).unwrap_or(0);
        job_count += 1;
        env.storage().instance().set(&DataKey::JobCount, &job_count);

        // Transfer token USDC dari client ke kontrak Agero ini
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&client, &env.current_contract_address(), &amount);

        let job = Job {
            client: client.clone(),
            agent: agent_owner,
            token,
            amount,
            status: JobStatus::Pending,
        };

        // Simpan data pekerjaan
        env.storage().persistent().set(&DataKey::Job(job_count), &job);

        job_count // Mengembalikan ID pekerjaan yang baru dibuat
    }

    // Menyelesaikan pekerjaan dan mentransfer dana dari escrow ke dompet AI Agent
    pub fn complete_job(env: Env, job_id: u64) {
        let key = DataKey::Job(job_id);
        let mut job: Job = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Job not found"));

        if job.status != JobStatus::Pending {
            panic!("Job is not in pending state");
        }

        // Otorisasi oleh client
        job.client.require_auth();

        // Ubah status pekerjaan
        job.status = JobStatus::Completed;
        env.storage().persistent().set(&key, &job);

        // Transfer dana dari kontrak ini ke pemilik AI Agent
        let token_client = token::Client::new(&env, &job.token);
        token_client.transfer(&env.current_contract_address(), &job.agent, &job.amount);
    }

    // Membatalkan pekerjaan dan mengembalikan dana seutuhnya ke klien
    pub fn refund_job(env: Env, job_id: u64) {
        let key = DataKey::Job(job_id);
        let mut job: Job = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Job not found"));

        if job.status != JobStatus::Pending {
            panic!("Job is not in pending state");
        }

        // Otorisasi oleh pemilik agen (jika agen menyerah/batal) atau client
        // Di sini kita izinkan salah satu pihak menandatangani refund
        if !job.client.has_auth() && !job.agent.has_auth() {
            panic!("Unauthorized: Refund requires client or agent authentication");
        }

        job.status = JobStatus::Refunded;
        env.storage().persistent().set(&key, &job);

        // Kembalikan dana ke klien
        let token_client = token::Client::new(&env, &job.token);
        token_client.transfer(&env.current_contract_address(), &job.client, &job.amount);
    }
```

---

## 2. Menulis Unit Test di `test.rs`

Tambahkan pengujian unit berikut di bagian akhir berkas **[test.rs](file:///c:/Users/Lenovo/Documents/Project/KelasCoding/RiseIn-Stellar/agero/contracts/agero-contract/src/test.rs)** untuk memverifikasi alur kerja kunci dan pencairan dana escrow:

```rust
use soroban_sdk::token;

#[test]
fn test_job_escrow_workflow() {
    let env = Env::default();
    env.mock_all_auths();

    // Register contracts
    let contract_id = env.register(AgeroContract, ());
    let client_contract = AgeroContractClient::new(&env, &contract_id);

    // Setup Mock Token (USDC)
    let token_admin = Address::generate(&env);
    let token_contract_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_client = token::StellarAssetClient::new(&env, &token_contract_id);
    let token_main_client = token::Client::new(&env, &token_contract_id);

    // Setup Addresses
    let client_addr = Address::generate(&env);
    let agent_addr = Address::generate(&env);

    // Mint token untuk Client
    token_client.mint(&client_addr, &1000);
    assert_eq!(token_main_client.balance(&client_addr), 1000);

    // 1. Daftarkan AI Agent terlebih dahulu
    let name = String::from_str(&env, "Image Generator");
    let api_url = String::from_str(&env, "https://api.image.ai");
    client_contract.register_agent(&agent_addr, &name, &api_url, &500);

    // 2. Buat Pekerjaan (Mengunci 500 USDC ke kontrak)
    let job_id = client_contract.create_job(&client_addr, &agent_addr, &token_contract_id, &500);
    
    // Verifikasi saldo setelah lock
    assert_eq!(token_main_client.balance(&client_addr), 500);
    assert_eq!(token_main_client.balance(&contract_id), 500);

    // 3. Selesaikan Pekerjaan (Cairkan dana ke AI Agent)
    client_contract.complete_job(&job_id);

    // Verifikasi saldo akhir
    assert_eq!(token_main_client.balance(&contract_id), 0);
    assert_eq!(token_main_client.balance(&agent_addr), 500);
}
```

### Jalankan Tes
Simpan berkas di IDE Anda dan jalankan perintah:
```bash
cargo test --package agero-contract
```

#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, BytesN,
    Env, String,
};

// ---------------------------------------------------------------------------
// Konstanta waktu dan TTL (satu-satunya tempat; semua fungsi memakai ini)
// ---------------------------------------------------------------------------

/// Waktu dalam detik, dibandingkan dengan `env.ledger().timestamp()`.
pub const HOUR_SECS: u64 = 60 * 60;
pub const DAY_SECS: u64 = 24 * HOUR_SECS;
/// Tenggat minimum yang boleh dipilih klien saat `create_job`.
pub const MIN_DURATION_SECS: u64 = HOUR_SECS;
/// Tenggat maksimum yang boleh dipilih klien saat `create_job`.
pub const MAX_DURATION_SECS: u64 = 30 * DAY_SECS;
/// Masa tinjau klien setelah `deliver_job`; sesudahnya siapa saja boleh `release_job`.
pub const REVIEW_WINDOW_SECS: u64 = 72 * HOUR_SECS;

/// TTL dalam jumlah ledger (~5 detik per ledger, 17_280 ledger per hari).
pub const DAY_IN_LEDGERS: u32 = 17_280;
/// Instance (token, penghitung): diperpanjang ke 60 hari bila sisa TTL < 30 hari.
pub const INSTANCE_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
pub const INSTANCE_TTL_EXTEND_TO: u32 = 60 * DAY_IN_LEDGERS;
/// Entri persistent (Agent, AgentAt, Job): diperpanjang ke 60 hari bila sisa TTL < 45 hari.
/// Sisa minimum 45 hari > MAX_DURATION (30 hari) + REVIEW_WINDOW (3 hari), jadi job yang
/// berjalan tidak ter-arsip walau tidak disentuh sampai tenggat dan masa tinjau habis.
pub const PERSISTENT_TTL_THRESHOLD: u32 = 45 * DAY_IN_LEDGERS;
pub const PERSISTENT_TTL_EXTEND_TO: u32 = 60 * DAY_IN_LEDGERS;

// ---------------------------------------------------------------------------
// Tipe data
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AgentNotFound = 1,
    JobNotFound = 2,
    AlreadyRegistered = 3,
    Unauthorized = 4,
    SelfDeal = 5,
    InvalidPrice = 6,
    InvalidAmount = 7,
    AmountBelowPrice = 8,
    InvalidDuration = 9,
    InvalidState = 10,
    TooEarly = 11,
    InvalidRating = 12,
    AlreadyRated = 13,
    Overflow = 14,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Agent {
    pub owner: Address,
    pub name: String,
    pub description: String,
    pub api_url: String,
    pub price: i128, // stroop token escrow (1 XLM = 10^7)
    pub rating_sum: u64,
    pub rating_count: u32,
    pub total_jobs: u32,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum JobStatus {
    Pending = 0,
    Delivered = 1,
    Completed = 2,
    Refunded = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Job {
    pub client: Address,
    pub agent: Address,
    pub amount: i128,
    pub status: JobStatus,
    pub created_at: u64,
    pub deadline: u64,
    pub delivered_at: Option<u64>,
    pub result_hash: Option<BytesN<32>>,
    pub rated: bool,
}

#[contracttype]
pub enum DataKey {
    Token,          // instance: Address token escrow (SAC XLM), di-set di __constructor
    JobCount,       // instance: u64, ID job terakhir
    AgentCount,     // instance: u32, jumlah agen terdaftar
    Agent(Address), // persistent: profil agen per alamat owner
    AgentAt(u32),   // persistent: indeks 0.. -> alamat owner
    Job(u64),       // persistent: Job ID -> Job
}

// ---------------------------------------------------------------------------
// Event (topic = (nama_event, id), data ringkas)
// ---------------------------------------------------------------------------

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentRegistered {
    #[topic]
    pub owner: Address,
    pub price: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentUpdated {
    #[topic]
    pub owner: Address,
    pub price: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JobCreated {
    #[topic]
    pub job_id: u64,
    pub client: Address,
    pub agent: Address,
    pub amount: i128,
    pub deadline: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JobDelivered {
    #[topic]
    pub job_id: u64,
    pub result_hash: BytesN<32>,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JobCompleted {
    #[topic]
    pub job_id: u64,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JobReleased {
    #[topic]
    pub job_id: u64,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JobRefunded {
    #[topic]
    pub job_id: u64,
    pub by: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentRated {
    #[topic]
    pub agent: Address,
    pub job_id: u64,
    pub rating: u32,
}

// ---------------------------------------------------------------------------
// Helper storage (setiap baca/tulis penting memperpanjang TTL)
// ---------------------------------------------------------------------------

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
}

fn bump_persistent(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND_TO);
}

fn token_client(env: &Env) -> token::Client<'_> {
    let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
    token::Client::new(env, &token)
}

fn load_agent(env: &Env, owner: &Address) -> Result<Agent, Error> {
    let key = DataKey::Agent(owner.clone());
    let agent = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::AgentNotFound)?;
    bump_persistent(env, &key);
    Ok(agent)
}

fn save_agent(env: &Env, agent: &Agent) {
    let key = DataKey::Agent(agent.owner.clone());
    env.storage().persistent().set(&key, agent);
    bump_persistent(env, &key);
}

fn load_job(env: &Env, job_id: u64) -> Result<Job, Error> {
    let key = DataKey::Job(job_id);
    let job = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::JobNotFound)?;
    bump_persistent(env, &key);
    Ok(job)
}

fn save_job(env: &Env, job_id: u64, job: &Job) {
    let key = DataKey::Job(job_id);
    env.storage().persistent().set(&key, job);
    bump_persistent(env, &key);
}

// Bayar agen dan tambah total_jobs. Status sudah Completed dan tersimpan sebelum transfer.
fn pay_agent(env: &Env, job_id: u64, job: &mut Job) -> Result<(), Error> {
    job.status = JobStatus::Completed;
    save_job(env, job_id, job);

    let mut agent = load_agent(env, &job.agent)?;
    agent.total_jobs = agent.total_jobs.checked_add(1).ok_or(Error::Overflow)?;
    save_agent(env, &agent);

    token_client(env).transfer(&env.current_contract_address(), &job.agent, &job.amount);
    Ok(())
}

#[contract]
pub struct AgeroContract;

#[contractimpl]
impl AgeroContract {
    // Dipanggil sekali saat deploy: token escrow (SAC XLM native) dikunci untuk seluruh kontrak
    pub fn __constructor(env: Env, token: Address) {
        env.storage().instance().set(&DataKey::Token, &token);
        bump_instance(&env);
    }

    // Mendaftarkan AI Agent baru (satu agen per alamat owner)
    pub fn register_agent(
        env: Env,
        owner: Address,
        name: String,
        description: String,
        api_url: String,
        price: i128,
    ) -> Result<(), Error> {
        owner.require_auth();
        bump_instance(&env);

        if price <= 0 {
            return Err(Error::InvalidPrice);
        }
        let key = DataKey::Agent(owner.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyRegistered);
        }

        let agent = Agent {
            owner: owner.clone(),
            name,
            description,
            api_url,
            price,
            rating_sum: 0,
            rating_count: 0,
            total_jobs: 0,
        };
        save_agent(&env, &agent);

        // Catat di indeks enumerasi
        let index: u32 = env
            .storage()
            .instance()
            .get(&DataKey::AgentCount)
            .unwrap_or(0);
        let index_key = DataKey::AgentAt(index);
        env.storage().persistent().set(&index_key, &owner);
        bump_persistent(&env, &index_key);
        let count = index.checked_add(1).ok_or(Error::Overflow)?;
        env.storage().instance().set(&DataKey::AgentCount, &count);

        AgentRegistered { owner, price }.publish(&env);
        Ok(())
    }

    // Memperbarui profil AI Agent oleh owner
    pub fn update_agent(
        env: Env,
        owner: Address,
        name: String,
        description: String,
        api_url: String,
        price: i128,
    ) -> Result<(), Error> {
        owner.require_auth();
        bump_instance(&env);

        if price <= 0 {
            return Err(Error::InvalidPrice);
        }
        let mut agent = load_agent(&env, &owner)?;
        agent.name = name;
        agent.description = description;
        agent.api_url = api_url;
        agent.price = price;
        save_agent(&env, &agent);

        AgentUpdated { owner, price }.publish(&env);
        Ok(())
    }

    // Membuat job dan mengunci `amount` token escrow; tenggat = sekarang + duration_secs
    pub fn create_job(
        env: Env,
        client: Address,
        agent_owner: Address,
        amount: i128,
        duration_secs: u64,
    ) -> Result<u64, Error> {
        client.require_auth();
        bump_instance(&env);

        if client == agent_owner {
            return Err(Error::SelfDeal);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if !(MIN_DURATION_SECS..=MAX_DURATION_SECS).contains(&duration_secs) {
            return Err(Error::InvalidDuration);
        }
        let agent = load_agent(&env, &agent_owner)?;
        if amount < agent.price {
            return Err(Error::AmountBelowPrice);
        }

        let now = env.ledger().timestamp();
        let deadline = now.checked_add(duration_secs).ok_or(Error::Overflow)?;

        let job_id: u64 = env
            .storage()
            .instance()
            .get::<_, u64>(&DataKey::JobCount)
            .unwrap_or(0)
            .checked_add(1)
            .ok_or(Error::Overflow)?;
        env.storage().instance().set(&DataKey::JobCount, &job_id);

        let job = Job {
            client: client.clone(),
            agent: agent_owner.clone(),
            amount,
            status: JobStatus::Pending,
            created_at: now,
            deadline,
            delivered_at: None,
            result_hash: None,
            rated: false,
        };
        save_job(&env, job_id, &job);

        token_client(&env).transfer(&client, &env.current_contract_address(), &amount);

        JobCreated {
            job_id,
            client,
            agent: agent_owner,
            amount,
            deadline,
        }
        .publish(&env);
        Ok(job_id)
    }

    // Agen menyerahkan hasil (hash dari output). Boleh melewati tenggat selama klien belum refund
    pub fn deliver_job(env: Env, job_id: u64, result_hash: BytesN<32>) -> Result<(), Error> {
        bump_instance(&env);
        let mut job = load_job(&env, job_id)?;
        job.agent.require_auth();

        if job.status != JobStatus::Pending {
            return Err(Error::InvalidState);
        }
        job.status = JobStatus::Delivered;
        job.delivered_at = Some(env.ledger().timestamp());
        job.result_hash = Some(result_hash.clone());
        save_job(&env, job_id, &job);

        JobDelivered {
            job_id,
            result_hash,
        }
        .publish(&env);
        Ok(())
    }

    // Klien menerima hasil: dana dilepas ke agen
    pub fn complete_job(env: Env, job_id: u64) -> Result<(), Error> {
        bump_instance(&env);
        let mut job = load_job(&env, job_id)?;
        job.client.require_auth();

        if job.status != JobStatus::Delivered {
            return Err(Error::InvalidState);
        }
        pay_agent(&env, job_id, &mut job)?;

        JobCompleted {
            job_id,
            amount: job.amount,
        }
        .publish(&env);
        Ok(())
    }

    // Auto-release: siapa saja boleh memanggil setelah REVIEW_WINDOW_SECS sejak deliver
    pub fn release_job(env: Env, job_id: u64) -> Result<(), Error> {
        bump_instance(&env);
        let mut job = load_job(&env, job_id)?;

        if job.status != JobStatus::Delivered {
            return Err(Error::InvalidState);
        }
        let delivered_at = job.delivered_at.ok_or(Error::InvalidState)?;
        let release_at = delivered_at
            .checked_add(REVIEW_WINDOW_SECS)
            .ok_or(Error::Overflow)?;
        if env.ledger().timestamp() < release_at {
            return Err(Error::TooEarly);
        }
        pay_agent(&env, job_id, &mut job)?;

        JobReleased {
            job_id,
            amount: job.amount,
        }
        .publish(&env);
        Ok(())
    }

    // Mengembalikan dana ke klien.
    // Klien: hanya saat Pending dan tenggat sudah lewat. Agen: Pending atau Delivered kapan saja.
    pub fn refund_job(env: Env, job_id: u64, caller: Address) -> Result<(), Error> {
        caller.require_auth();
        bump_instance(&env);
        let mut job = load_job(&env, job_id)?;

        if caller == job.client {
            if job.status != JobStatus::Pending {
                return Err(Error::InvalidState);
            }
            if env.ledger().timestamp() <= job.deadline {
                return Err(Error::TooEarly);
            }
        } else if caller == job.agent {
            if job.status != JobStatus::Pending && job.status != JobStatus::Delivered {
                return Err(Error::InvalidState);
            }
        } else {
            return Err(Error::Unauthorized);
        }

        job.status = JobStatus::Refunded;
        save_job(&env, job_id, &job);

        token_client(&env).transfer(&env.current_contract_address(), &job.client, &job.amount);

        JobRefunded {
            job_id,
            by: caller,
            amount: job.amount,
        }
        .publish(&env);
        Ok(())
    }

    // Rating 1-5 oleh klien untuk job Completed miliknya; satu rating per job
    pub fn rate_agent(env: Env, client: Address, job_id: u64, rating: u32) -> Result<(), Error> {
        client.require_auth();
        bump_instance(&env);

        if !(1..=5).contains(&rating) {
            return Err(Error::InvalidRating);
        }
        let mut job = load_job(&env, job_id)?;
        if job.client != client {
            return Err(Error::Unauthorized);
        }
        if job.status != JobStatus::Completed {
            return Err(Error::InvalidState);
        }
        if job.rated {
            return Err(Error::AlreadyRated);
        }

        let mut agent = load_agent(&env, &job.agent)?;
        agent.rating_sum = agent
            .rating_sum
            .checked_add(rating as u64)
            .ok_or(Error::Overflow)?;
        agent.rating_count = agent.rating_count.checked_add(1).ok_or(Error::Overflow)?;
        save_agent(&env, &agent);

        job.rated = true;
        save_job(&env, job_id, &job);

        AgentRated {
            agent: job.agent,
            job_id,
            rating,
        }
        .publish(&env);
        Ok(())
    }

    // ---- Baca ----

    pub fn get_agent(env: Env, id: Address) -> Option<Agent> {
        bump_instance(&env);
        load_agent(&env, &id).ok()
    }

    pub fn get_job(env: Env, job_id: u64) -> Option<Job> {
        bump_instance(&env);
        load_job(&env, job_id).ok()
    }

    pub fn job_count(env: Env) -> u64 {
        bump_instance(&env);
        env.storage()
            .instance()
            .get(&DataKey::JobCount)
            .unwrap_or(0)
    }

    pub fn agent_count(env: Env) -> u32 {
        bump_instance(&env);
        env.storage()
            .instance()
            .get(&DataKey::AgentCount)
            .unwrap_or(0)
    }

    // Alamat owner agen ke-`index` (0-based, urutan pendaftaran)
    pub fn agent_at(env: Env, index: u32) -> Result<Address, Error> {
        bump_instance(&env);
        let key = DataKey::AgentAt(index);
        let owner = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::AgentNotFound)?;
        bump_persistent(&env, &key);
        Ok(owner)
    }
}

mod test;

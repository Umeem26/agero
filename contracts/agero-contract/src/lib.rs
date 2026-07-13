#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Agent {
    pub owner: Address,
    pub name: String,
    pub description: String,
    pub api_url: String,
    pub price: u64,
    pub rating_sum: u32,
    pub rating_count: u32,
    pub total_jobs: u32,
}

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

#[contract]
pub struct AgeroContract;

#[contractimpl]
impl AgeroContract {
    // Mendaftarkan AI Agent baru
    pub fn register_agent(
        env: Env,
        owner: Address,
        name: String,
        description: String,
        api_url: String,
        price: u64,
    ) {
        owner.require_auth();
        
        let key = DataKey::Agent(owner.clone());
        if env.storage().persistent().has(&key) {
            panic!("Agent already registered");
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

        env.storage().persistent().set(&key, &agent);
    }

    // Mendapatkan profil AI Agent berdasarkan Address owner
    pub fn get_agent(env: Env, id: Address) -> Option<Agent> {
        let key = DataKey::Agent(id);
        env.storage().persistent().get(&key)
    }

    // Memperbarui profil AI Agent oleh owner
    pub fn update_agent(
        env: Env,
        owner: Address,
        name: String,
        description: String,
        api_url: String,
        price: u64,
    ) {
        owner.require_auth();
        
        let key = DataKey::Agent(owner.clone());
        let mut agent: Agent = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Agent not found"));

        agent.name = name;
        agent.description = description;
        agent.api_url = api_url;
        agent.price = price;

        env.storage().persistent().set(&key, &agent);
    }

    // Memberikan ulasan rating ke AI Agent (skala 1-5)
    pub fn rate_agent(env: Env, id: Address, rating: u32) {
        if rating < 1 || rating > 5 {
            panic!("Rating must be between 1 and 5");
        }

        let key = DataKey::Agent(id);
        let mut agent: Agent = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Agent not found"));

        agent.rating_sum += rating;
        agent.rating_count += 1;

        env.storage().persistent().set(&key, &agent);
    }

    // Membuat pekerjaan baru dan mengunci dana USDC ke dalam kontrak escrow
    pub fn create_job(
        env: Env,
        client: Address,
        agent_owner: Address,
        token: Address,
        amount: u64,
    ) -> u64 {
        client.require_auth();

        // Pastikan agen tujuan terdaftar
        let agent_key = DataKey::Agent(agent_owner.clone());
        let agent: Agent = env
            .storage()
            .persistent()
            .get(&agent_key)
            .unwrap_or_else(|| panic!("Target AI Agent is not registered"));

        // Validasi jumlah pembayaran (amount >= agent.price)
        if amount < agent.price {
            panic!("Amount is less than agent price");
        }

        // Ambil ID pekerjaan saat ini
        let mut job_count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::JobCount)
            .unwrap_or(0);
        job_count += 1;
        env.storage().instance().set(&DataKey::JobCount, &job_count);

        // Transfer token USDC dari client ke kontrak Agero ini
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&client, &env.current_contract_address(), &(amount as i128));

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

        // Tambah total_jobs untuk AI Agent
        let agent_key = DataKey::Agent(job.agent.clone());
        if let Some(mut agent) = env.storage().persistent().get::<_, Agent>(&agent_key) {
            agent.total_jobs += 1;
            env.storage().persistent().set(&agent_key, &agent);
        }

        // Transfer dana dari kontrak ini ke pemilik AI Agent
        let token_client = token::Client::new(&env, &job.token);
        token_client.transfer(&env.current_contract_address(), &job.agent, &(job.amount as i128));
    }

    // Membatalkan pekerjaan dan mengembalikan dana seutuhnya ke klien
    pub fn refund_job(env: Env, job_id: u64, caller: Address) {
        let key = DataKey::Job(job_id);
        let mut job: Job = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Job not found"));

        if job.status != JobStatus::Pending {
            panic!("Job is not in pending state");
        }

        // Pastikan caller adalah client atau agent dari pekerjaan ini
        if caller != job.client && caller != job.agent {
            panic!("Unauthorized: Caller must be client or agent");
        }

        // Lakukan otorisasi caller
        caller.require_auth();

        job.status = JobStatus::Refunded;
        env.storage().persistent().set(&key, &job);

        // Kembalikan dana ke klien
        let token_client = token::Client::new(&env, &job.token);
        token_client.transfer(&env.current_contract_address(), &job.client, &(job.amount as i128));
    }
}

mod test;


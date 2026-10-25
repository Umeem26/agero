#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, EnvTestConfig, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env, InvokeError, String,
};

mod auth;
mod events;
mod flow;
mod regression;
mod validation;

pub const PRICE: i128 = 10_000_000; // 1 XLM dalam stroop
pub const START_BALANCE: i128 = 100 * PRICE;
pub const START_TIME: u64 = 1_700_000_000;
pub const JOB_DURATION: u64 = DAY_SECS;

/// Env tanpa test_snapshots: snapshot tidak di-assert, jadi tidak ditulis ke disk.
pub fn new_env() -> Env {
    let env = Env::new_with_config(EnvTestConfig {
        capture_snapshot_at_drop: false,
    });
    env.ledger().set_timestamp(START_TIME);
    env
}

pub fn result_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[7u8; 32])
}

pub fn text(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

/// Kontrak dengan token SAC tetap, satu agen terdaftar, dan klien yang punya saldo.
/// Setup memakai mock_all_auths; tes otorisasi menggantinya dengan mock_auths/set_auths.
pub struct Setup {
    pub env: Env,
    pub contract_id: Address,
    pub contract: AgeroContractClient<'static>,
    pub token_id: Address,
    pub token: TokenClient<'static>,
    pub client: Address,
    pub agent: Address,
    pub stranger: Address,
}

impl Setup {
    pub fn new() -> Self {
        let env = new_env();
        env.mock_all_auths();

        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin)
            .address();
        let contract_id = env.register(AgeroContract, (&token_id,));
        let contract = AgeroContractClient::new(&env, &contract_id);
        let token = TokenClient::new(&env, &token_id);

        let client = Address::generate(&env);
        let agent = Address::generate(&env);
        let stranger = Address::generate(&env);
        StellarAssetClient::new(&env, &token_id).mint(&client, &START_BALANCE);

        contract.register_agent(
            &agent,
            &text(&env, "Summarizer Bot"),
            &text(&env, "Summarizes articles."),
            &text(&env, "https://example.com/summarize"),
            &PRICE,
        );

        Setup {
            env,
            contract_id,
            contract,
            token_id,
            token,
            client,
            agent,
            stranger,
        }
    }

    pub fn create_job(&self) -> u64 {
        self.contract
            .create_job(&self.client, &self.agent, &PRICE, &JOB_DURATION)
    }

    pub fn delivered_job(&self) -> u64 {
        let id = self.create_job();
        self.contract.deliver_job(&id, &result_hash(&self.env));
        id
    }

    pub fn completed_job(&self) -> u64 {
        let id = self.delivered_job();
        self.contract.complete_job(&id);
        id
    }

    pub fn job(&self, id: u64) -> Job {
        self.contract.get_job(&id).unwrap()
    }

    pub fn agent_profile(&self) -> Agent {
        self.contract.get_agent(&self.agent).unwrap()
    }

    pub fn balance(&self, addr: &Address) -> i128 {
        self.token.balance(addr)
    }

    pub fn advance(&self, secs: u64) {
        let now = self.env.ledger().timestamp();
        self.env.ledger().set_timestamp(now + secs);
    }
}

/// Hasil `try_*` saat `require_auth` gagal: error host (Auth), bukan error kontrak.
pub fn assert_auth_failure<T: core::fmt::Debug, C: core::fmt::Debug>(
    res: Result<Result<T, C>, Result<Error, InvokeError>>,
) {
    match res {
        Err(Err(InvokeError::Abort)) => {}
        other => panic!("expected auth failure, got {:?}", other),
    }
}

/// Hasil `try_*` yang gagal dengan error kontrak tertentu.
pub fn assert_contract_error<T: core::fmt::Debug, C: core::fmt::Debug>(
    res: Result<Result<T, C>, Result<Error, InvokeError>>,
    expected: Error,
) {
    match res {
        Err(Ok(e)) => assert_eq!(e, expected),
        other => panic!("expected {:?}, got {:?}", expected, other),
    }
}

//! Regresi audit 2026-10-25 (docs/audit/agero-audit.md). Setiap PoC yang dulu berhasil
//! kini harus gagal.
use super::*;
use soroban_sdk::testutils::storage::{Instance as _, Persistent as _};

// F02: klien dulu bisa refund kapan saja, termasuk setelah menerima hasil kerja.
#[test]
fn regression_f02_client_cannot_refund_before_deadline_or_after_delivery() {
    let s = Setup::new();
    let pending = s.create_job();
    assert_contract_error(
        s.contract.try_refund_job(&pending, &s.client),
        Error::TooEarly,
    );

    let delivered = s.delivered_job();
    s.advance(JOB_DURATION + 1);
    assert_contract_error(
        s.contract.try_refund_job(&delivered, &s.client),
        Error::InvalidState,
    );
}

// F02: agen dulu tidak punya jalan menagih; kini auto-release menjamin pembayaran.
#[test]
fn regression_f02_agent_gets_paid_without_client_action() {
    let s = Setup::new();
    let id = s.delivered_job();
    s.advance(REVIEW_WINDOW_SECS);
    s.env.set_auths(&[]);
    s.contract.release_job(&id);
    assert_eq!(s.balance(&s.agent), PRICE);
}

// F04 PoC A: 100 rating tanpa auth dan tanpa job.
#[test]
fn regression_f04_rating_without_auth_rejected() {
    let s = Setup::new();
    let id = s.completed_job();
    s.env.set_auths(&[]);
    assert_auth_failure(s.contract.try_rate_agent(&s.client, &id, &5));
    assert_eq!(s.agent_profile().rating_count, 0);
}

#[test]
fn regression_f04_rating_spam_without_completed_job_rejected() {
    let s = Setup::new();
    // Tanpa job sama sekali
    assert_contract_error(
        s.contract.try_rate_agent(&s.stranger, &1, &5),
        Error::JobNotFound,
    );
    // Satu job selesai hanya memberi satu rating
    let id = s.completed_job();
    s.contract.rate_agent(&s.client, &id, &5);
    for _ in 0..10 {
        assert_contract_error(
            s.contract.try_rate_agent(&s.client, &id, &5),
            Error::AlreadyRated,
        );
    }
    let agent = s.agent_profile();
    assert_eq!(
        (agent.rating_sum, agent.rating_count, agent.total_jobs),
        (5, 1, 1)
    );
}

// F05 PoC C: 10x create_job(me, me, tok, 0) + complete_job -> total_jobs = 10.
#[test]
fn regression_f05_self_deal_with_zero_amount_rejected() {
    let s = Setup::new();
    assert_contract_error(
        s.contract
            .try_create_job(&s.agent, &s.agent, &0, &JOB_DURATION),
        Error::SelfDeal,
    );
    assert_contract_error(
        s.contract
            .try_create_job(&s.agent, &s.agent, &PRICE, &JOB_DURATION),
        Error::SelfDeal,
    );
    assert_contract_error(
        s.contract
            .try_create_job(&s.client, &s.agent, &0, &JOB_DURATION),
        Error::InvalidAmount,
    );
    assert_eq!(s.agent_profile().total_jobs, 0);
    assert_eq!(s.contract.job_count(), 0);
}

#[test]
fn regression_f05_zero_price_agent_rejected() {
    let s = Setup::new();
    let t = text(&s.env, "free");
    assert_contract_error(
        s.contract.try_register_agent(&s.stranger, &t, &t, &t, &0),
        Error::InvalidPrice,
    );
}

// F06 PoC D: token SAC buatan penyerang diterima sebagai pembayaran.
#[test]
fn regression_f06_fake_token_cannot_be_used() {
    let s = Setup::new();
    let attacker = Address::generate(&s.env);
    let fake_id = s
        .env
        .register_stellar_asset_contract_v2(attacker.clone())
        .address();
    let fake = TokenClient::new(&s.env, &fake_id);
    StellarAssetClient::new(&s.env, &fake_id).mint(&attacker, &START_BALANCE);

    // create_job tidak lagi menerima parameter token: kontrak selalu menarik token
    // yang di-set di __constructor. Penyerang tidak punya token itu -> transfer gagal.
    assert!(s
        .contract
        .try_create_job(&attacker, &s.agent, &PRICE, &JOB_DURATION)
        .is_err());
    assert_eq!(fake.balance(&attacker), START_BALANCE);
    assert_eq!(fake.balance(&s.contract_id), 0);
    assert_eq!(s.contract.job_count(), 0);

    // Token yang tersimpan tetap token yang di-set saat deploy
    let stored: Address = s.env.as_contract(&s.contract_id, || {
        s.env.storage().instance().get(&DataKey::Token).unwrap()
    });
    assert_eq!(stored, s.token_id);
}

// F07: tidak ada getter job / enumerasi agen. Lihat juga flow::getters_enumerate_agents_and_jobs.
#[test]
fn regression_f07_job_state_readable() {
    let s = Setup::new();
    let id = s.delivered_job();
    let job = s.job(id);
    assert_eq!(job.status, JobStatus::Delivered);
    assert_eq!(job.result_hash, Some(result_hash(&s.env)));
    assert_eq!(s.contract.job_count(), 1);
    assert_eq!(s.contract.agent_count(), 1);
    assert_eq!(s.contract.agent_at(&0), s.agent);
}

// F11: tidak ada extend_ttl; entri bisa ter-arsip saat dana masih terkunci.
#[test]
fn regression_f11_ttl_extended_on_write_and_read() {
    let s = Setup::new();
    let id = s.create_job();

    let ttls = |s: &Setup| {
        s.env.as_contract(&s.contract_id, || {
            let p = s.env.storage().persistent();
            (
                s.env.storage().instance().get_ttl(),
                p.get_ttl(&DataKey::Job(id)),
                p.get_ttl(&DataKey::Agent(s.agent.clone())),
                p.get_ttl(&DataKey::AgentAt(0)),
            )
        })
    };
    assert_eq!(
        ttls(&s),
        (
            INSTANCE_TTL_EXTEND_TO,
            PERSISTENT_TTL_EXTEND_TO,
            PERSISTENT_TTL_EXTEND_TO,
            PERSISTENT_TTL_EXTEND_TO
        )
    );

    // Job yang tidak disentuh tetap hidup melewati tenggat maksimum + masa tinjau
    let ledgers_needed =
        ((MAX_DURATION_SECS + REVIEW_WINDOW_SECS) / DAY_SECS) as u32 * DAY_IN_LEDGERS;
    assert!(PERSISTENT_TTL_THRESHOLD > ledgers_needed);

    // +20 hari: sisa persistent 40 hari < threshold 45 -> baca penting memperpanjang lagi;
    // sisa instance 40 hari masih >= threshold 30 -> belum diperpanjang
    let seq = s.env.ledger().sequence();
    s.env
        .ledger()
        .set_sequence_number(seq + 20 * DAY_IN_LEDGERS);
    s.contract.get_job(&id);
    s.contract.get_agent(&s.agent);
    s.contract.agent_at(&0);
    assert_eq!(
        ttls(&s),
        (
            INSTANCE_TTL_EXTEND_TO - 20 * DAY_IN_LEDGERS,
            PERSISTENT_TTL_EXTEND_TO,
            PERSISTENT_TTL_EXTEND_TO,
            PERSISTENT_TTL_EXTEND_TO
        )
    );

    // +15 hari lagi: sisa instance 25 hari < 30 -> panggilan apa pun memperpanjang instance
    s.env
        .ledger()
        .set_sequence_number(seq + 35 * DAY_IN_LEDGERS);
    s.contract.job_count();
    assert_eq!(ttls(&s).0, INSTANCE_TTL_EXTEND_TO);
}

// F13: error dulu berupa panic! string; kini kode #[contracterror] yang stabil.
#[test]
fn regression_f13_errors_are_typed_contract_codes() {
    let s = Setup::new();
    let codes = [
        (Error::AgentNotFound, 1),
        (Error::JobNotFound, 2),
        (Error::AlreadyRegistered, 3),
        (Error::Unauthorized, 4),
        (Error::SelfDeal, 5),
        (Error::InvalidPrice, 6),
        (Error::InvalidAmount, 7),
        (Error::AmountBelowPrice, 8),
        (Error::InvalidDuration, 9),
        (Error::InvalidState, 10),
        (Error::TooEarly, 11),
        (Error::InvalidRating, 12),
        (Error::AlreadyRated, 13),
        (Error::Overflow, 14),
    ];
    for (err, code) in codes {
        assert_eq!(err as u32, code);
    }
    // Error sampai ke pemanggil sebagai kode kontrak, bukan abort tanpa info
    match s.contract.try_complete_job(&99) {
        Err(Ok(e)) => assert_eq!(e, Error::JobNotFound),
        other => panic!("unexpected {:?}", other),
    }
}

fn seed_agent_stats(s: &Setup, rating_sum: u64, rating_count: u32, total_jobs: u32) {
    let mut agent = s.agent_profile();
    agent.rating_sum = rating_sum;
    agent.rating_count = rating_count;
    agent.total_jobs = total_jobs;
    s.env.as_contract(&s.contract_id, || {
        s.env
            .storage()
            .persistent()
            .set(&DataKey::Agent(s.agent.clone()), &agent);
    });
}

// F14: rating_sum u32 dengan += bisa overflow; kini u64 + checked_add -> Error::Overflow.
#[test]
fn regression_f14_rating_overflow_returns_error() {
    let s = Setup::new();
    let id = s.completed_job();

    seed_agent_stats(&s, u64::MAX - 2, 1, 1);
    assert_contract_error(
        s.contract.try_rate_agent(&s.client, &id, &5),
        Error::Overflow,
    );
    seed_agent_stats(&s, 0, u32::MAX, 1);
    assert_contract_error(
        s.contract.try_rate_agent(&s.client, &id, &5),
        Error::Overflow,
    );
    // Gagal = tidak ada perubahan, job masih bisa dirating setelah kondisi normal
    assert!(!s.job(id).rated);
}

#[test]
fn regression_f14_total_jobs_overflow_reverts_payment() {
    let s = Setup::new();
    let id = s.delivered_job();
    seed_agent_stats(&s, 0, 0, u32::MAX);
    assert_contract_error(s.contract.try_complete_job(&id), Error::Overflow);
    assert_eq!(s.job(id).status, JobStatus::Delivered);
    assert_eq!(s.balance(&s.agent), 0);
    assert_eq!(s.balance(&s.contract_id), PRICE);
}

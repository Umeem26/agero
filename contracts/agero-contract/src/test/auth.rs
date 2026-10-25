//! Otorisasi negatif tanpa mock_all_auths: hanya auth `who` untuk fungsi itu yang di-mock,
//! sehingga panggilan gagal bila kontrak menuntut auth alamat lain.
use super::*;
use soroban_sdk::{
    testutils::{MockAuth, MockAuthInvoke},
    IntoVal, Val, Vec,
};

fn auth_as(s: &Setup, who: &Address, fn_name: &str, args: Vec<Val>) {
    s.env.mock_auths(&[MockAuth {
        address: who,
        invoke: &MockAuthInvoke {
            contract: &s.contract_id,
            fn_name,
            args,
            sub_invokes: &[],
        },
    }]);
}

/// Alamat yang benar-benar dimintai auth pada panggilan terakhir (mode mock_all_auths).
fn signers(s: &Setup) -> std::vec::Vec<Address> {
    s.env.auths().into_iter().map(|(addr, _)| addr).collect()
}

#[test]
fn each_mutation_requires_exactly_the_expected_signer() {
    let s = Setup::new();
    assert_eq!(signers(&s), [s.agent.clone()]); // register_agent oleh agen

    let id = s.create_job();
    assert_eq!(signers(&s), [s.client.clone()]);
    s.contract.deliver_job(&id, &result_hash(&s.env));
    assert_eq!(signers(&s), [s.agent.clone()]);
    s.contract.complete_job(&id);
    assert_eq!(signers(&s), [s.client.clone()]);
    s.contract.rate_agent(&s.client, &id, &5);
    assert_eq!(signers(&s), [s.client.clone()]);

    let refunded = s.create_job();
    s.contract.refund_job(&refunded, &s.agent);
    assert_eq!(signers(&s), [s.agent.clone()]);

    let released = s.delivered_job();
    s.advance(REVIEW_WINDOW_SECS);
    s.contract.release_job(&released);
    assert!(signers(&s).is_empty());
}

#[test]
fn no_auth_at_all_blocks_every_signed_mutation() {
    let s = Setup::new();
    let pending = s.create_job();
    let delivered = s.delivered_job();
    let completed = s.completed_job();
    s.advance(JOB_DURATION + 1);
    let h = result_hash(&s.env);

    s.env.set_auths(&[]);
    assert_auth_failure(
        s.contract
            .try_create_job(&s.client, &s.agent, &PRICE, &JOB_DURATION),
    );
    assert_auth_failure(s.contract.try_deliver_job(&pending, &h));
    assert_auth_failure(s.contract.try_complete_job(&delivered));
    assert_auth_failure(s.contract.try_refund_job(&pending, &s.client));
    assert_auth_failure(s.contract.try_rate_agent(&s.client, &completed, &5));
    assert_auth_failure(s.contract.try_update_agent(
        &s.agent,
        &text(&s.env, "x"),
        &text(&s.env, "x"),
        &text(&s.env, "x"),
        &PRICE,
    ));
    assert_auth_failure(s.contract.try_register_agent(
        &s.stranger,
        &text(&s.env, "x"),
        &text(&s.env, "x"),
        &text(&s.env, "x"),
        &PRICE,
    ));
    assert_eq!(s.contract.job_count(), 3);
    assert_eq!(s.job(pending).status, JobStatus::Pending);
}

#[test]
fn stranger_cannot_deliver_job() {
    let s = Setup::new();
    let id = s.create_job();
    let h = result_hash(&s.env);

    auth_as(
        &s,
        &s.stranger,
        "deliver_job",
        (id, h.clone()).into_val(&s.env),
    );
    assert_auth_failure(s.contract.try_deliver_job(&id, &h));
    // Klien juga bukan pemilik agen
    auth_as(
        &s,
        &s.client,
        "deliver_job",
        (id, h.clone()).into_val(&s.env),
    );
    assert_auth_failure(s.contract.try_deliver_job(&id, &h));
    assert_eq!(s.job(id).status, JobStatus::Pending);

    // Kontrol positif: auth agen yang sama persis lolos
    auth_as(
        &s,
        &s.agent,
        "deliver_job",
        (id, h.clone()).into_val(&s.env),
    );
    s.contract.deliver_job(&id, &h);
    assert_eq!(s.job(id).status, JobStatus::Delivered);
}

#[test]
fn stranger_and_agent_cannot_complete_job() {
    let s = Setup::new();
    let id = s.delivered_job();

    auth_as(&s, &s.stranger, "complete_job", (id,).into_val(&s.env));
    assert_auth_failure(s.contract.try_complete_job(&id));
    auth_as(&s, &s.agent, "complete_job", (id,).into_val(&s.env));
    assert_auth_failure(s.contract.try_complete_job(&id));
    assert_eq!(s.balance(&s.agent), 0);

    auth_as(&s, &s.client, "complete_job", (id,).into_val(&s.env));
    s.contract.complete_job(&id);
    assert_eq!(s.balance(&s.agent), PRICE);
}

#[test]
fn stranger_cannot_refund_job() {
    let s = Setup::new();
    let id = s.create_job();
    s.advance(JOB_DURATION + 1);

    // Atas nama sendiri: auth valid, tetapi bukan klien/agen
    auth_as(
        &s,
        &s.stranger,
        "refund_job",
        (id, s.stranger.clone()).into_val(&s.env),
    );
    assert_contract_error(
        s.contract.try_refund_job(&id, &s.stranger),
        Error::Unauthorized,
    );
    // Memalsukan caller = klien / agen tanpa tanda tangan mereka
    auth_as(
        &s,
        &s.stranger,
        "refund_job",
        (id, s.client.clone()).into_val(&s.env),
    );
    assert_auth_failure(s.contract.try_refund_job(&id, &s.client));
    auth_as(
        &s,
        &s.stranger,
        "refund_job",
        (id, s.agent.clone()).into_val(&s.env),
    );
    assert_auth_failure(s.contract.try_refund_job(&id, &s.agent));
    assert_eq!(s.balance(&s.contract_id), PRICE);

    auth_as(
        &s,
        &s.client,
        "refund_job",
        (id, s.client.clone()).into_val(&s.env),
    );
    s.contract.refund_job(&id, &s.client);
    assert_eq!(s.balance(&s.client), START_BALANCE);
}

#[test]
fn non_client_cannot_rate() {
    let s = Setup::new();
    let id = s.completed_job();

    auth_as(
        &s,
        &s.stranger,
        "rate_agent",
        (s.stranger.clone(), id, 5u32).into_val(&s.env),
    );
    assert_contract_error(
        s.contract.try_rate_agent(&s.stranger, &id, &5),
        Error::Unauthorized,
    );
    // Agen menilai dirinya sendiri lewat job ini
    auth_as(
        &s,
        &s.agent,
        "rate_agent",
        (s.agent.clone(), id, 5u32).into_val(&s.env),
    );
    assert_contract_error(
        s.contract.try_rate_agent(&s.agent, &id, &5),
        Error::Unauthorized,
    );
    // Memalsukan client tanpa tanda tangan klien
    auth_as(
        &s,
        &s.stranger,
        "rate_agent",
        (s.client.clone(), id, 5u32).into_val(&s.env),
    );
    assert_auth_failure(s.contract.try_rate_agent(&s.client, &id, &5));
    assert_eq!(s.agent_profile().rating_count, 0);

    auth_as(
        &s,
        &s.client,
        "rate_agent",
        (s.client.clone(), id, 5u32).into_val(&s.env),
    );
    s.contract.rate_agent(&s.client, &id, &5);
    assert_eq!(s.agent_profile().rating_count, 1);
}

#[test]
fn stranger_cannot_update_agent() {
    let s = Setup::new();
    let name = text(&s.env, "Hijacked");
    let args = (
        s.agent.clone(),
        name.clone(),
        name.clone(),
        name.clone(),
        1i128,
    )
        .into_val(&s.env);

    auth_as(&s, &s.stranger, "update_agent", args);
    assert_auth_failure(
        s.contract
            .try_update_agent(&s.agent, &name, &name, &name, &1),
    );
    let agent = s.agent_profile();
    assert_eq!(agent.name, text(&s.env, "Summarizer Bot"));
    assert_eq!(agent.price, PRICE);
}

#[test]
fn stranger_cannot_create_job_on_behalf_of_client() {
    let s = Setup::new();
    let args = (s.client.clone(), s.agent.clone(), PRICE, JOB_DURATION).into_val(&s.env);
    auth_as(&s, &s.stranger, "create_job", args);
    assert_auth_failure(
        s.contract
            .try_create_job(&s.client, &s.agent, &PRICE, &JOB_DURATION),
    );
    assert_eq!(s.balance(&s.client), START_BALANCE);
    assert_eq!(s.contract.job_count(), 0);
}

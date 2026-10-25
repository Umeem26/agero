use super::*;

#[test]
fn happy_path_create_deliver_complete_rate() {
    let s = Setup::new();

    // create: dana pindah klien -> kontrak
    let id = s.create_job();
    assert_eq!(id, 1);
    assert_eq!(s.balance(&s.client), START_BALANCE - PRICE);
    assert_eq!(s.balance(&s.contract_id), PRICE);
    assert_eq!(s.balance(&s.agent), 0);
    let job = s.job(id);
    assert_eq!(job.client, s.client);
    assert_eq!(job.agent, s.agent);
    assert_eq!(job.amount, PRICE);
    assert_eq!(job.status, JobStatus::Pending);
    assert_eq!(job.created_at, START_TIME);
    assert_eq!(job.deadline, START_TIME + JOB_DURATION);
    assert_eq!(job.delivered_at, None);
    assert_eq!(job.result_hash, None);
    assert!(!job.rated);

    // deliver: saldo tidak berubah
    s.advance(HOUR_SECS);
    s.contract.deliver_job(&id, &result_hash(&s.env));
    let job = s.job(id);
    assert_eq!(job.status, JobStatus::Delivered);
    assert_eq!(job.delivered_at, Some(START_TIME + HOUR_SECS));
    assert_eq!(job.result_hash, Some(result_hash(&s.env)));
    assert_eq!(s.balance(&s.contract_id), PRICE);

    // complete: kontrak -> agen
    s.contract.complete_job(&id);
    assert_eq!(s.job(id).status, JobStatus::Completed);
    assert_eq!(s.balance(&s.client), START_BALANCE - PRICE);
    assert_eq!(s.balance(&s.contract_id), 0);
    assert_eq!(s.balance(&s.agent), PRICE);
    assert_eq!(s.agent_profile().total_jobs, 1);

    // rate
    s.contract.rate_agent(&s.client, &id, &4);
    let agent = s.agent_profile();
    assert_eq!(agent.rating_sum, 4);
    assert_eq!(agent.rating_count, 1);
    assert!(s.job(id).rated);
}

#[test]
fn amount_above_price_is_accepted_and_paid_in_full() {
    let s = Setup::new();
    let id = s
        .contract
        .create_job(&s.client, &s.agent, &(PRICE * 3), &JOB_DURATION);
    s.contract.deliver_job(&id, &result_hash(&s.env));
    s.contract.complete_job(&id);
    assert_eq!(s.balance(&s.agent), PRICE * 3);
    assert_eq!(s.balance(&s.contract_id), 0);
}

#[test]
fn auto_release_rejected_before_review_window() {
    let s = Setup::new();
    let id = s.delivered_job();
    s.env.set_auths(&[]);

    assert_contract_error(s.contract.try_release_job(&id), Error::TooEarly);
    s.advance(REVIEW_WINDOW_SECS - 1);
    assert_contract_error(s.contract.try_release_job(&id), Error::TooEarly);

    assert_eq!(s.job(id).status, JobStatus::Delivered);
    assert_eq!(s.balance(&s.contract_id), PRICE);
    assert_eq!(s.balance(&s.agent), 0);
}

#[test]
fn auto_release_by_third_party_after_review_window() {
    let s = Setup::new();
    let id = s.delivered_job();
    s.advance(REVIEW_WINDOW_SECS);

    // Tanpa auth siapa pun: release tidak memerlukan tanda tangan pihak mana pun
    s.env.set_auths(&[]);
    s.contract.release_job(&id);

    assert_eq!(s.job(id).status, JobStatus::Completed);
    assert_eq!(s.balance(&s.agent), PRICE);
    assert_eq!(s.balance(&s.contract_id), 0);
    assert_eq!(s.agent_profile().total_jobs, 1);

    // Klien tetap boleh memberi rating setelah auto-release
    s.env.mock_all_auths();
    s.contract.rate_agent(&s.client, &id, &3);
    assert_eq!(s.agent_profile().rating_sum, 3);
}

#[test]
fn release_requires_delivered_state() {
    let s = Setup::new();
    let pending = s.create_job();
    s.advance(MAX_DURATION_SECS + REVIEW_WINDOW_SECS);
    assert_contract_error(s.contract.try_release_job(&pending), Error::InvalidState);
}

#[test]
fn job_cannot_be_paid_twice() {
    let s = Setup::new();

    // complete lalu release / complete lagi
    let a = s.completed_job();
    s.advance(REVIEW_WINDOW_SECS);
    assert_contract_error(s.contract.try_release_job(&a), Error::InvalidState);
    assert_contract_error(s.contract.try_complete_job(&a), Error::InvalidState);
    assert_contract_error(s.contract.try_refund_job(&a, &s.agent), Error::InvalidState);

    // release lalu complete / release lagi
    let b = s.delivered_job();
    s.advance(REVIEW_WINDOW_SECS);
    s.contract.release_job(&b);
    assert_contract_error(s.contract.try_complete_job(&b), Error::InvalidState);
    assert_contract_error(s.contract.try_release_job(&b), Error::InvalidState);

    assert_eq!(s.balance(&s.agent), 2 * PRICE);
    assert_eq!(s.balance(&s.contract_id), 0);
    assert_eq!(s.agent_profile().total_jobs, 2);
}

#[test]
fn complete_requires_delivered_state() {
    let s = Setup::new();
    let id = s.create_job();
    assert_contract_error(s.contract.try_complete_job(&id), Error::InvalidState);
    assert_eq!(s.balance(&s.agent), 0);
}

#[test]
fn deliver_allowed_after_deadline_while_pending() {
    let s = Setup::new();
    let id = s.create_job();
    s.advance(JOB_DURATION + 1);
    s.contract.deliver_job(&id, &result_hash(&s.env));
    assert_eq!(s.job(id).status, JobStatus::Delivered);
    // Setelah Delivered, klien tidak bisa refund lagi
    assert_contract_error(
        s.contract.try_refund_job(&id, &s.client),
        Error::InvalidState,
    );
}

#[test]
fn deliver_rejected_unless_pending() {
    let s = Setup::new();
    let id = s.delivered_job();
    assert_contract_error(
        s.contract.try_deliver_job(&id, &result_hash(&s.env)),
        Error::InvalidState,
    );

    let refunded = s.create_job();
    s.contract.refund_job(&refunded, &s.agent);
    assert_contract_error(
        s.contract.try_deliver_job(&refunded, &result_hash(&s.env)),
        Error::InvalidState,
    );
}

#[test]
fn refund_client_rejected_before_and_at_deadline() {
    let s = Setup::new();
    let id = s.create_job();
    assert_contract_error(s.contract.try_refund_job(&id, &s.client), Error::TooEarly);
    s.advance(JOB_DURATION); // tepat di deadline: masih ditolak (syarat now > deadline)
    assert_contract_error(s.contract.try_refund_job(&id, &s.client), Error::TooEarly);
    assert_eq!(s.balance(&s.contract_id), PRICE);
}

#[test]
fn refund_client_rejected_when_delivered() {
    let s = Setup::new();
    let id = s.delivered_job();
    s.advance(JOB_DURATION + 1);
    assert_contract_error(
        s.contract.try_refund_job(&id, &s.client),
        Error::InvalidState,
    );
    assert_eq!(s.balance(&s.contract_id), PRICE);
}

#[test]
fn refund_client_after_deadline_without_delivery() {
    let s = Setup::new();
    let id = s.create_job();
    s.advance(JOB_DURATION + 1);
    s.contract.refund_job(&id, &s.client);
    assert_eq!(s.job(id).status, JobStatus::Refunded);
    assert_eq!(s.balance(&s.client), START_BALANCE);
    assert_eq!(s.balance(&s.contract_id), 0);
    assert_eq!(s.agent_profile().total_jobs, 0);
}

#[test]
fn refund_agent_while_pending() {
    let s = Setup::new();
    let id = s.create_job();
    s.contract.refund_job(&id, &s.agent);
    assert_eq!(s.job(id).status, JobStatus::Refunded);
    assert_eq!(s.balance(&s.client), START_BALANCE);
    assert_eq!(s.balance(&s.contract_id), 0);
}

#[test]
fn refund_agent_while_delivered() {
    let s = Setup::new();
    let id = s.delivered_job();
    s.contract.refund_job(&id, &s.agent);
    assert_eq!(s.job(id).status, JobStatus::Refunded);
    assert_eq!(s.balance(&s.client), START_BALANCE);
    assert_eq!(s.balance(&s.agent), 0);
}

#[test]
fn refund_by_third_party_rejected() {
    let s = Setup::new();
    let id = s.create_job();
    s.advance(JOB_DURATION + 1);
    assert_contract_error(
        s.contract.try_refund_job(&id, &s.stranger),
        Error::Unauthorized,
    );
    assert_eq!(s.balance(&s.contract_id), PRICE);
}

#[test]
fn refund_cannot_happen_twice() {
    let s = Setup::new();
    let id = s.create_job();
    s.contract.refund_job(&id, &s.agent);
    assert_contract_error(
        s.contract.try_refund_job(&id, &s.agent),
        Error::InvalidState,
    );
    s.advance(JOB_DURATION + 1);
    assert_contract_error(
        s.contract.try_refund_job(&id, &s.client),
        Error::InvalidState,
    );
    assert_eq!(s.balance(&s.client), START_BALANCE);
}

#[test]
fn parallel_jobs_are_isolated() {
    let s = Setup::new();
    let a = s.create_job();
    let b = s.create_job();
    assert_eq!((a, b), (1, 2));
    assert_eq!(s.balance(&s.contract_id), 2 * PRICE);

    s.contract.refund_job(&a, &s.agent);
    s.contract.deliver_job(&b, &result_hash(&s.env));
    s.contract.complete_job(&b);

    assert_eq!(s.job(a).status, JobStatus::Refunded);
    assert_eq!(s.job(b).status, JobStatus::Completed);
    assert_eq!(s.balance(&s.client), START_BALANCE - PRICE);
    assert_eq!(s.balance(&s.agent), PRICE);
    assert_eq!(s.balance(&s.contract_id), 0);
}

#[test]
fn update_agent_changes_profile_and_keeps_stats() {
    let s = Setup::new();
    s.completed_job();
    s.contract.update_agent(
        &s.agent,
        &text(&s.env, "Summarizer v2"),
        &text(&s.env, "Now multilingual."),
        &text(&s.env, "https://example.com/v2"),
        &(PRICE * 2),
    );
    let agent = s.agent_profile();
    assert_eq!(agent.name, text(&s.env, "Summarizer v2"));
    assert_eq!(agent.description, text(&s.env, "Now multilingual."));
    assert_eq!(agent.api_url, text(&s.env, "https://example.com/v2"));
    assert_eq!(agent.price, PRICE * 2);
    assert_eq!(agent.total_jobs, 1);

    // Harga baru berlaku untuk job berikutnya
    assert_contract_error(
        s.contract
            .try_create_job(&s.client, &s.agent, &PRICE, &JOB_DURATION),
        Error::AmountBelowPrice,
    );
}

#[test]
fn getters_enumerate_agents_and_jobs() {
    let s = Setup::new();
    let second = Address::generate(&s.env);
    s.contract.register_agent(
        &second,
        &text(&s.env, "Translator"),
        &text(&s.env, "Translates."),
        &text(&s.env, "https://example.com/tr"),
        &PRICE,
    );

    assert_eq!(s.contract.agent_count(), 2);
    assert_eq!(s.contract.agent_at(&0), s.agent);
    assert_eq!(s.contract.agent_at(&1), second);
    assert_contract_error(s.contract.try_agent_at(&2), Error::AgentNotFound);
    assert_eq!(s.contract.get_agent(&s.stranger), None);

    assert_eq!(s.contract.job_count(), 0);
    assert_eq!(s.contract.get_job(&1), None);
    s.create_job();
    s.contract
        .create_job(&s.client, &second, &PRICE, &JOB_DURATION);
    assert_eq!(s.contract.job_count(), 2);
    assert_eq!(s.job(1).agent, s.agent);
    assert_eq!(s.job(2).agent, second);
    assert_eq!(s.contract.get_job(&3), None);
}

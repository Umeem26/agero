//! Setiap fungsi mutasi menerbitkan tepat satu event kontrak (event transfer SAC disaring).
use super::*;
use soroban_sdk::{testutils::Events as _, xdr};

fn contract_events(s: &Setup) -> std::vec::Vec<xdr::ContractEvent> {
    s.env
        .events()
        .all()
        .filter_by_contract(&s.contract_id)
        .events()
        .to_vec()
}

fn assert_single_event(s: &Setup, expected: impl soroban_sdk::Event) {
    assert_eq!(
        contract_events(s),
        std::vec![expected.to_xdr(&s.env, &s.contract_id)]
    );
}

#[test]
fn register_and_update_publish_events() {
    let s = Setup::new();
    assert_single_event(
        &s,
        AgentRegistered {
            owner: s.agent.clone(),
            price: PRICE,
        },
    );

    let t = text(&s.env, "v2");
    s.contract.update_agent(&s.agent, &t, &t, &t, &(PRICE * 2));
    assert_single_event(
        &s,
        AgentUpdated {
            owner: s.agent.clone(),
            price: PRICE * 2,
        },
    );
}

#[test]
fn job_lifecycle_publishes_events() {
    let s = Setup::new();

    let id = s.create_job();
    assert_single_event(
        &s,
        JobCreated {
            job_id: id,
            client: s.client.clone(),
            agent: s.agent.clone(),
            amount: PRICE,
            deadline: START_TIME + JOB_DURATION,
        },
    );

    s.contract.deliver_job(&id, &result_hash(&s.env));
    assert_single_event(
        &s,
        JobDelivered {
            job_id: id,
            result_hash: result_hash(&s.env),
        },
    );

    s.contract.complete_job(&id);
    assert_single_event(
        &s,
        JobCompleted {
            job_id: id,
            amount: PRICE,
        },
    );

    s.contract.rate_agent(&s.client, &id, &5);
    assert_single_event(
        &s,
        AgentRated {
            agent: s.agent.clone(),
            job_id: id,
            rating: 5,
        },
    );
}

#[test]
fn release_and_refund_publish_events() {
    let s = Setup::new();

    let released = s.delivered_job();
    s.advance(REVIEW_WINDOW_SECS);
    s.contract.release_job(&released);
    assert_single_event(
        &s,
        JobReleased {
            job_id: released,
            amount: PRICE,
        },
    );

    let refunded = s.create_job();
    s.contract.refund_job(&refunded, &s.agent);
    assert_single_event(
        &s,
        JobRefunded {
            job_id: refunded,
            by: s.agent.clone(),
            amount: PRICE,
        },
    );
}

#[test]
fn failed_calls_publish_no_events() {
    let s = Setup::new();
    let _ = s.contract.try_complete_job(&1);
    assert!(contract_events(&s).is_empty());
}

#[test]
fn event_topics_are_name_and_id() {
    let s = Setup::new();
    let id = s.create_job();
    let event = &contract_events(&s)[0];
    let xdr::ContractEventBody::V0(body) = &event.body;
    assert_eq!(body.topics.len(), 2);
    assert_eq!(
        body.topics[0],
        xdr::ScVal::Symbol(xdr::ScSymbol("job_created".try_into().unwrap()))
    );
    assert_eq!(body.topics[1], xdr::ScVal::U64(id));
}

use super::*;

fn register(s: &Setup, owner: &Address, price: i128) -> Result<(), Error> {
    let t = text(&s.env, "x");
    match s.contract.try_register_agent(owner, &t, &t, &t, &price) {
        Ok(_) => Ok(()),
        Err(Ok(e)) => Err(e),
        Err(Err(e)) => panic!("unexpected invoke error {:?}", e),
    }
}

fn create(s: &Setup, amount: i128, duration: u64) -> Result<u64, Error> {
    match s
        .contract
        .try_create_job(&s.client, &s.agent, &amount, &duration)
    {
        Ok(Ok(id)) => Ok(id),
        Err(Ok(e)) => Err(e),
        other => panic!("unexpected result {:?}", other),
    }
}

#[test]
fn create_job_rejects_self_deal() {
    let s = Setup::new();
    assert_contract_error(
        s.contract
            .try_create_job(&s.agent, &s.agent, &PRICE, &JOB_DURATION),
        Error::SelfDeal,
    );
}

#[test]
fn create_job_rejects_zero_and_negative_amount() {
    let s = Setup::new();
    assert_eq!(create(&s, 0, JOB_DURATION), Err(Error::InvalidAmount));
    assert_eq!(create(&s, -PRICE, JOB_DURATION), Err(Error::InvalidAmount));
}

#[test]
fn create_job_rejects_amount_below_price() {
    let s = Setup::new();
    assert_eq!(
        create(&s, PRICE - 1, JOB_DURATION),
        Err(Error::AmountBelowPrice)
    );
}

#[test]
fn create_job_enforces_duration_bounds() {
    let s = Setup::new();
    assert_eq!(create(&s, PRICE, 0), Err(Error::InvalidDuration));
    assert_eq!(
        create(&s, PRICE, MIN_DURATION_SECS - 1),
        Err(Error::InvalidDuration)
    );
    assert_eq!(
        create(&s, PRICE, MAX_DURATION_SECS + 1),
        Err(Error::InvalidDuration)
    );
    assert_eq!(create(&s, PRICE, u64::MAX), Err(Error::InvalidDuration));

    let min = create(&s, PRICE, MIN_DURATION_SECS).unwrap();
    let max = create(&s, PRICE, MAX_DURATION_SECS).unwrap();
    assert_eq!(s.job(min).deadline, START_TIME + MIN_DURATION_SECS);
    assert_eq!(s.job(max).deadline, START_TIME + MAX_DURATION_SECS);
}

#[test]
fn create_job_rejects_unregistered_agent() {
    let s = Setup::new();
    assert_contract_error(
        s.contract
            .try_create_job(&s.client, &s.stranger, &PRICE, &JOB_DURATION),
        Error::AgentNotFound,
    );
}

#[test]
fn create_job_fails_without_enough_balance_and_moves_nothing() {
    let s = Setup::new();
    let res = s
        .contract
        .try_create_job(&s.client, &s.agent, &(START_BALANCE + 1), &JOB_DURATION);
    assert!(res.is_err());
    assert_eq!(s.contract.job_count(), 0);
    assert_eq!(s.balance(&s.client), START_BALANCE);
}

#[test]
fn failed_validation_moves_no_funds() {
    let s = Setup::new();
    let _ = create(&s, PRICE - 1, JOB_DURATION);
    let _ = create(&s, PRICE, 0);
    assert_eq!(s.balance(&s.client), START_BALANCE);
    assert_eq!(s.balance(&s.contract_id), 0);
    assert_eq!(s.contract.job_count(), 0);
}

#[test]
fn register_rejects_zero_and_negative_price() {
    let s = Setup::new();
    assert_eq!(register(&s, &s.stranger, 0), Err(Error::InvalidPrice));
    assert_eq!(register(&s, &s.stranger, -1), Err(Error::InvalidPrice));
    assert_eq!(s.contract.agent_count(), 1);
}

#[test]
fn register_rejects_duplicate_owner() {
    let s = Setup::new();
    assert_eq!(register(&s, &s.agent, PRICE), Err(Error::AlreadyRegistered));
    assert_eq!(s.contract.agent_count(), 1);
}

#[test]
fn update_agent_rejects_zero_price_and_unknown_owner() {
    let s = Setup::new();
    let t = text(&s.env, "x");
    assert_contract_error(
        s.contract.try_update_agent(&s.agent, &t, &t, &t, &0),
        Error::InvalidPrice,
    );
    assert_contract_error(
        s.contract.try_update_agent(&s.stranger, &t, &t, &t, &PRICE),
        Error::AgentNotFound,
    );
}

#[test]
fn rating_must_be_between_1_and_5() {
    let s = Setup::new();
    let id = s.completed_job();
    assert_contract_error(
        s.contract.try_rate_agent(&s.client, &id, &0),
        Error::InvalidRating,
    );
    assert_contract_error(
        s.contract.try_rate_agent(&s.client, &id, &6),
        Error::InvalidRating,
    );
    s.contract.rate_agent(&s.client, &id, &1);
    let other = s.completed_job();
    s.contract.rate_agent(&s.client, &other, &5);
    let agent = s.agent_profile();
    assert_eq!((agent.rating_sum, agent.rating_count), (6, 2));
}

#[test]
fn rating_twice_on_same_job_rejected() {
    let s = Setup::new();
    let id = s.completed_job();
    s.contract.rate_agent(&s.client, &id, &5);
    assert_contract_error(
        s.contract.try_rate_agent(&s.client, &id, &5),
        Error::AlreadyRated,
    );
    assert_eq!(s.agent_profile().rating_count, 1);
}

#[test]
fn rating_before_completed_rejected() {
    let s = Setup::new();
    let pending = s.create_job();
    let delivered = s.delivered_job();
    let refunded = s.create_job();
    s.contract.refund_job(&refunded, &s.agent);
    for id in [pending, delivered, refunded] {
        assert_contract_error(
            s.contract.try_rate_agent(&s.client, &id, &5),
            Error::InvalidState,
        );
    }
    assert_eq!(s.agent_profile().rating_count, 0);
}

#[test]
fn rating_by_non_client_rejected() {
    let s = Setup::new();
    let id = s.completed_job();
    assert_contract_error(
        s.contract.try_rate_agent(&s.stranger, &id, &5),
        Error::Unauthorized,
    );
}

#[test]
fn unknown_job_id_rejected_everywhere() {
    let s = Setup::new();
    let missing = 42u64;
    let h = result_hash(&s.env);
    assert_contract_error(s.contract.try_deliver_job(&missing, &h), Error::JobNotFound);
    assert_contract_error(s.contract.try_complete_job(&missing), Error::JobNotFound);
    assert_contract_error(s.contract.try_release_job(&missing), Error::JobNotFound);
    assert_contract_error(
        s.contract.try_refund_job(&missing, &s.client),
        Error::JobNotFound,
    );
    assert_contract_error(
        s.contract.try_rate_agent(&s.client, &missing, &5),
        Error::JobNotFound,
    );
    assert_eq!(s.contract.get_job(&missing), None);
}

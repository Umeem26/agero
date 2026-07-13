#![cfg(test)]

use super::*;
use soroban_sdk::{Env, String, Address, token, testutils::Address as _};

#[test]
fn test_agent_registration_and_update() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(AgeroContract, ());
    let client = AgeroContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let name = String::from_str(&env, "Summarizer Bot");
    let description = String::from_str(&env, "A smart AI bot to summarize articles.");
    let api_url = String::from_str(&env, "https://api.summarizer.ai/v1");
    let price = 500; // e.g. 5.00 USDC

    // Register agent
    client.register_agent(&owner, &name, &description, &api_url, &price);

    // Get agent and assert fields
    let agent = client.get_agent(&owner).unwrap();
    assert_eq!(agent.owner, owner);
    assert_eq!(agent.name, name);
    assert_eq!(agent.description, description);
    assert_eq!(agent.api_url, api_url);
    assert_eq!(agent.price, price);
    assert_eq!(agent.rating_sum, 0);
    assert_eq!(agent.rating_count, 0);
    assert_eq!(agent.total_jobs, 0);

    // Update agent
    let new_name = String::from_str(&env, "Advanced Summarizer Bot");
    let new_description = String::from_str(&env, "An advanced AI bot to summarize articles in multiple languages.");
    let new_api_url = String::from_str(&env, "https://api.summarizer.ai/v2");
    let new_price = 1000;
    client.update_agent(&owner, &new_name, &new_description, &new_api_url, &new_price);

    // Get agent and assert updated fields
    let updated_agent = client.get_agent(&owner).unwrap();
    assert_eq!(updated_agent.name, new_name);
    assert_eq!(updated_agent.description, new_description);
    assert_eq!(updated_agent.api_url, new_api_url);
    assert_eq!(updated_agent.price, new_price);
}

#[test]
fn test_agent_rating() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(AgeroContract, ());
    let client = AgeroContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let name = String::from_str(&env, "Translation Bot");
    let description = String::from_str(&env, "Translates texts instantly.");
    let api_url = String::from_str(&env, "https://api.translator.ai");
    let price = 100;

    client.register_agent(&owner, &name, &description, &api_url, &price);

    // Rate agent
    client.rate_agent(&owner, &5);
    client.rate_agent(&owner, &4);

    // Verify rating sum and count
    let agent = client.get_agent(&owner).unwrap();
    assert_eq!(agent.rating_sum, 9);
    assert_eq!(agent.rating_count, 2);
}

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
    let description = String::from_str(&env, "Generates AI images.");
    let api_url = String::from_str(&env, "https://api.image.ai");
    client_contract.register_agent(&agent_addr, &name, &description, &api_url, &500);

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

    // Verifikasi total_jobs milik AI Agent bertambah
    let agent = client_contract.get_agent(&agent_addr).unwrap();
    assert_eq!(agent.total_jobs, 1);
}

#[test]
fn test_job_refund_workflow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(AgeroContract, ());
    let client_contract = AgeroContractClient::new(&env, &contract_id);

    let token_admin = Address::generate(&env);
    let token_contract_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_client = token::StellarAssetClient::new(&env, &token_contract_id);
    let token_main_client = token::Client::new(&env, &token_contract_id);

    let client_addr = Address::generate(&env);
    let agent_addr = Address::generate(&env);

    // Mint token untuk Client
    token_client.mint(&client_addr, &1000);

    // Register agent
    let name = String::from_str(&env, "Image Generator");
    let description = String::from_str(&env, "Generates AI images.");
    let api_url = String::from_str(&env, "https://api.image.ai");
    client_contract.register_agent(&agent_addr, &name, &description, &api_url, &500);

    // Test Refund by Client
    let job_id_1 = client_contract.create_job(&client_addr, &agent_addr, &token_contract_id, &500);
    assert_eq!(token_main_client.balance(&client_addr), 500);
    assert_eq!(token_main_client.balance(&contract_id), 500);

    // Refund oleh Client
    client_contract.refund_job(&job_id_1, &client_addr);
    assert_eq!(token_main_client.balance(&client_addr), 1000);
    assert_eq!(token_main_client.balance(&contract_id), 0);

    // Test Refund by Agent Owner
    let job_id_2 = client_contract.create_job(&client_addr, &agent_addr, &token_contract_id, &500);
    assert_eq!(token_main_client.balance(&client_addr), 500);
    assert_eq!(token_main_client.balance(&contract_id), 500);

    // Refund oleh Agent Owner
    client_contract.refund_job(&job_id_2, &agent_addr);
    assert_eq!(token_main_client.balance(&client_addr), 1000);
    assert_eq!(token_main_client.balance(&contract_id), 0);
}

#[test]
#[should_panic(expected = "Amount is less than agent price")]
fn test_job_insufficient_payment() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(AgeroContract, ());
    let client_contract = AgeroContractClient::new(&env, &contract_id);

    let token_admin = Address::generate(&env);
    let token_contract_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_client = token::StellarAssetClient::new(&env, &token_contract_id);

    let client_addr = Address::generate(&env);
    let agent_addr = Address::generate(&env);

    token_client.mint(&client_addr, &1000);

    let name = String::from_str(&env, "Image Generator");
    let description = String::from_str(&env, "Generates AI images.");
    let api_url = String::from_str(&env, "https://api.image.ai");
    client_contract.register_agent(&agent_addr, &name, &description, &api_url, &500);

    // Coba buat pekerjaan dengan dana di bawah harga (400 < 500)
    client_contract.create_job(&client_addr, &agent_addr, &token_contract_id, &400);
}


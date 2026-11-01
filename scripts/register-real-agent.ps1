<#
.SYNOPSIS
    Daftarkan agen nyata "Contract Inspector" (Fase 5a) ke kontrak v2 di Stellar Testnet.

.DESCRIPTION
    Memakai identity stellar CLI yang SUDAH dibuat Umem (default agero-real-agent; skrip ini tidak
    pernah membuat identity dan tidak pernah membaca atau menampilkan secret key).
      1. Baca alamat publik identity.
      2. Danai lewat friendbot hanya bila RPC menyatakan akun belum ada.
      3. get_agent: bila sudah terdaftar, bandingkan nama/deskripsi/harga dan berhenti (idempoten);
         perbedaan hanya diperingatkan, tidak diubah otomatis.
      4. register_agent dengan data Q4: nama "Contract Inspector", harga 1 XLM, deskripsi tetap.
         api_url default kosong: belum ada endpoint publik (fase 5b).
      5. get_agent lagi untuk memastikan data on-chain sama.

    Skrip ini MENGIRIM transaksi Testnet (friendbot bila perlu, dan register_agent sekali).
    Retry hanya untuk error sementara, sama dengan seed-agents.ps1.

.EXAMPLE
    .\scripts\register-real-agent.ps1 -ContractId CA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB
#>
param(
    [Parameter(Mandatory = $true)][string]$ContractId,
    [string]$Identity = "agero-real-agent",
    [string]$Network = "testnet",
    [string]$ApiUrl = "",
    [int]$Retries = 4,
    [int]$BackoffSeconds = 3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "stellar-cli.ps1")

$AgentName = "Contract Inspector"
$AgentDescription = "Contract Inspector: reads a Testnet contract's WASM hash, size and exported functions. Deterministic, no AI."
$PriceXlm = "1"
$PriceStroops = "10000000"

if ($Network -ne "testnet") { throw "Testnet only (got -Network $Network)" }
if ($ContractId -notmatch '^C[A-Z2-7]{55}$') { throw "Not a contract address: $ContractId" }
if ($Retries -lt 1) { throw "-Retries must be at least 1" }
# PowerShell 5.1 meneruskan tanda kutip ganda ke program native dengan salah
if ("$AgentName$AgentDescription$ApiUrl" -match '"') { throw "Agent data must not contain double quotes" }
if ($ApiUrl -match '\s') { throw "-ApiUrl must not contain spaces" }

Write-Host "Contract: $ContractId"
Write-Host "Network:  $Network"
Write-Host "Identity: $Identity"

Write-Host "== 1/4 Identity"
$address = Get-IdentityAddress $Identity
Write-Host "   address  $address"

Write-Host "== 2/4 Funding"
Confirm-Funded $Identity $address

Write-Host "== 3/4 get_agent"
$agent = Get-AgentRecord $Identity $address
if ($null -ne $agent) {
    Write-Host "   already registered: $($agent.name), price $($agent.price) stroops"
    $diff = @()
    if ("$($agent.name)" -ne $AgentName) { $diff += "name" }
    if ("$($agent.description)" -ne $AgentDescription) { $diff += "description" }
    if ("$($agent.price)" -ne $PriceStroops) { $diff += "price" }
    if ($diff.Count -gt 0) {
        Write-Warning "On-chain $($diff -join ', ') differ from the Q4 data; not changed automatically (use update_agent from the Agent dashboard if intended)."
    }
}
else {
    Write-Host "== 4/4 register_agent"
    Invoke-Agero $Identity "default" @(
        "register_agent",
        "--owner", $address,
        "--name", $AgentName,
        "--description", $AgentDescription,
        "--api_url=$ApiUrl",
        "--price", $PriceStroops
    ) -AlreadyDone { $null -ne (Get-AgentRecord $Identity $address) } | Out-Null
    $agent = Get-AgentRecord $Identity $address
    if ($null -eq $agent) { throw "register_agent reported success but get_agent is empty" }
    if ("$($agent.name)" -ne $AgentName -or "$($agent.price)" -ne $PriceStroops) {
        throw "get_agent after register does not match: name '$($agent.name)', price '$($agent.price)'"
    }
    Write-Host "   registered: $AgentName, $PriceXlm XLM ($PriceStroops stroops)"
}

Write-Host ""
Write-Host "REAL AGENT: $address"
Write-Host "Set for the server CLI (public, not secret): `$env:AGERO_AGENT_ADDRESS = '$address'"

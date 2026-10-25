<#
.SYNOPSIS
    Build lalu deploy kontrak Agero v2 ke Stellar Testnet dengan token escrow = XLM native (SAC).

.DESCRIPTION
    1. stellar contract build
    2. Turunkan alamat SAC XLM native: stellar contract id asset --asset native
    3. stellar contract deploy ... -- --token <SAC>   (menjalankan __constructor)
    4. Baca job_count / agent_count (simulasi, tanpa transaksi) sebagai pemeriksaan dasar
    5. Cetak contract ID

    Skrip ini MENGIRIM transaksi deploy dan membayar fee dari identity -Source.
    Skrip tidak pernah membaca atau menampilkan secret key; hanya nama identity yang dipakai.

.PARAMETER Source
    Nama identity stellar CLI (lihat `stellar keys ls`) yang membayar deploy.

.PARAMETER Network
    Nama jaringan di konfigurasi stellar CLI. Default: testnet.

.EXAMPLE
    .\scripts\deploy-testnet.ps1 -Source agero-deployer
#>
param(
    [Parameter(Mandatory = $true)][string]$Source,
    [string]$Network = "testnet"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$manifest = Join-Path $root "contracts/agero-contract/Cargo.toml"
$wasm = Join-Path $root "target/wasm32v1-none/release/agero_contract.wasm"

# Menjalankan stellar CLI dengan argumen array; berhenti bila exit code != 0.
# stdout dikembalikan, stderr (log CLI) tetap tampil di konsol.
function Invoke-Stellar([string[]]$CliArgs) {
    $out = & stellar @CliArgs
    if ($LASTEXITCODE -ne 0) {
        throw "stellar $($CliArgs -join ' ') failed (exit $LASTEXITCODE)"
    }
    return $out
}

function Get-LastLine($out) {
    $lines = @($out) | Where-Object { $_ -ne $null -and "$_".Trim() -ne "" }
    if ($lines.Count -eq 0) { throw "stellar CLI returned no output" }
    return ($lines | Select-Object -Last 1).ToString().Trim().Trim('"')
}

Write-Host "== 1/4 Build contract"
Invoke-Stellar @("contract", "build", "--manifest-path", $manifest) | Out-Null
if (-not (Test-Path $wasm)) { throw "WASM not found: $wasm" }
Write-Host ("   WASM: {0} ({1} bytes)" -f $wasm, (Get-Item $wasm).Length)

Write-Host "== 2/4 Resolve native XLM Stellar Asset Contract on $Network"
$token = Get-LastLine (Invoke-Stellar @("contract", "id", "asset", "--asset", "native", "--network", $Network))
Write-Host "   Token (XLM SAC): $token"

$deployer = Get-LastLine (Invoke-Stellar @("keys", "address", $Source))
Write-Host "   Deployer: $Source ($deployer)"

Write-Host "== 3/4 Deploy + __constructor(token)"
$contractId = Get-LastLine (Invoke-Stellar @(
        "contract", "deploy",
        "--wasm", $wasm,
        "--source-account", $Source,
        "--network", $Network,
        "--", "--token", $token
    ))

Write-Host "== 4/4 Basic read check (simulation only)"
$jobCount = Get-LastLine (Invoke-Stellar @("contract", "invoke", "--id", $contractId, "--source-account", $Source, "--network", $Network, "--send=no", "--", "job_count"))
$agentCount = Get-LastLine (Invoke-Stellar @("contract", "invoke", "--id", $contractId, "--source-account", $Source, "--network", $Network, "--send=no", "--", "agent_count"))
Write-Host "   job_count = $jobCount, agent_count = $agentCount (both should be 0)"

Write-Host ""
Write-Host "CONTRACT ID: $contractId"
Write-Host "Explorer:    https://stellar.expert/explorer/testnet/contract/$contractId"
Write-Host "Next:        .\scripts\smoke-testnet.ps1 -ContractId $contractId -Client <identity> -Agent <identity>"

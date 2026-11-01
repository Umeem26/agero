<#
.SYNOPSIS
    Siapkan Agero di Stellar Testnet dari nol (mis. sesudah reset Testnet): deploy kontrak, seed 11
    agen sampel, daftarkan agen nyata, lalu cetak perubahan env yang perlu.

.DESCRIPTION
    Urutan:
      1. Kontrak: -ContractId bila diberikan; selain itu ID dari berkas status (-StatePath) bila ada;
         selain itu (atau dengan -Fresh) deploy baru lewat deploy-testnet.ps1. ID baru langsung ditulis
         ke berkas status, jadi run ulang tidak men-deploy dua kali. Kontrak dicek dengan agent_count
         (simulasi).
      2. seed-agents.ps1 (idempoten; menulis ringkasan ke docs/deploy.md §7).
      3. register-real-agent.ps1 (idempoten; identity agen nyata dibuat Umem sendiri).
      4. Bandingkan dengan default frontend/src/chain/config.js dan cetak env yang perlu diubah:
         VITE_CONTRACT_ID, VITE_XLM_SAC (hanya bila beda), AGERO_CONTRACT_ID, AGERO_AGENT_ADDRESS,
         plus pengingat env Vercel.

    Skrip ini MENGIRIM transaksi Testnet (deploy, friendbot, register_agent). Tidak pernah membaca,
    menyimpan atau menampilkan secret key; hanya nama identity dan alamat publik.

.PARAMETER Source
    Identity stellar CLI yang membayar deploy.

.PARAMETER DocPath
    Diteruskan ke seed-agents.ps1 (default docs/deploy.md).

.PARAMETER Fresh
    Deploy kontrak baru walaupun berkas status sudah memuat ID (dipakai sesudah reset Testnet).

.EXAMPLE
    .\scripts\bootstrap-testnet.ps1 -Source agero-deployer -Fresh

.EXAMPLE
    .\scripts\bootstrap-testnet.ps1 -Source agero-deployer    # lanjutkan run yang terputus
#>
param(
    [Parameter(Mandatory = $true)][string]$Source,
    [string]$ContractId = "",
    [switch]$Fresh,
    [string]$AgentIdentity = "agero-real-agent",
    [string]$SeedPrefix = "agero-seed",
    [string]$Network = "testnet",
    [string]$StatePath = "",
    [string]$DocPath = "",
    [int]$Retries = 4,
    [int]$BackoffSeconds = 3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "stellar-cli.ps1")

$root = Split-Path -Parent $PSScriptRoot
if ($StatePath -eq "") { $StatePath = Join-Path $root ".agero-bootstrap.json" }
$frontendConfig = Join-Path $root "frontend/src/chain/config.js"

if ($Network -ne "testnet") { throw "Testnet only (got -Network $Network)" }
if ($Retries -lt 1) { throw "-Retries must be at least 1" }
if ($ContractId -ne "" -and $Fresh) { throw "Use either -ContractId or -Fresh, not both" }
if ($ContractId -ne "" -and $ContractId -notmatch '^C[A-Z2-7]{55}$') { throw "Not a contract address: $ContractId" }

function Save-State([string]$Id, [string]$How) {
    $state = [ordered]@{ contractId = $Id; network = $Network; source = $Source; how = $How; date = (Get-Date).ToString("yyyy-MM-dd") }
    [IO.File]::WriteAllText($StatePath, ($state | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))
}

function Get-ConfigDefault([string]$Key) {
    $text = [IO.File]::ReadAllText($frontendConfig, [Text.Encoding]::UTF8)
    $m = [regex]::Match($text, "$Key\s*:\s*'(C[A-Z2-7]{55})'")
    if (-not $m.Success) { throw "$Key default not found in $frontendConfig" }
    return $m.Groups[1].Value
}

# ---- 1. Kontrak ----
Write-Host "== 1/4 Contract"
if ($ContractId -ne "") {
    Write-Host "   using -ContractId $ContractId"
    Save-State $ContractId "given"
}
elseif ((Test-Path $StatePath) -and -not $Fresh) {
    $ContractId = "$((Get-Content -Raw $StatePath | ConvertFrom-Json).contractId)"
    if ($ContractId -notmatch '^C[A-Z2-7]{55}$') { throw "Bad contractId in $StatePath; fix it or run with -Fresh" }
    Write-Host "   reusing $ContractId from $StatePath (use -Fresh after a Testnet reset)"
}
else {
    Write-Host "   deploying a new contract (deploy-testnet.ps1)"
    $lines = @(& (Join-Path $PSScriptRoot "deploy-testnet.ps1") -Source $Source -Network $Network 6>&1 | ForEach-Object { "$_" })
    $lines | ForEach-Object { Write-Host "   > $_" }
    $m = @($lines | Select-String -Pattern '^CONTRACT ID: (C[A-Z2-7]{55})$')
    if ($m.Count -ne 1) { throw "deploy-testnet.ps1 did not print one CONTRACT ID line" }
    $ContractId = $m[0].Matches[0].Groups[1].Value
    Save-State $ContractId "deployed"
    Write-Host "   deployed $ContractId (saved to $StatePath)"
}
try { $r = Invoke-Agero $Source "no" @("agent_count") }
catch { throw "Contract $ContractId did not answer agent_count ($_). After a Testnet reset, run again with -Fresh." }
Write-Host "   agent_count = $(Get-LastLine $r.Out)"

# ---- 2. Agen sampel ----
Write-Host "== 2/4 Seed 11 sample agents"
$seedArgs = @{ ContractId = $ContractId; Network = $Network; Prefix = $SeedPrefix; Retries = $Retries; BackoffSeconds = $BackoffSeconds }
if ($DocPath -ne "") { $seedArgs.DocPath = $DocPath }
& (Join-Path $PSScriptRoot "seed-agents.ps1") @seedArgs

# ---- 3. Agen nyata ----
Write-Host "== 3/4 Real agent"
& (Join-Path $PSScriptRoot "register-real-agent.ps1") -ContractId $ContractId -Identity $AgentIdentity -Network $Network -Retries $Retries -BackoffSeconds $BackoffSeconds
$agentAddress = Get-IdentityAddress $AgentIdentity

# ---- 4. Env ----
Write-Host "== 4/4 Environment changes"
$sac = Get-LastLine (Invoke-Stellar @("contract", "id", "asset", "--asset", "native", "--network", $Network)).Out
if ($sac -notmatch '^C[A-Z2-7]{55}$') { throw "Unexpected XLM SAC address: '$sac'" }
$defaultContract = Get-ConfigDefault "CONTRACT_ID"
$defaultSac = Get-ConfigDefault "XLM_SAC"
$total = Get-LastLine (Invoke-Agero $Source "no" @("agent_count")).Out

Write-Host ""
Write-Host "agent_count = $total (11 sample agents + real agent, plus any others already on this contract)"
Write-Host ""
Write-Host "Frontend (frontend/.env.local and Vercel env, Production + Preview):"
if ($ContractId -eq $defaultContract) { Write-Host "  VITE_CONTRACT_ID=$ContractId   (same as the default in config.js; nothing to change)" }
else { Write-Host "  VITE_CONTRACT_ID=$ContractId   (default in config.js is $defaultContract)" }
if ($sac -ne $defaultSac) { Write-Host "  VITE_XLM_SAC=$sac   (default in config.js is $defaultSac)" }
else { Write-Host "  VITE_XLM_SAC unchanged ($sac)" }
Write-Host ""
Write-Host "Server CLI (frontend/server/cli.mjs; public values only):"
Write-Host "  `$env:AGERO_CONTRACT_ID = '$ContractId'"
Write-Host "  `$env:AGERO_AGENT_ADDRESS = '$agentAddress'"
Write-Host ""
Write-Host "Reminders:"
Write-Host "  - Vercel: change VITE_CONTRACT_ID (and VITE_XLM_SAC if listed) in the project env, then redeploy; Vite bakes VITE_* in at build time."
Write-Host "  - When the default contract changed: update DEFAULTS in frontend/src/chain/config.js, the README contract address and docs/deploy.md section 6."
Write-Host "  - AGERO_AGENT_SECRET is never printed here; set it yourself in your own shell (docs/deploy.md section 12)."

<#
.SYNOPSIS
    Smoke test kontrak Agero v2 di Stellar Testnet lewat stellar CLI.

.DESCRIPTION
    register_agent (dilewati bila agen sudah terdaftar) -> create_job -> deliver_job
    -> complete_job -> rate_agent, lalu cetak get_job, get_agent dan saldo XLM akhir.

    Skrip ini MENGIRIM transaksi testnet: fee dibayar oleh kedua identity, dan -Amount
    stroop XLM berpindah dari -Client ke -Agent. Skrip tidak pernah membaca atau
    menampilkan secret key; hanya nama identity yang dipakai.

.PARAMETER ContractId
    Contract ID hasil deploy-testnet.ps1.

.PARAMETER Client
    Nama identity stellar CLI untuk klien (pembayar job).

.PARAMETER Agent
    Nama identity stellar CLI untuk pemilik agen. Harus berbeda dari -Client.

.PARAMETER Amount
    Jumlah escrow dalam stroop (1 XLM = 10000000). Juga dipakai sebagai harga saat
    register_agent. Default: 10000000 (1 XLM).

.PARAMETER DurationSecs
    Tenggat job dalam detik (3600 .. 2592000). Default: 3600.

.EXAMPLE
    .\scripts\smoke-testnet.ps1 -ContractId C... -Client agero-client -Agent agero-agent
#>
param(
    [Parameter(Mandatory = $true)][string]$ContractId,
    [Parameter(Mandatory = $true)][string]$Client,
    [Parameter(Mandatory = $true)][string]$Agent,
    [string]$Network = "testnet",
    [long]$Amount = 10000000,
    [long]$DurationSecs = 3600
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($Client -eq $Agent) { throw "-Client and -Agent must be different identities (self-deal is rejected by the contract)" }

function Invoke-Stellar([string[]]$CliArgs) {
    $out = & stellar @CliArgs
    if ($LASTEXITCODE -ne 0) {
        throw "stellar $($CliArgs -join ' ') failed (exit $LASTEXITCODE)"
    }
    return $out
}

function Get-LastLine($out) {
    $lines = @($out) | Where-Object { $_ -ne $null -and "$_".Trim() -ne "" }
    if ($lines.Count -eq 0) { return "" }
    return ($lines | Select-Object -Last 1).ToString().Trim().Trim('"')
}

# Panggil fungsi kontrak Agero. -Send "no" = simulasi saja (baca), "default" = kirim bila ada tulis/auth.
function Invoke-Agero([string]$As, [string]$Send, [string[]]$FnArgs) {
    $base = @("contract", "invoke", "--id", $ContractId, "--source-account", $As, "--network", $Network, "--send=$Send", "--")
    return Invoke-Stellar ($base + $FnArgs)
}

$clientAddr = Get-LastLine (Invoke-Stellar @("keys", "address", $Client))
$agentAddr = Get-LastLine (Invoke-Stellar @("keys", "address", $Agent))
$token = Get-LastLine (Invoke-Stellar @("contract", "id", "asset", "--asset", "native", "--network", $Network))

function Get-Balance([string]$Addr) {
    $base = @("contract", "invoke", "--id", $token, "--source-account", $Client, "--network", $Network, "--send=no", "--", "balance", "--id", $Addr)
    return Get-LastLine (Invoke-Stellar $base)
}

Write-Host "Contract: $ContractId"
Write-Host "Client:   $Client ($clientAddr)"
Write-Host "Agent:    $Agent ($agentAddr)"
Write-Host "Token:    $token (native XLM SAC)"
$clientStart = Get-Balance $clientAddr
$agentStart = Get-Balance $agentAddr
Write-Host "Start balances (stroops): client=$clientStart agent=$agentStart"

Write-Host "== 1/5 register_agent"
$existing = Get-LastLine (Invoke-Agero $Client "no" @("get_agent", "--id", $agentAddr))
if ($existing -eq "" -or $existing -eq "null") {
    Invoke-Agero $Agent "default" @(
        "register_agent",
        "--owner", $agentAddr,
        "--name", "Smoke Test Agent",
        "--description", "Agero v2 testnet smoke test",
        "--api_url", "https://example.com/agero-smoke",
        "--price", "$Amount"
    ) | Out-Null
    Write-Host "   registered (price $Amount)"
}
else {
    $price = [decimal](($existing | ConvertFrom-Json).price)
    Write-Host "   already registered (price $price), skipping"
    if ($price -gt $Amount) { $Amount = [long]$price; Write-Host "   using amount = price = $Amount" }
}

Write-Host "== 2/5 create_job"
$jobId = Get-LastLine (Invoke-Agero $Client "default" @(
        "create_job",
        "--client", $clientAddr,
        "--agent_owner", $agentAddr,
        "--amount", "$Amount",
        "--duration_secs", "$DurationSecs"
    ))
Write-Host "   job_id = $jobId"

Write-Host "== 3/5 deliver_job"
$sha = [Security.Cryptography.SHA256]::Create()
$hashBytes = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes("agero smoke result for job $jobId"))
$resultHash = -join ($hashBytes | ForEach-Object { $_.ToString("x2") })
Invoke-Agero $Agent "default" @("deliver_job", "--job_id", $jobId, "--result_hash", $resultHash) | Out-Null
Write-Host "   result_hash = $resultHash"

Write-Host "== 4/5 complete_job"
Invoke-Agero $Client "default" @("complete_job", "--job_id", $jobId) | Out-Null
Write-Host "   done"

Write-Host "== 5/5 rate_agent"
Invoke-Agero $Client "default" @("rate_agent", "--client", $clientAddr, "--job_id", $jobId, "--rating", "5") | Out-Null
Write-Host "   rated 5"

Write-Host ""
Write-Host "get_job($jobId):"
Write-Host (Get-LastLine (Invoke-Agero $Client "no" @("get_job", "--job_id", $jobId)))
Write-Host "get_agent:"
Write-Host (Get-LastLine (Invoke-Agero $Client "no" @("get_agent", "--id", $agentAddr)))

$clientEnd = Get-Balance $clientAddr
$agentEnd = Get-Balance $agentAddr
$contractEnd = Get-Balance $ContractId
Write-Host ""
Write-Host "End balances (stroops):"
Write-Host "   client   = $clientEnd (start $clientStart; expected about -$Amount minus fees)"
Write-Host "   agent    = $agentEnd (start $agentStart; expected about +$Amount minus fees)"
Write-Host "   contract = $contractEnd"

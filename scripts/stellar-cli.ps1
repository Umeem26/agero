<#
.SYNOPSIS
    Hulpfungsi stellar CLI bersama untuk register-real-agent.ps1 dan bootstrap-testnet.ps1.

.DESCRIPTION
    Di-dot-source (". $PSScriptRoot\stellar-cli.ps1"); memakai variabel skrip pemanggil
    $Retries, $BackoffSeconds, $Network dan (untuk Invoke-Agero) $ContractId.
    Logika retry sama dengan seed-agents.ps1: hanya error sementara (SendRequest, timeout, koneksi
    putus, 429, 5xx) yang diulang; error kontrak/host tidak pernah diulang. Tidak pernah memanggil
    perintah yang menampilkan secret (mis. `stellar keys show`).
#>

$TransientPattern = '(?i)SendRequest|client error \((Connect|Timeout)\)|error sending request|timed out|timeout|connection (reset|closed|refused|aborted)|broken pipe|too many requests|rate limit|\b429\b|\b50[0-4]\b|bad gateway|service unavailable|gateway timeout|internal server error|TRY_AGAIN_LATER'
$PermanentPattern = 'Error\(Contract|HostError|Failed to find config identity'

# Satu panggilan stellar tanpa berhenti saat gagal; stdout dan stderr ditangkap terpisah.
function Invoke-StellarOnce([string[]]$CliArgs) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $all = @(& stellar @CliArgs 2>&1)
        $code = $LASTEXITCODE
    }
    finally { $ErrorActionPreference = $prev }
    $out = @($all | Where-Object { $_ -isnot [Management.Automation.ErrorRecord] } | ForEach-Object { "$_" })
    $err = @($all | Where-Object { $_ -is [Management.Automation.ErrorRecord] } | ForEach-Object { "$_" })
    return [pscustomobject]@{ Code = $code; Out = $out; Err = $err; Landed = $false }
}

function Test-Transient([string]$Text) {
    if ($Text -match $PermanentPattern) { return $false }
    return ($Text -match $TransientPattern)
}

function Get-ErrorLine($r) {
    $lines = @(@($r.Err + $r.Out) | Where-Object { "$_" -match 'error' -and "$_" -notmatch 'new release' })
    if ($lines.Count -eq 0) { return "exit $($r.Code)" }
    return $lines[-1].ToString().Trim()
}

# Retry+backoff hanya untuk error sementara.
#   -AllowFailure : error permanen dikembalikan (Code != 0) alih-alih menghentikan skrip.
#   -AlreadyDone  : untuk transaksi; dicek sebelum mengirim ulang karena percobaan yang "gagal" karena
#                   jaringan bisa saja sudah masuk ledger. Bila $true, hasil ditandai Landed.
function Invoke-Stellar([string[]]$CliArgs, [switch]$AllowFailure, [scriptblock]$AlreadyDone = $null) {
    for ($attempt = 1; ; $attempt++) {
        $r = Invoke-StellarOnce $CliArgs
        if ($r.Code -eq 0) { return $r }
        $transient = Test-Transient (@($r.Err + $r.Out) -join "`n")
        if ($transient -and $attempt -lt $Retries) {
            $wait = [int]($BackoffSeconds * [math]::Pow(2, $attempt - 1))
            Write-Host "   transient error: $(Get-ErrorLine $r); attempt $attempt/$Retries, retrying in $wait s"
            Start-Sleep -Seconds $wait
            if ($null -ne $AlreadyDone -and (& $AlreadyDone)) {
                Write-Host "   previous attempt had already landed"
                $r.Landed = $true
                return $r
            }
            continue
        }
        if ($AllowFailure -and -not $transient) { return $r }
        Write-Host "   stellar output (exit $($r.Code)):"
        @($r.Err + $r.Out) | ForEach-Object { Write-Host "   | $_" }
        if ($transient) { $kind = "transient error persisted after $attempt attempt(s)" }
        else { $kind = "permanent error (not retried)" }
        throw "stellar $($CliArgs[0..1] -join ' ') failed: $kind"
    }
}

function Get-LastLine($out) {
    $lines = @(@($out) | Where-Object { $_ -ne $null -and "$_".Trim() -ne "" })
    if ($lines.Count -eq 0) { return "" }
    return $lines[-1].ToString().Trim().Trim('"')
}

# Akun ada bila RPC mengembalikan entri akunnya; error RPC tidak pernah berarti "belum didanai".
function Test-Funded([string]$Address) {
    $r = Invoke-Stellar @("ledger", "entry", "fetch", "account", "--account", $Address, "--network", $Network)
    $json = Get-LastLine $r.Out
    $parsed = $null
    try { $parsed = $json | ConvertFrom-Json } catch { $parsed = $null }
    if ($null -eq $parsed -or -not ($parsed.PSObject.Properties.Name -contains "entries")) {
        throw "Unexpected account lookup output for ${Address}: '$json'"
    }
    return (@($parsed.entries).Count -gt 0)
}

# Danai lewat friendbot hanya bila akun belum ada; tunggu sampai terlihat di RPC.
function Confirm-Funded([string]$Identity, [string]$Address) {
    if (Test-Funded $Address) { Write-Host "   account already funded"; return }
    $r = Invoke-Stellar @("keys", "fund", $Identity, "--network", $Network) -AllowFailure -AlreadyDone { Test-Funded $Address }
    if ($r.Code -ne 0 -and -not $r.Landed -and -not (Test-Funded $Address)) {
        @($r.Err + $r.Out) | ForEach-Object { Write-Host "   | $_" }
        throw "Friendbot refused to fund $Identity ($Address)"
    }
    $visible = $false
    for ($p = 1; $p -le $Retries -and -not $visible; $p++) {
        $visible = Test-Funded $Address
        if (-not $visible -and $p -lt $Retries) { Start-Sleep -Seconds $BackoffSeconds }
    }
    if (-not $visible) { throw "Friendbot reported success but $Address is not visible on $Network" }
    Write-Host "   funded via friendbot"
}

# Alamat publik identity yang sudah ada; tidak pernah membuat identity baru.
function Get-IdentityAddress([string]$Identity) {
    $r = Invoke-Stellar @("keys", "address", $Identity) -AllowFailure
    if ($r.Code -ne 0) {
        if ((@($r.Err + $r.Out) -join "`n") -match 'Failed to find config identity') {
            throw "Identity '$Identity' does not exist. Create it yourself first: stellar keys generate $Identity"
        }
        @($r.Err + $r.Out) | ForEach-Object { Write-Host "   | $_" }
        throw "Could not read identity $Identity"
    }
    $address = Get-LastLine $r.Out
    if ($address -notmatch '^G[A-Z2-7]{55}$') { throw "Unexpected address for ${Identity}: '$address'" }
    return $address
}

function Invoke-Agero([string]$As, [string]$Send, [string[]]$FnArgs, [scriptblock]$AlreadyDone = $null) {
    $base = @("contract", "invoke", "--id", $ContractId, "--source-account", $As, "--network", $Network, "--send=$Send", "--")
    return Invoke-Stellar ($base + $FnArgs) -AlreadyDone $AlreadyDone
}

# get_agent -> objek (name, description, price, ...) atau $null bila belum terdaftar
function Get-AgentRecord([string]$As, [string]$Address) {
    $json = Get-LastLine (Invoke-Agero $As "no" @("get_agent", "--id", $Address)).Out
    if ($json -eq "" -or $json -eq "null") { return $null }
    try { return ($json | ConvertFrom-Json) } catch { throw "Unexpected get_agent output for ${Address}: '$json'" }
}

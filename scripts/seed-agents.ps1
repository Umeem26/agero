<#
.SYNOPSIS
    Daftarkan 11 agen sampel Agero ke kontrak v2 di Stellar Testnet lewat stellar CLI.

.DESCRIPTION
    Untuk setiap agen di frontend/src/data/sample-agents.json (urutan file = nomor 01..11):
      1. Buat identity stellar CLI <Prefix>-NN bila belum ada (kunci disimpan di keystore CLI).
      2. Danai lewat friendbot hanya bila RPC menyatakan akun belum ada di jaringan.
      3. register_agent dengan nama dan harga dari data sampel. Deskripsi on-chain diawali
         "Sample agent - " dan api_url menunjuk ke placeholder https://example.invalid/...
         (domain .invalid tidak pernah ada), jadi tidak ada klaim layanan yang tidak ada.
    Idempoten: identity yang ada dipakai ulang, akun yang sudah ada tidak didanai ulang, dan agen
    yang sudah terdaftar dilewati.

    Ketahanan: setiap panggilan stellar diulang dengan backoff (BackoffSeconds x 1, 2, 4, ...) hanya
    bila errornya sementara (SendRequest, timeout, koneksi putus, 429, 5xx). Error lain (kontrak
    menolak, argumen salah) tidak diulang dan menghentikan skrip. Error RPC saat cek akun tidak
    pernah dianggap "belum didanai". Sebelum mengirim ulang register_agent/friendbot, skrip
    memeriksa dulu apakah percobaan sebelumnya ternyata sudah masuk.

    Skrip ini MENGIRIM transaksi testnet (fee register_agent dibayar setiap identity seed).
    Skrip hanya mencetak alamat publik; secret key tidak pernah dibaca, disimpan, atau ditampilkan.
    Di akhir, ringkasan (alamat publik + tanggal) ditulis ke -DocPath di antara penanda
    <!-- seed-agents:start --> dan <!-- seed-agents:end --> (tidak ditulis bila -Only dipakai).

.PARAMETER ContractId
    Contract ID kontrak v2 (lihat docs/deploy.md bagian 6).

.PARAMETER Prefix
    Awalan nama identity. Default: agero-seed (menjadi agero-seed-01 .. agero-seed-11).

.PARAMETER Retries
    Jumlah percobaan total per panggilan stellar untuk error sementara. Default 4 (jeda 3, 6, 12 detik).

.PARAMETER Only
    Nomor agen (1..11) yang diproses; default semua. Untuk mencoba ulang satu agen saja.

.EXAMPLE
    .\scripts\seed-agents.ps1 -ContractId CA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB

.EXAMPLE
    .\scripts\seed-agents.ps1 -ContractId CA5C... -Only 6 -Retries 1
#>
param(
    [Parameter(Mandatory = $true)][string]$ContractId,
    [string]$Network = "testnet",
    [string]$Prefix = "agero-seed",
    [string]$DataFile = "",
    [string]$DocPath = "",
    [int]$Retries = 4,
    [int]$BackoffSeconds = 3,
    [int]$AgentDelaySeconds = 3,
    [int[]]$Only = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
if ($DataFile -eq "") { $DataFile = Join-Path $root "frontend/src/data/sample-agents.json" }
if ($DocPath -eq "") { $DocPath = Join-Path $root "docs/deploy.md" }
if ($Retries -lt 1) { throw "-Retries must be at least 1" }

$DescriptionPrefix = "Sample agent - "
$PlaceholderBase = "https://example.invalid/agero-sample"
$StroopsPerXlm = [decimal]10000000

# Error sementara dari RPC, friendbot, atau jaringan. Error kontrak/host selalu permanen.
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

# Panggil stellar dengan retry+backoff hanya untuk error sementara.
#   -AllowFailure : error permanen dikembalikan ke pemanggil (Code != 0) alih-alih menghentikan skrip.
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
        throw "stellar $($CliArgs -join ' ') failed: $kind"
    }
}

function Get-LastLine($out) {
    $lines = @(@($out) | Where-Object { $_ -ne $null -and "$_".Trim() -ne "" })
    if ($lines.Count -eq 0) { return "" }
    return $lines[-1].ToString().Trim().Trim('"')
}

# Akun ada bila RPC mengembalikan entri akunnya; daftar kosong berarti belum ada (boleh friendbot).
# Error RPC tidak pernah berarti "belum didanai": Invoke-Stellar mengulang lalu menghentikan skrip.
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

function Invoke-Agero([string]$As, [string]$Send, [string[]]$FnArgs, [scriptblock]$AlreadyDone = $null) {
    $base = @("contract", "invoke", "--id", $ContractId, "--source-account", $As, "--network", $Network, "--send=$Send", "--")
    return Invoke-Stellar ($base + $FnArgs) -AlreadyDone $AlreadyDone
}

function Test-Registered([string]$As, [string]$Address) {
    $existing = Get-LastLine (Invoke-Agero $As "no" @("get_agent", "--id", $Address)).Out
    return -not ($existing -eq "" -or $existing -eq "null")
}

function ConvertTo-Stroops([string]$Xlm) {
    $value = [decimal]::Parse($Xlm, [Globalization.CultureInfo]::InvariantCulture)
    $stroops = $value * $StroopsPerXlm
    if ($stroops -le 0 -or $stroops -ne [decimal]::Truncate($stroops)) { throw "Invalid XLM price: $Xlm" }
    return [long]$stroops
}

# ---- Data sampel ----
# PowerShell 5.1: ConvertFrom-Json emits a JSON array as one object, so assign first, then wrap
$parsed = [IO.File]::ReadAllText($DataFile, [Text.Encoding]::UTF8) | ConvertFrom-Json
$agents = @($parsed)
if ($agents.Count -eq 0) { throw "No agents in $DataFile" }
foreach ($a in $agents) {
    # PowerShell 5.1 meneruskan tanda kutip ganda ke program native dengan salah
    if ("$($a.name)$($a.description)" -match '"') { throw "Agent '$($a.name)' contains a double quote; remove it from $DataFile" }
}
$numbers = @(1..$agents.Count)
if ($Only.Count -gt 0) {
    foreach ($n in $Only) { if ($n -lt 1 -or $n -gt $agents.Count) { throw "-Only $n is outside 1..$($agents.Count)" } }
    $numbers = @($Only | Sort-Object -Unique)
}

Write-Host "Contract: $ContractId"
Write-Host "Network:  $Network"
Write-Host "Agents:   $($numbers.Count) of $($agents.Count) from $DataFile"
Write-Host "Retries:  $Retries attempts per call, backoff from $BackoffSeconds s; $AgentDelaySeconds s between agents"

$rows = @()
for ($k = 0; $k -lt $numbers.Count; $k++) {
    $no = $numbers[$k]
    $a = $agents[$no - 1]
    $identity = "{0}-{1:D2}" -f $Prefix, $no
    $price = ConvertTo-Stroops $a.price_xlm
    if ($k -gt 0) { Start-Sleep -Seconds $AgentDelaySeconds }
    Write-Host ""
    Write-Host ("== {0}/{1} {2} ({3})" -f $no, $agents.Count, $identity, $a.name)

    # 1. Identity (lokal; "tidak ditemukan" berarti buat baru, error lain menghentikan skrip)
    $r = Invoke-Stellar @("keys", "address", $identity) -AllowFailure
    if ($r.Code -eq 0) {
        Write-Host "   identity exists"
    }
    elseif ((@($r.Err + $r.Out) -join "`n") -match 'Failed to find config identity') {
        Invoke-Stellar @("keys", "generate", $identity) | Out-Null
        $r = Invoke-Stellar @("keys", "address", $identity)
        Write-Host "   identity created"
    }
    else {
        @($r.Err + $r.Out) | ForEach-Object { Write-Host "   | $_" }
        throw "Could not read identity $identity"
    }
    $address = Get-LastLine $r.Out
    if ($address -notmatch '^G[A-Z2-7]{55}$') { throw "Unexpected address for ${identity}: '$address'" }
    Write-Host "   address  $address"

    # 2. Friendbot, hanya bila RPC menyatakan akun belum ada
    if (Test-Funded $address) {
        Write-Host "   account already funded"
    }
    else {
        $r = Invoke-Stellar @("keys", "fund", $identity, "--network", $Network) -AllowFailure -AlreadyDone { Test-Funded $address }
        # Friendbot menolak (mis. akun ternyata sudah dibuat); lanjut hanya bila akunnya memang ada
        if ($r.Code -ne 0 -and -not $r.Landed -and -not (Test-Funded $address)) {
            @($r.Err + $r.Out) | ForEach-Object { Write-Host "   | $_" }
            throw "Friendbot refused to fund $identity ($address)"
        }
        $visible = $false
        for ($p = 1; $p -le $Retries -and -not $visible; $p++) {
            $visible = Test-Funded $address
            if (-not $visible -and $p -lt $Retries) { Start-Sleep -Seconds $BackoffSeconds }
        }
        if (-not $visible) { throw "Friendbot reported success but $address is not visible on $Network" }
        Write-Host "   funded via friendbot"
    }

    # 3. register_agent (lewati bila sudah terdaftar)
    if (Test-Registered $identity $address) {
        $status = "already registered"
    }
    else {
        $r = Invoke-Agero $identity "default" @(
            "register_agent",
            "--owner", $address,
            "--name", $a.name,
            "--description", ($DescriptionPrefix + $a.description),
            "--api_url", ("{0}/{1}" -f $PlaceholderBase, $a.slug),
            "--price", "$price"
        ) -AlreadyDone { Test-Registered $identity $address }
        $status = "registered"
    }
    Write-Host "   $status (price $($a.price_xlm) XLM = $price stroops)"

    $rows += [pscustomobject]@{ No = $no; Identity = $identity; Address = $address; Name = $a.name; PriceXlm = $a.price_xlm; Status = $status }
}

$count = Get-LastLine (Invoke-Agero ("{0}-{1:D2}" -f $Prefix, $numbers[0]) "no" @("agent_count")).Out
Write-Host ""
Write-Host "agent_count on contract = $count"
$rows | Format-Table No, Identity, Address, Name, PriceXlm, Status -AutoSize | Out-String | Write-Host

if ($Only.Count -gt 0) {
    Write-Host "-Only was used: $DocPath not updated (run without -Only to write the full summary)"
    return
}

# ---- Ringkasan ke docs/deploy.md ----
$date = (Get-Date).ToString("yyyy-MM-dd")
$nl = "`n"
$section = "<!-- seed-agents:start -->$nl"
$section += "Terakhir dijalankan: $date, kontrak ``$ContractId``, jaringan ``$Network``. ``agent_count`` sesudahnya: $count ($($rows.Count) agen seed di tabel ini; selisihnya agen lain di kontrak, mis. agen smoke test).$nl$nl"
$section += "| # | Identity | Alamat publik | Nama | Harga (XLM) |$nl|---|---|---|---|---|$nl"
foreach ($r in $rows) {
    $section += "| $($r.No) | ``$($r.Identity)`` | ``$($r.Address)`` | $($r.Name) | $($r.PriceXlm) |$nl"
}
$section += "<!-- seed-agents:end -->"

$doc = [IO.File]::ReadAllText($DocPath, [Text.Encoding]::UTF8)
$pattern = '(?s)<!-- seed-agents:start -->.*?<!-- seed-agents:end -->'
if ($doc -notmatch $pattern) { throw "Markers <!-- seed-agents:start/end --> not found in $DocPath" }
if ($doc.Contains("`r`n")) { $section = $section.Replace("`n", "`r`n") }
$doc = [regex]::Replace($doc, $pattern, { param($m) $section })
[IO.File]::WriteAllText($DocPath, $doc, (New-Object Text.UTF8Encoding $false))
Write-Host "Summary written to $DocPath"

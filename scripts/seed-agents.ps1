<#
.SYNOPSIS
    Daftarkan 11 agen sampel Agero ke kontrak v2 di Stellar Testnet lewat stellar CLI.

.DESCRIPTION
    Untuk setiap agen di frontend/src/data/sample-agents.json (urutan file = nomor 01..11):
      1. Buat identity stellar CLI <Prefix>-NN bila belum ada (kunci disimpan di keystore CLI).
      2. Danai lewat friendbot bila akun belum ada di jaringan (retry dengan jeda).
      3. register_agent dengan nama dan harga dari data sampel. Deskripsi on-chain diawali
         "Sample agent - " dan api_url menunjuk ke placeholder https://example.invalid/...
         (domain .invalid tidak pernah ada), jadi tidak ada klaim layanan yang tidak ada.
    Idempoten: identity yang ada dipakai ulang, akun yang sudah ada tidak didanai ulang, dan agen
    yang sudah terdaftar dilewati.

    Skrip ini MENGIRIM transaksi testnet (fee register_agent dibayar setiap identity seed).
    Skrip hanya mencetak alamat publik; secret key tidak pernah dibaca, disimpan, atau ditampilkan.
    Di akhir, ringkasan (alamat publik + tanggal) ditulis ke -DocPath di antara penanda
    <!-- seed-agents:start --> dan <!-- seed-agents:end -->.

.PARAMETER ContractId
    Contract ID kontrak v2 (lihat docs/deploy.md bagian 6).

.PARAMETER Prefix
    Awalan nama identity. Default: agero-seed (menjadi agero-seed-01 .. agero-seed-11).

.EXAMPLE
    .\scripts\seed-agents.ps1 -ContractId CA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB
#>
param(
    [Parameter(Mandatory = $true)][string]$ContractId,
    [string]$Network = "testnet",
    [string]$Prefix = "agero-seed",
    [string]$DataFile = "",
    [string]$DocPath = "",
    [int]$FundRetries = 4
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
if ($DataFile -eq "") { $DataFile = Join-Path $root "frontend/src/data/sample-agents.json" }
if ($DocPath -eq "") { $DocPath = Join-Path $root "docs/deploy.md" }

$DescriptionPrefix = "Sample agent - "
$PlaceholderBase = "https://example.invalid/agero-sample"
$StroopsPerXlm = [decimal]10000000

function Invoke-Stellar([string[]]$CliArgs) {
    $out = & stellar @CliArgs
    if ($LASTEXITCODE -ne 0) {
        throw "stellar $($CliArgs -join ' ') failed (exit $LASTEXITCODE)"
    }
    return $out
}

# Jalankan stellar CLI tanpa berhenti saat gagal; kembalikan $true bila exit code 0.
# stderr ditelan di sini karena kegagalan memang diharapkan (mis. identity belum ada).
function Test-Stellar([string[]]$CliArgs) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { $null = & stellar @CliArgs 2>&1 } finally { $ErrorActionPreference = $prev }
    return ($LASTEXITCODE -eq 0)
}

function Get-LastLine($out) {
    $lines = @(@($out) | Where-Object { $_ -ne $null -and "$_".Trim() -ne "" })
    if ($lines.Count -eq 0) { return "" }
    return $lines[-1].ToString().Trim().Trim('"')
}

$token = Get-LastLine (Invoke-Stellar @("contract", "id", "asset", "--asset", "native", "--network", $Network))
if ($token -eq "") { throw "Could not resolve the native XLM asset contract on $Network" }

# Akun ada di jaringan bila simulasi balance dengan akun itu sebagai source berhasil (tanpa transaksi).
function Test-Funded([string]$Identity, [string]$Address) {
    return Test-Stellar @("contract", "invoke", "--id", $token, "--source-account", $Identity, "--network", $Network, "--send=no", "--", "balance", "--id", $Address)
}

function Invoke-Agero([string]$As, [string]$Send, [string[]]$FnArgs) {
    $base = @("contract", "invoke", "--id", $ContractId, "--source-account", $As, "--network", $Network, "--send=$Send", "--")
    return Invoke-Stellar ($base + $FnArgs)
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

Write-Host "Contract: $ContractId"
Write-Host "Network:  $Network"
Write-Host "Token:    $token (native XLM SAC)"
Write-Host "Agents:   $($agents.Count) from $DataFile"

$rows = @()
for ($i = 0; $i -lt $agents.Count; $i++) {
    $a = $agents[$i]
    $identity = "{0}-{1:D2}" -f $Prefix, ($i + 1)
    $price = ConvertTo-Stroops $a.price_xlm
    Write-Host ""
    Write-Host ("== {0}/{1} {2} ({3})" -f ($i + 1), $agents.Count, $identity, $a.name)

    # 1. Identity
    if (Test-Stellar @("keys", "address", $identity)) {
        Write-Host "   identity exists"
    }
    else {
        Invoke-Stellar @("keys", "generate", $identity) | Out-Null
        Write-Host "   identity created"
    }
    $address = Get-LastLine (Invoke-Stellar @("keys", "address", $identity))
    if ($address -notmatch '^G[A-Z2-7]{55}$') { throw "Unexpected address for ${identity}: '$address'" }
    Write-Host "   address  $address"

    # 2. Friendbot (retry dengan jeda bertambah)
    if (Test-Funded $identity $address) {
        Write-Host "   account already funded"
    }
    else {
        $funded = $false
        for ($attempt = 1; $attempt -le $FundRetries -and -not $funded; $attempt++) {
            if (Test-Stellar @("keys", "fund", $identity, "--network", $Network)) {
                Start-Sleep -Seconds 2
                $funded = Test-Funded $identity $address
            }
            if (-not $funded -and $attempt -lt $FundRetries) {
                $wait = 5 * $attempt
                Write-Host "   friendbot attempt $attempt failed, retrying in $wait s"
                Start-Sleep -Seconds $wait
            }
        }
        if (-not $funded) { throw "Friendbot funding failed for $identity ($address) after $FundRetries attempts" }
        Write-Host "   funded via friendbot"
    }

    # 3. register_agent (lewati bila sudah terdaftar)
    $existing = Get-LastLine (Invoke-Agero $identity "no" @("get_agent", "--id", $address))
    if ($existing -eq "" -or $existing -eq "null") {
        Invoke-Agero $identity "default" @(
            "register_agent",
            "--owner", $address,
            "--name", $a.name,
            "--description", ($DescriptionPrefix + $a.description),
            "--api_url", ("{0}/{1}" -f $PlaceholderBase, $a.slug),
            "--price", "$price"
        ) | Out-Null
        $status = "registered"
    }
    else {
        $status = "already registered"
    }
    Write-Host "   $status (price $($a.price_xlm) XLM = $price stroops)"

    $rows += [pscustomobject]@{ No = $i + 1; Identity = $identity; Address = $address; Name = $a.name; PriceXlm = $a.price_xlm; Status = $status }
    Start-Sleep -Seconds 1
}

$count = Get-LastLine (Invoke-Agero ("{0}-01" -f $Prefix) "no" @("agent_count"))
Write-Host ""
Write-Host "agent_count on contract = $count"
$rows | Format-Table No, Identity, Address, Name, PriceXlm, Status -AutoSize | Out-String | Write-Host

# ---- Ringkasan ke docs/deploy.md ----
$date = (Get-Date).ToString("yyyy-MM-dd")
$nl = "`n"
$section = "<!-- seed-agents:start -->$nl"
$section += "Terakhir dijalankan: $date, kontrak ``$ContractId``, jaringan ``$Network``. ``agent_count`` sesudahnya: $count.$nl$nl"
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

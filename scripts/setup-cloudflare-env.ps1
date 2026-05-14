#requires -Version 5.1
<#
.SYNOPSIS
  Configure Cloudflare Worker secrets for muhra1 via Wrangler.

.DESCRIPTION
  Interactively sets Worker secrets (stdin piped to wrangler secret put).
  Supabase project URLs live in wrangler.jsonc vars; this script does not change them.

.NOTES
  Prerequisites:
    - Node.js + npm in PATH
    - Global Wrangler optional: npm i -g wrangler; otherwise npx is used
    - One-time: wrangler login (or npx wrangler login)
  Run from repo root, for example:
    powershell -NoProfile -File .\scripts\setup-cloudflare-env.ps1
#>

[CmdletBinding()]
param(
  [string]$WorkerName = 'muhra1'
)

$ErrorActionPreference = 'Stop'

function New-HexRandomString {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Length
  )
  $sb = New-Object System.Text.StringBuilder
  while ($sb.Length -lt $Length) {
    [void]$sb.Append([guid]::NewGuid().ToString('N'))
  }
  return $sb.ToString().Substring(0, $Length)
}

function ConvertFrom-SecureStringPlain {
  param(
    [Parameter(Mandatory = $true)]
    [System.Security.SecureString]$SecureString
  )
  if ($null -eq $SecureString) {
    return ''
  }
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringUni($bstr)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Initialize-WranglerInvoker {
  if (Get-Command wrangler -ErrorAction SilentlyContinue) {
    $script:WranglerUseNpx = $false
    return $true
  }
  if (Get-Command npx -ErrorAction SilentlyContinue) {
    $script:WranglerUseNpx = $true
    return $true
  }
  return $false
}

function Invoke-Wrangler {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )
  if ($script:WranglerUseNpx) {
    & npx --yes wrangler @Arguments
  }
  else {
    & wrangler @Arguments
  }
}

function Test-WranglerAvailable {
  $versionText = $null
  try {
    $versionText = (Invoke-Wrangler @('--version') 2>&1 | Out-String).Trim()
  }
  catch {
    Write-Host '[ERR] Could not run wrangler.' -ForegroundColor Red
    Write-Host '      Install: npm install -g wrangler' -ForegroundColor Yellow
    Write-Host '      Or ensure Node/npm is installed so npx can run wrangler.' -ForegroundColor Yellow
    return $false
  }
  if ($LASTEXITCODE -ne 0) {
    Write-Host '[ERR] wrangler --version failed.' -ForegroundColor Red
    Write-Host '      Install: npm install -g wrangler' -ForegroundColor Yellow
    Write-Host '      Or ensure Node/npm is installed so npx can run wrangler.' -ForegroundColor Yellow
    return $false
  }
  if ($script:WranglerUseNpx) {
    Write-Host '[OK] Wrangler via npx is available.' -ForegroundColor Green
  }
  else {
    Write-Host '[OK] Wrangler is available (global).' -ForegroundColor Green
  }
  if ($versionText) {
    Write-Host ('    ' + $versionText) -ForegroundColor Gray
  }
  return $true
}

function Test-WranglerLoggedIn {
  $whoami = $null
  try {
    $whoami = (Invoke-Wrangler @('whoami') 2>&1 | Out-String)
  }
  catch {
    Write-Host '[ERR] Could not verify Wrangler login state.' -ForegroundColor Red
    return $false
  }
  if ($LASTEXITCODE -ne 0) {
    Write-Host '[ERR] wrangler whoami failed.' -ForegroundColor Red
    Write-Host '      Run: wrangler login' -ForegroundColor Yellow
    if ($script:WranglerUseNpx) {
      Write-Host '      Or:  npx wrangler login' -ForegroundColor Yellow
    }
    return $false
  }
  if ($whoami -match 'You are logged in') {
    Write-Host '[OK] Wrangler is logged in.' -ForegroundColor Green
    return $true
  }
  Write-Host '[ERR] Wrangler is not logged in.' -ForegroundColor Red
  Write-Host '      Run: wrangler login' -ForegroundColor Yellow
  if ($script:WranglerUseNpx) {
    Write-Host '      Or:  npx wrangler login' -ForegroundColor Yellow
  }
  return $false
}

function Read-SecureStringWithOptionalDefault {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Prompt,
    [string]$DefaultPlain = ''
  )
  if ($DefaultPlain) {
    $secure = Read-Host -Prompt ($Prompt + ' [Enter = use generated default]') -AsSecureString
  }
  else {
    $secure = Read-Host -Prompt $Prompt -AsSecureString
  }
  $plain = ConvertFrom-SecureStringPlain -SecureString $secure
  if ([string]::IsNullOrEmpty($plain) -and $DefaultPlain) {
    return $DefaultPlain
  }
  return $plain
}

function Set-WorkerSecret {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$Value
  )
  Write-Host ("  Uploading secret: " + $Name) -ForegroundColor Cyan
  if ($script:WranglerUseNpx) {
    $Value | & npx --yes wrangler secret put $Name --name $WorkerName
  }
  else {
    $Value | & wrangler secret put $Name --name $WorkerName
  }
  if ($LASTEXITCODE -ne 0) {
    throw ("Failed to set secret: " + $Name)
  }
  Write-Host ("  OK: " + $Name) -ForegroundColor Green
}

# ---------- Main ----------

Write-Host ''
Write-Host '=== MUHRA1 Cloudflare secret setup ===' -ForegroundColor Magenta
Write-Host ''

if (-not (Initialize-WranglerInvoker)) {
  Write-Host '[ERR] Neither wrangler nor npx was found in PATH.' -ForegroundColor Red
  exit 1
}

if (-not (Test-WranglerAvailable)) {
  exit 1
}

if (-not (Test-WranglerLoggedIn)) {
  exit 1
}

Write-Host ''
Write-Host 'Get SUPABASE_SERVICE_ROLE_KEY from Supabase Dashboard: Settings, API, service_role.' -ForegroundColor Yellow
Write-Host 'Dashboard path (example): project settings then API.' -ForegroundColor DarkGray

$srSecure = Read-Host -Prompt 'SUPABASE_SERVICE_ROLE_KEY' -AsSecureString
$serviceRole = ConvertFrom-SecureStringPlain -SecureString $srSecure
if ([string]::IsNullOrWhiteSpace($serviceRole)) {
  Write-Host '[ERR] SUPABASE_SERVICE_ROLE_KEY is required.' -ForegroundColor Red
  exit 1
}

$defaultCookieSecret = New-HexRandomString -Length 32
Write-Host ''
Write-Host 'STAFF_COOKIE_SECRET (at least 16 characters).' -ForegroundColor Yellow
Write-Host ('  Generated default length: ' + $defaultCookieSecret.Length.ToString()) -ForegroundColor DarkGray
$cookieSecret = Read-SecureStringWithOptionalDefault -Prompt 'STAFF_COOKIE_SECRET' -DefaultPlain $defaultCookieSecret
if ($cookieSecret.Length -lt 16) {
  Write-Host '[ERR] STAFF_COOKIE_SECRET must be at least 16 characters.' -ForegroundColor Red
  exit 1
}

Write-Host ''
$staffUsername = Read-Host -Prompt 'STAFF_USERNAME [Enter = staff]'
if ([string]::IsNullOrWhiteSpace($staffUsername)) {
  $staffUsername = 'staff'
}

$defaultPwd = New-HexRandomString -Length 16
Write-Host ''
Write-Host 'STAFF_PASSWORD (at least 12 characters).' -ForegroundColor Yellow
Write-Host ('  Generated default length: ' + $defaultPwd.Length.ToString()) -ForegroundColor DarkGray
$staffPassword = Read-SecureStringWithOptionalDefault -Prompt 'STAFF_PASSWORD' -DefaultPlain $defaultPwd
if ($staffPassword.Length -lt 12) {
  Write-Host '[ERR] STAFF_PASSWORD must be at least 12 characters.' -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host ('About to push secrets to Worker "' + $WorkerName + '" on Cloudflare:') -ForegroundColor Magenta
Write-Host '  - SUPABASE_SERVICE_ROLE_KEY (secret)' -ForegroundColor White
Write-Host '  - STAFF_COOKIE_SECRET (secret)' -ForegroundColor White
Write-Host '  - STAFF_USERNAME (secret)' -ForegroundColor White
Write-Host '  - STAFF_PASSWORD (secret)' -ForegroundColor White
Write-Host ''
Write-Host 'SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL are not set here (wrangler.jsonc vars).' -ForegroundColor DarkGray
Write-Host ''

$go = Read-Host -Prompt 'Proceed? (y/N)'
if ($go -ne 'y' -and $go -ne 'Y') {
  Write-Host 'Cancelled.' -ForegroundColor Yellow
  exit 0
}

Write-Host ''
Write-Host 'Setting secrets...' -ForegroundColor Cyan
Set-WorkerSecret -Name 'SUPABASE_SERVICE_ROLE_KEY' -Value $serviceRole
Set-WorkerSecret -Name 'STAFF_COOKIE_SECRET' -Value $cookieSecret
Set-WorkerSecret -Name 'STAFF_USERNAME' -Value $staffUsername
Set-WorkerSecret -Name 'STAFF_PASSWORD' -Value $staffPassword

Write-Host ''
Write-Host '[OK] Done.' -ForegroundColor Green
Write-Host '  Next build/deploy (from repo):' -ForegroundColor Yellow
Write-Host '    npm run build:cloudflare' -ForegroundColor Gray
Write-Host '    npm run deploy' -ForegroundColor Gray
Write-Host ''
Write-Host ('  Staff login: /staff/login as ' + $staffUsername + ' with the password you set.') -ForegroundColor Green

#requires -Version 5.1
<#
.SYNOPSIS
  Setup Cloudflare Worker secrets and variables for muhra1.

.DESCRIPTION
  Walks through every required env var for production deployment on Cloudflare.
  - Secrets (`wrangler secret put`): SUPABASE_SERVICE_ROLE_KEY, STAFF_COOKIE_SECRET, STAFF_PASSWORD
  - Plain vars (uploaded via wrangler.jsonc edit OR `wrangler deploy --var`):
    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_URL, STAFF_USERNAME

.NOTES
  Prerequisites:
    - Node.js + npm installed and in PATH
    - One-time: `npm i -g wrangler` then `wrangler login`
    - Run this from the repo root: pwsh -File scripts/setup-cloudflare-env.ps1
#>

[CmdletBinding()]
param(
  [string]$WorkerName = "muhra1"
)

$ErrorActionPreference = 'Stop'

function Test-Wrangler {
  try {
    $null = Get-Command wrangler -ErrorAction Stop
    $version = (wrangler --version) 2>&1
    Write-Host "✓ Wrangler available: $version" -ForegroundColor Green
    return $true
  } catch {
    Write-Host "✗ Wrangler not found." -ForegroundColor Red
    Write-Host "  Install: npm install -g wrangler" -ForegroundColor Yellow
    Write-Host "  Then:    wrangler login" -ForegroundColor Yellow
    return $false
  }
}

function Test-WranglerAuth {
  try {
    $whoami = (wrangler whoami) 2>&1 | Out-String
    if ($whoami -match 'You are logged in') {
      Write-Host "✓ Wrangler authenticated." -ForegroundColor Green
      return $true
    }
    Write-Host "✗ Wrangler not logged in." -ForegroundColor Red
    Write-Host "  Run: wrangler login" -ForegroundColor Yellow
    return $false
  } catch {
    return $false
  }
}

function Read-Secret {
  param([string]$Prompt, [string]$Default = "")
  if ($Default) {
    $secure = Read-Host -Prompt "$Prompt [press Enter to use generated value]" -AsSecureString
  } else {
    $secure = Read-Host -Prompt $Prompt -AsSecureString
  }
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
  if ([string]::IsNullOrEmpty($plain) -and $Default) { return $Default }
  return $plain
}

function Set-WorkerSecret {
  param([string]$Name, [string]$Value)
  Write-Host "  → Uploading secret: $Name" -ForegroundColor Cyan
  $Value | wrangler secret put $Name --name $WorkerName
  if ($LASTEXITCODE -ne 0) { throw "Failed to set secret $Name" }
  Write-Host "    ✓ $Name set" -ForegroundColor Green
}

# ---------- Main flow ----------

Write-Host ""
Write-Host "=== MUHRA1 — Cloudflare environment setup ===" -ForegroundColor Magenta
Write-Host ""

if (-not (Test-Wrangler)) { exit 1 }
if (-not (Test-WranglerAuth)) { exit 1 }

# 1) Public Supabase URL — same in both NEXT_PUBLIC_SUPABASE_URL and SUPABASE_URL
$supabaseUrl = 'https://jqiznpmpenabzudcljdl.supabase.co'
Write-Host ""
Write-Host "Supabase project URL: $supabaseUrl" -ForegroundColor Yellow
$confirm = Read-Host "Press Enter to use this, or paste a different URL"
if ($confirm) { $supabaseUrl = $confirm.Trim() }

# 2) Service role key — from Supabase Dashboard → Settings → API → service_role
Write-Host ""
Write-Host "→ Open: https://supabase.com/dashboard/project/jqiznpmpenabzudcljdl/settings/api" -ForegroundColor Yellow
Write-Host "  Copy the service_role secret (starts with eyJhbGc...)" -ForegroundColor Yellow
$serviceRole = Read-Secret -Prompt "SUPABASE_SERVICE_ROLE_KEY"
if (-not $serviceRole) { Write-Host "✗ service_role required" -ForegroundColor Red; exit 1 }

# 3) Cookie secret (≥ 16 chars). Default = strong random.
$defaultCookieSecret = ([guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")).Substring(0, 48)
Write-Host ""
Write-Host "STAFF_COOKIE_SECRET (HMAC for staff session cookie, ≥ 16 chars)" -ForegroundColor Yellow
Write-Host "  Suggested random: $defaultCookieSecret" -ForegroundColor DarkGray
$cookieSecret = Read-Secret -Prompt "STAFF_COOKIE_SECRET" -Default $defaultCookieSecret
if ($cookieSecret.Length -lt 16) { Write-Host "✗ Must be at least 16 chars" -ForegroundColor Red; exit 1 }

# 4) Staff username
Write-Host ""
$staffUsername = Read-Host "STAFF_USERNAME (default: staff)"
if (-not $staffUsername) { $staffUsername = "staff" }

# 5) Staff password (≥ 12 chars recommended)
Write-Host ""
Write-Host "STAFF_PASSWORD — picked yourself or a strong random one." -ForegroundColor Yellow
$defaultPwd = ([guid]::NewGuid().ToString("N")).Substring(0, 20)
Write-Host "  Suggested random: $defaultPwd" -ForegroundColor DarkGray
$staffPassword = Read-Secret -Prompt "STAFF_PASSWORD" -Default $defaultPwd
if ($staffPassword.Length -lt 12) { Write-Host "✗ Use at least 12 chars" -ForegroundColor Red; exit 1 }

# ---------- Apply ----------

Write-Host ""
Write-Host "About to push to Worker '$WorkerName' on Cloudflare:" -ForegroundColor Magenta
Write-Host "  • SUPABASE_URL                 (plain var)" -ForegroundColor White
Write-Host "  • NEXT_PUBLIC_SUPABASE_URL     (plain var)" -ForegroundColor White
Write-Host "  • STAFF_USERNAME               (plain var)  = $staffUsername" -ForegroundColor White
Write-Host "  • SUPABASE_SERVICE_ROLE_KEY    (secret)" -ForegroundColor White
Write-Host "  • STAFF_COOKIE_SECRET          (secret)" -ForegroundColor White
Write-Host "  • STAFF_PASSWORD               (secret)" -ForegroundColor White
Write-Host ""
$go = Read-Host "Proceed? (y/N)"
if ($go -ne 'y' -and $go -ne 'Y') { Write-Host "Cancelled." -ForegroundColor Yellow; exit 0 }

Write-Host ""
Write-Host "→ Setting secrets…" -ForegroundColor Cyan
Set-WorkerSecret -Name "SUPABASE_SERVICE_ROLE_KEY" -Value $serviceRole
Set-WorkerSecret -Name "STAFF_COOKIE_SECRET"       -Value $cookieSecret
Set-WorkerSecret -Name "STAFF_PASSWORD"            -Value $staffPassword

Write-Host ""
Write-Host "→ Plain variables (URLs) are baked into wrangler.jsonc → 'vars'." -ForegroundColor Cyan
if ($staffUsername -ne "staff") {
  Write-Host "→ STAFF_USERNAME = '$staffUsername' (non-default) — set it manually:" -ForegroundColor Yellow
  Write-Host "    Dashboard: Workers → muhra1 → Settings → Variables → add STAFF_USERNAME" -ForegroundColor DarkGray
} else {
  Write-Host "→ STAFF_USERNAME is 'staff' (matches app default — no env needed)." -ForegroundColor Green
}

Write-Host ""
Write-Host "✓ Done. Next:" -ForegroundColor Green
Write-Host "    npm run build:cloudflare" -ForegroundColor Yellow
Write-Host "    npm run deploy" -ForegroundColor Yellow
Write-Host ""
Write-Host "Login at /staff/login with: $staffUsername / (the STAFF_PASSWORD you entered)" -ForegroundColor Green

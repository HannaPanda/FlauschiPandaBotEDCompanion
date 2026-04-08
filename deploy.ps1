# ED Companion – Deploy Script
# Usage:
#   .\deploy.ps1                  → auto-increments patch version
#   .\deploy.ps1 -Version v1.2.0  → explicit version
#   .\deploy.ps1 -Minor           → increments minor version
#   .\deploy.ps1 -Major           → increments major version
#
# What it does:
#   1. Validates working tree (no uncommitted changes unless -Force)
#   2. [Future] Linting / type-check
#   3. Bumps version in package.json
#   4. git add / commit / tag / push
#   5. Waits for GitHub Actions workflow to succeed
#   6. Downloads the .exe from the new release to your Desktop

param(
    [string]$Version   = "",
    [switch]$Minor     = $false,
    [switch]$Major     = $false,
    [switch]$Force     = $false,   # allow dirty working tree
    [switch]$SkipWait  = $false    # don't wait for CI, just push
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Config ────────────────────────────────────────────────────────────────────
$RepoOwner  = "HannaPanda"
$RepoName   = "FlauschiPandaBotEDCompanion"
$NodeDir    = "C:\Users\Shadow\tools\nodejs"
$ProjectDir = $PSScriptRoot
$Desktop    = [Environment]::GetFolderPath("Desktop")

# Token is read from the git remote URL (stored in .git/config, never committed).
# Set via: git remote set-url origin https://HannaPanda:TOKEN@github.com/...
$remoteUrl = git remote get-url origin 2>&1
if ($remoteUrl -match 'https://[^:]+:([^@]+)@github\.com') {
    $GhToken = $Matches[1]
} elseif ($env:GH_TOKEN) {
    $GhToken = $env:GH_TOKEN
} else {
    $GhToken = Read-Host "GitHub PAT (not stored anywhere)"
}

$Headers = @{ Authorization = "Bearer $GhToken"; Accept = "application/vnd.github+json" }

$env:PATH = "$NodeDir;$env:PATH"
Set-Location $ProjectDir

function Write-Step { param($msg) Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "  ✗ $msg" -ForegroundColor Red; exit 1 }

# ── 1. Git status check ───────────────────────────────────────────────────────
Write-Step "Checking working tree"

$gitStatus = git status --porcelain 2>&1
if ($gitStatus -and -not $Force) {
    Write-Host "  Uncommitted changes:" -ForegroundColor Yellow
    $gitStatus | ForEach-Object { Write-Host "    $_" }
    Write-Fail "Commit or stash changes first, or use -Force to include them in the release commit."
}
Write-Ok "Working tree clean"

# ── 2. [Future] Lint / type-check ─────────────────────────────────────────────
Write-Step "Type-check"
& $NodeDir\node.exe .\node_modules\typescript\bin\tsc -p tsconfig.main.json --noEmit
if ($LASTEXITCODE -ne 0) { Write-Fail "Main process type errors" }
& $NodeDir\node.exe .\node_modules\typescript\bin\tsc -p tsconfig.json --noEmit
if ($LASTEXITCODE -ne 0) { Write-Fail "Renderer type errors" }
Write-Ok "No type errors"

# TODO: Add ESLint here once configured
# & $NodeDir\npm.cmd run lint
# if ($LASTEXITCODE -ne 0) { Write-Fail "Lint errors" }

# ── 3. Version bump ───────────────────────────────────────────────────────────
Write-Step "Versioning"

$pkg = Get-Content "$ProjectDir\package.json" -Raw | ConvertFrom-Json
$current = [version]($pkg.version)

if ($Version) {
    $newVer = $Version.TrimStart('v')
} elseif ($Major) {
    $newVer = "$($current.Major + 1).0.0"
} elseif ($Minor) {
    $newVer = "$($current.Major).$($current.Minor + 1).0"
} else {
    $newVer = "$($current.Major).$($current.Minor).$($current.Build + 1)"
}

$tag = "v$newVer"
Write-Host "  $($pkg.version) → $newVer"

# Update package.json
$pkgRaw = Get-Content "$ProjectDir\package.json" -Raw
$pkgRaw = $pkgRaw -replace '"version": "[^"]*"', """version"": ""$newVer"""
Set-Content "$ProjectDir\package.json" $pkgRaw -NoNewline
Write-Ok "package.json updated"

# ── 4. Git commit + tag + push ────────────────────────────────────────────────
Write-Step "Git: commit, tag, push"

git add .
git commit -m "chore: release $tag"
if ($LASTEXITCODE -ne 0) { Write-Fail "git commit failed" }

git tag $tag
if ($LASTEXITCODE -ne 0) { Write-Fail "git tag failed" }

git push origin main
if ($LASTEXITCODE -ne 0) { Write-Fail "git push failed" }

git push origin $tag
if ($LASTEXITCODE -ne 0) { Write-Fail "git push tag failed" }

Write-Ok "Pushed $tag to GitHub"

if ($SkipWait) {
    Write-Host "`nDone (skipped CI wait). Check: https://github.com/$RepoOwner/$RepoName/actions" -ForegroundColor Green
    exit 0
}

# ── 5. Wait for GitHub Actions workflow ───────────────────────────────────────
Write-Step "Waiting for GitHub Actions (Build & Release)"

Write-Host "  Waiting for workflow to start..."
Start-Sleep -Seconds 8

$workflowRun = $null
$attempts = 0
while ($attempts -lt 12) {
    $runs = Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoOwner/$RepoName/actions/runs?event=push&per_page=5" -Headers $Headers
    $workflowRun = $runs.workflow_runs | Where-Object { $_.head_sha -eq (git rev-parse $tag) } | Select-Object -First 1
    if ($workflowRun) { break }
    Write-Host "  Still waiting for run to appear... ($($attempts + 1)/12)"
    Start-Sleep -Seconds 5
    $attempts++
}

if (-not $workflowRun) {
    Write-Host "  Could not find workflow run. Check manually: https://github.com/$RepoOwner/$RepoName/actions" -ForegroundColor Yellow
    exit 0
}

Write-Host "  Found run #$($workflowRun.run_number): $($workflowRun.html_url)"

$maxWait  = 600  # 10 minutes
$waited   = 0
$interval = 15

while ($waited -lt $maxWait) {
    $run = Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoOwner/$RepoName/actions/runs/$($workflowRun.id)" -Headers $Headers

    $status     = $run.status
    $conclusion = $run.conclusion

    Write-Host "  [$([int]($waited/60))m$($waited % 60)s] status=$status conclusion=$conclusion"

    if ($status -eq "completed") {
        if ($conclusion -eq "success") {
            Write-Ok "Workflow succeeded"
            break
        } else {
            Write-Fail "Workflow failed ($conclusion). See: $($run.html_url)"
        }
    }

    Start-Sleep -Seconds $interval
    $waited += $interval
}

if ($waited -ge $maxWait) { Write-Fail "Workflow timed out after 10 minutes" }

# ── 6. Download .exe to Desktop ───────────────────────────────────────────────
Write-Step "Downloading release to Desktop"

# Give the release a moment to fully publish
Start-Sleep -Seconds 3

$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoOwner/$RepoName/releases/tags/$tag" -Headers $Headers
$asset   = $release.assets | Where-Object { $_.name -like "*.exe" } | Select-Object -First 1

if (-not $asset) { Write-Fail "No .exe asset found in release $tag" }

$dest = Join-Path $Desktop $asset.name
Write-Host "  Downloading $($asset.name) ($([math]::Round($asset.size/1MB, 1)) MB)..."

$dlHeaders = @{
    Authorization = "Bearer $GhToken"
    Accept        = "application/octet-stream"
}
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $dest -Headers $dlHeaders -UseBasicParsing
Write-Ok "Saved to: $dest"

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  Release $tag complete!" -ForegroundColor Green
Write-Host "  GitHub: https://github.com/$RepoOwner/$RepoName/releases/tag/$tag"
Write-Host "  .exe:   $dest"

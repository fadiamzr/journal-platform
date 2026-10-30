# PowerShell 5.1 and 7 compatible verification runner for Journal Platform
[CmdletBinding()]
param(
    [switch]$Remote
)

$ErrorActionPreference = "Continue"
$failedSteps = @()

$repoRoot = $PSScriptRoot
if ((Split-Path -Leaf $repoRoot) -eq "scripts") {
    $repoRoot = Split-Path -Parent $repoRoot
}

$apiPython = Join-Path $repoRoot "apps\api\.venv\Scripts\python.exe"
if (-not (Test-Path $apiPython)) {
    $apiPython = "python"
}

$rootPython = Join-Path $repoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $rootPython)) {
    $rootPython = $apiPython
}

function Run-Step([string]$Name, [scriptblock]$Action) {
    try {
        & $Action
        if ($LASTEXITCODE -ne 0) {
            Write-Host "FAIL  [$Name]" -ForegroundColor Red
            $script:failedSteps += $Name
        } else {
            Write-Host "PASS  [$Name]" -ForegroundColor Green
        }
    } catch {
        Write-Host "FAIL  [$Name] Exception: $_" -ForegroundColor Red
        $script:failedSteps += $Name
    }
}

Write-Host "=== Journal Platform Stage 1A Verification ===" -ForegroundColor Cyan

# 1. Ruff check apps/api
Run-Step "ruff-check" {
    & $apiPython -m ruff check apps/api
}

# 2. Pytest apps/api
Run-Step "pytest-apps-api" {
    & $apiPython -m pytest -q apps/api
}

# 3. Python compilation on all scripts/*.py
$scriptsDir = Join-Path $repoRoot "scripts"
$pyFiles = Get-ChildItem -Path $scriptsDir -Filter "*.py"
$compileError = $false
foreach ($pyFile in $pyFiles) {
    & $apiPython -m py_compile $pyFile.FullName
    if ($LASTEXITCODE -ne 0) {
        $compileError = $true
        Write-Host "  Compilation error in: $($pyFile.Name)" -ForegroundColor Red
    }
}
if ($compileError) {
    Write-Host "FAIL  [py-compile-scripts]" -ForegroundColor Red
    $failedSteps += "py-compile-scripts"
} else {
    Write-Host "PASS  [py-compile-scripts]" -ForegroundColor Green
}

# 4. Secret scan (git grep untracked)
# Build regex components by concatenation to avoid literal substrings in files
$p1 = "sb_" + "secret_"
$p2 = "sb_" + "publishable_"
$p3 = "AQ" + "\."
$p4 = "AI" + "za"
$pattern = "$p1|$p2|$p3|$p4"

$gitOutput = git grep --untracked -lE $pattern 2>&1
if ($LASTEXITCODE -eq 0 -and $gitOutput) {
    Write-Host "FAIL  [secret-scan] Forbidden substrings matched in repository files" -ForegroundColor Red
    foreach ($line in $gitOutput) {
        Write-Host "  File: $line" -ForegroundColor Red
    }
    $failedSteps += "secret-scan"
} else {
    Write-Host "PASS  [secret-scan]" -ForegroundColor Green
}

# 5. Remote verification (optional switch)
if ($Remote) {
    Write-Host "`n=== Running Remote Verification ===" -ForegroundColor Cyan
    Run-Step "smoke-test" {
        & $rootPython (Join-Path $scriptsDir "smoke_test.py")
    }
    Run-Step "run-pgtap" {
        & $rootPython (Join-Path $scriptsDir "run_pgtap.py") --yes
    }
}

Write-Host "`n==============================================" -ForegroundColor Cyan
if ($failedSteps.Count -eq 0) {
    Write-Host "ALL CHECKS PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host "FAILED CHECKS: $($failedSteps -join ', ')" -ForegroundColor Red
    exit 1
}

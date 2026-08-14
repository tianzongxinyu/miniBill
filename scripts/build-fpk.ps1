# Build miniBill native .fpk for fnOS (no Docker).
#
# Usage:
#   scripts\build-fpk.cmd [version] [platform]          (recommended on Windows)
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-fpk.ps1 [version] [platform]
#
# platform: all (default, x86+arm), x86, or arm

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$FnosDir = Join-Path $Root "fnos"
$DistDir = Join-Path $Root "dist"
$Fnpack = Join-Path $Root ".fnos-shared\fnpack.exe"
$FnpackVersion = "1.2.3"

$Version = $args[0]
if (-not $Version -and (Test-Path (Join-Path $Root "VERSION"))) {
    $Version = (Get-Content (Join-Path $Root "VERSION") -Raw).Trim()
}
if (-not $Version) { $Version = "1.0.0" }
$PlatformArg = if ($args[1]) { $args[1] } else { "all" }

$script:ManifestBackup = $null

function Write-Info([string]$msg) { Write-Host "[INFO] $msg" -ForegroundColor Green }
function Write-Warn([string]$msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err([string]$msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red; exit 1 }

function Get-GoArch([string]$platform) {
    switch ($platform) {
        { $_ -in @("x86", "amd64") } { return "amd64" }
        { $_ -in @("arm", "arm64") } { return "arm64" }
        default { Write-Err "Unknown platform: $platform (use x86 or arm)" }
    }
}

function Get-ManifestArch([string]$platform) {
    switch ($platform) {
        { $_ -in @("x86", "amd64") } { return "x86_64" }
        { $_ -in @("arm", "arm64") } { return "aarch64" }
        default { Write-Err "Unknown platform: $platform" }
    }
}

function Get-ManifestPlatform([string]$platform) {
    switch ($platform) {
        { $_ -in @("x86", "amd64") } { return "x86" }
        { $_ -in @("arm", "arm64") } { return "arm" }
        default { Write-Err "Unknown platform: $platform" }
    }
}

function Find-PythonCmd {
    foreach ($name in @("python", "python3")) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    $py = Get-Command py -ErrorAction SilentlyContinue
    if ($py) { return "py -3" }
    Write-Err "python is required"
}

function Invoke-Python([string[]]$PythonArgs) {
    $cmd = Find-PythonCmd
    if ($cmd -eq "py -3") {
        & py -3 @PythonArgs
    } else {
        & $cmd @PythonArgs
    }
    if (-not $?) { throw "python exited with error" }
}

function Ensure-Fnpack {
    if (Test-Path $Fnpack) { return }
    $dir = Split-Path -Parent $Fnpack
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $url = "https://static2.fnnas.com/fnpack/fnpack-${FnpackVersion}-windows-amd64"
    Write-Info "Downloading fnpack ..."
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($curl) {
        & curl.exe -fsSL $url -o $Fnpack
        if ($LASTEXITCODE -ne 0) { Write-Err "Failed to download fnpack" }
    } else {
        Invoke-WebRequest -Uri $url -OutFile $Fnpack -UseBasicParsing
    }
}

function Ensure-WebOut {
    $webOut = Join-Path $Root "web\out"
    if (Test-Path $webOut) {
        Write-Info "Removing existing web/out ..."
        Remove-Item -Recurse -Force $webOut
    }
    Write-Info "Building frontend (web/out) with fnOS basePath /app/minibill ..."
    Push-Location (Join-Path $Root "web")
    try {
        $env:NEXT_PUBLIC_BASE_PATH = "/app/minibill"
        $env:NEXT_PUBLIC_API_BASE = "/app/minibill/api"
        npm install
        if (-not $?) { Write-Err "npm install failed" }
        npm run build
        if (-not $?) { Write-Err "npm run build failed" }
    } finally {
        Remove-Item Env:NEXT_PUBLIC_BASE_PATH -ErrorAction SilentlyContinue
        Remove-Item Env:NEXT_PUBLIC_API_BASE -ErrorAction SilentlyContinue
        Pop-Location
    }
}

function Update-Manifest([string]$version, [string]$platform, [string]$workDir) {
    $archLabel = Get-ManifestArch $platform
    $platformLabel = Get-ManifestPlatform $platform
    $manifest = Join-Path $workDir "manifest"
    if ($workDir -eq $FnosDir -and -not $script:ManifestBackup) {
        $script:ManifestBackup = [System.IO.Path]::GetTempFileName()
        Copy-Item $manifest $script:ManifestBackup -Force
    }
    # Always UTF-8 (no BOM): Get-Content defaults to system ANSI/GBK on Chinese Windows
    # and would mojibake display_name/desc/changelog into the .fpk.
    $utf8 = New-Object System.Text.UTF8Encoding $false
    $content = [System.IO.File]::ReadAllText($manifest, $utf8)
    $content = $content -replace '(?m)^version\s*=.*', "version               = $version"
    $content = $content -replace '(?m)^arch\s*=.*', "arch                  = $archLabel"
    $content = $content -replace '(?m)^platform\s*=.*', "platform              = $platformLabel"
    [System.IO.File]::WriteAllText($manifest, $content, $utf8)
}

function Restore-Manifest {
    if ($script:ManifestBackup -and (Test-Path $script:ManifestBackup)) {
        Copy-Item $script:ManifestBackup (Join-Path $FnosDir "manifest") -Force
        Remove-Item $script:ManifestBackup -Force
        $script:ManifestBackup = $null
    }
}

function Sync-WizardConfig {
    $env:FNOS_DIR = $FnosDir
    try {
        Invoke-Python @((Join-Path $Root "scripts\sync-fnos-wizard.py"))
    } catch {
        Write-Err "Failed to sync wizard config"
    }
}

function Sync-FnosIcons {
    Write-Info "Syncing fnOS icons from web/public/icon.png ..."
    try {
        Invoke-Python @((Join-Path $FnosDir "generate-icons.py"))
    } catch {
        Write-Err "generate-icons.py failed"
    }
    $webOut = Join-Path $Root "web\out"
    if (Test-Path $webOut) {
        Copy-Item (Join-Path $Root "web\public\icon.png") (Join-Path $webOut "icon.png") -Force
    }
}

function Prepare-Shared {
    Sync-WizardConfig
    Ensure-WebOut
    Sync-FnosIcons
    Ensure-Fnpack
}

function Setup-Staging([string]$staging) {
    if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
    New-Item -ItemType Directory -Path $staging -Force | Out-Null
    Get-ChildItem $FnosDir -Force | Where-Object {
        $_.Name -notin @("app", "minibill.fpk", ".DS_Store") -and
        $_.Name -notlike "fnpack-*"
    } | ForEach-Object {
        $dest = Join-Path $staging $_.Name
        if ($_.PSIsContainer) {
            Copy-Item $_.FullName $dest -Recurse -Force
        } else {
            Copy-Item $_.FullName $dest -Force
        }
    }
    $appUi = Join-Path $FnosDir "app\ui"
    New-Item -ItemType Directory -Path (Join-Path $staging "app\bin"), (Join-Path $staging "app\web"), (Join-Path $staging "app\migrations") -Force | Out-Null
    if (Test-Path $appUi) {
        Copy-Item $appUi (Join-Path $staging "app\ui") -Recurse -Force
    }
}

function Invoke-GoBuild([string]$goarch, [string]$version, [string]$outDir) {
    $env:GOOS = "linux"
    $env:GOARCH = $goarch
    $env:CGO_ENABLED = "0"
    Push-Location $Root
    try {
        go build -trimpath -ldflags "-s -w -X main.version=$version" -o (Join-Path $outDir "minibill") ./cmd/server
        if ($LASTEXITCODE -ne 0) { throw "go build minibill failed" }
        go build -trimpath -ldflags "-s -w" -o (Join-Path $outDir "reset-password") ./cmd/reset-password
        if ($LASTEXITCODE -ne 0) { throw "go build reset-password failed" }
    } finally {
        Pop-Location
        Remove-Item Env:GOOS -ErrorAction SilentlyContinue
        Remove-Item Env:GOARCH -ErrorAction SilentlyContinue
        Remove-Item Env:CGO_ENABLED -ErrorAction SilentlyContinue
    }
}

function Stage-Binary([string]$version, [string]$platform, [string]$workDir) {
    $goarch = Get-GoArch $platform
    Update-Manifest $version $platform $workDir

    Write-Info "[$platform] Building linux/${goarch} binary ..."
    $binDir = Join-Path $workDir "app\bin"
    $webDir = Join-Path $workDir "app\web"
    $migDir = Join-Path $workDir "app\migrations"
    New-Item -ItemType Directory -Path $binDir, $webDir, $migDir -Force | Out-Null

    Invoke-GoBuild $goarch $version $binDir

    $outDest = Join-Path $webDir "out"
    $sysMig = Join-Path $migDir "system"
    $ledgerMig = Join-Path $migDir "ledger"
    if (Test-Path $outDest) { Remove-Item -Recurse -Force $outDest }
    if (Test-Path $sysMig) { Remove-Item -Recurse -Force $sysMig }
    if (Test-Path $ledgerMig) { Remove-Item -Recurse -Force $ledgerMig }
    Copy-Item (Join-Path $Root "web\out") $outDest -Recurse -Force
    Copy-Item (Join-Path $Root "migrations\system") $sysMig -Recurse -Force
    Copy-Item (Join-Path $Root "migrations\ledger") $ledgerMig -Recurse -Force
}

function Pack-Fpk([string]$version, [string]$platform, [string]$workDir) {
    Write-Info "[$platform] Packing with fnpack ..."
    $fpkSrc = Join-Path $workDir "minibill.fpk"
    if (Test-Path $fpkSrc) { Remove-Item $fpkSrc -Force }

    Push-Location $workDir
    try {
        & $Fnpack build -d .
        if ($LASTEXITCODE -ne 0) { Write-Err "[$platform] fnpack build failed" }
    } finally {
        Pop-Location
    }

    if (-not (Test-Path $fpkSrc)) { Write-Err "[$platform] fnpack did not produce minibill.fpk" }

    if (-not (Test-Path $DistDir)) { New-Item -ItemType Directory -Path $DistDir -Force | Out-Null }
    $fpkDst = Join-Path $DistDir "minibill_${version}_${platform}.fpk"
    Move-Item $fpkSrc $fpkDst -Force

    $sc = Join-Path $workDir "MiniBill.sc"
    if (Test-Path $sc) {
        $repack = Join-Path ([System.IO.Path]::GetTempPath()) ("minibill-repack-" + [guid]::NewGuid().ToString("N"))
        New-Item -ItemType Directory -Path $repack -Force | Out-Null
        try {
            tar -xzf $fpkDst -C $repack
            if ($LASTEXITCODE -ne 0) { Write-Err "[$platform] tar extract failed" }
            Copy-Item $sc (Join-Path $repack "MiniBill.sc") -Force
            Push-Location $repack
            try {
                tar -czf $fpkDst *
                if ($LASTEXITCODE -ne 0) { Write-Err "[$platform] tar repack failed" }
            } finally {
                Pop-Location
            }
        } finally {
            Remove-Item -Recurse -Force $repack -ErrorAction SilentlyContinue
        }
    }

    $size = (Get-Item $fpkDst).Length
    $sizeMb = [math]::Round($size / 1MB, 1)
    Write-Info "[$platform] Built: $fpkDst (${sizeMb}M)"
}

function Build-One([string]$version, [string]$platform, [string]$workDir = $FnosDir) {
    Stage-Binary $version $platform $workDir
    Pack-Fpk $version $platform $workDir
    if ($workDir -eq $FnosDir) { Restore-Manifest }
}

function Build-AllParallel([string]$version) {
    $tmpdir = Join-Path ([System.IO.Path]::GetTempPath()) ("minibill-fpk-" + [guid]::NewGuid().ToString("N"))
    $stagingX86 = Join-Path $tmpdir "x86"
    $stagingArm = Join-Path $tmpdir "arm"
    try {
        Setup-Staging $stagingX86
        Setup-Staging $stagingArm

        # Parallel Go cross-compile via jobs; fnpack runs serially below.
        $jobX86 = Start-Job -ScriptBlock {
            param($Root, $Version, $WorkDir)
            $ErrorActionPreference = "Stop"
            $binDir = Join-Path $WorkDir "app\bin"
            New-Item -ItemType Directory -Path $binDir, (Join-Path $WorkDir "app\web"), (Join-Path $WorkDir "app\migrations") -Force | Out-Null
            $env:GOOS = "linux"; $env:GOARCH = "amd64"; $env:CGO_ENABLED = "0"
            Set-Location $Root
            go build -trimpath -ldflags "-s -w -X main.version=$Version" -o (Join-Path $binDir "minibill") ./cmd/server
            if ($LASTEXITCODE -ne 0) { throw "x86 minibill build failed" }
            go build -trimpath -ldflags "-s -w" -o (Join-Path $binDir "reset-password") ./cmd/reset-password
            if ($LASTEXITCODE -ne 0) { throw "x86 reset-password build failed" }
        } -ArgumentList $Root, $version, $stagingX86

        $jobArm = Start-Job -ScriptBlock {
            param($Root, $Version, $WorkDir)
            $ErrorActionPreference = "Stop"
            $binDir = Join-Path $WorkDir "app\bin"
            New-Item -ItemType Directory -Path $binDir, (Join-Path $WorkDir "app\web"), (Join-Path $WorkDir "app\migrations") -Force | Out-Null
            $env:GOOS = "linux"; $env:GOARCH = "arm64"; $env:CGO_ENABLED = "0"
            Set-Location $Root
            go build -trimpath -ldflags "-s -w -X main.version=$Version" -o (Join-Path $binDir "minibill") ./cmd/server
            if ($LASTEXITCODE -ne 0) { throw "arm minibill build failed" }
            go build -trimpath -ldflags "-s -w" -o (Join-Path $binDir "reset-password") ./cmd/reset-password
            if ($LASTEXITCODE -ne 0) { throw "arm reset-password build failed" }
        } -ArgumentList $Root, $version, $stagingArm

        $null = Wait-Job $jobX86, $jobArm
        $failed = @($jobX86, $jobArm) | Where-Object { $_.State -ne "Completed" }
        if ($failed.Count -gt 0) {
            Receive-Job $jobX86, $jobArm
            Remove-Job $jobX86, $jobArm -Force
            Write-Err "Parallel compile failed"
        }
        Receive-Job $jobX86, $jobArm | Out-Null
        Remove-Job $jobX86, $jobArm -Force

        foreach ($pair in @(@("x86", $stagingX86), @("arm", $stagingArm))) {
            $platform = $pair[0]
            $workDir = $pair[1]
            Update-Manifest $version $platform $workDir
            $webDir = Join-Path $workDir "app\web"
            $migDir = Join-Path $workDir "app\migrations"
            $outDest = Join-Path $webDir "out"
            if (Test-Path $outDest) { Remove-Item -Recurse -Force $outDest }
            Copy-Item (Join-Path $Root "web\out") $outDest -Recurse -Force
            Copy-Item (Join-Path $Root "migrations\system") (Join-Path $migDir "system") -Recurse -Force
            Copy-Item (Join-Path $Root "migrations\ledger") (Join-Path $migDir "ledger") -Recurse -Force
        }

        # fnpack is not safe to run in parallel (shared temp state).
        Pack-Fpk $version "x86" $stagingX86
        Pack-Fpk $version "arm" $stagingArm
    } finally {
        if (Test-Path $tmpdir) { Remove-Item -Recurse -Force $tmpdir -ErrorAction SilentlyContinue }
    }
}

# --- main ---
if (-not (Test-Path $FnosDir)) { Write-Err "Missing fnos/" }
if (-not (Test-Path (Join-Path $FnosDir "config\resource"))) { Write-Err "Missing fnos/config/resource" }
if (-not (Get-Command go -ErrorAction SilentlyContinue)) { Write-Err "go is required" }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Write-Err "npm is required" }
if (-not (Test-Path (Join-Path $Root "web\public\icon.png"))) { Write-Err "Missing web/public/icon.png" }
if (-not (Test-Path (Join-Path $FnosDir "app\ui\config"))) {
    Write-Err "Missing fnos/app/ui/config — restore with: git restore fnos/app/ui/config"
}
Find-PythonCmd | Out-Null

Prepare-Shared

switch ($PlatformArg) {
    "all" { Build-AllParallel $Version }
    default { Build-One $Version $PlatformArg }
}

Restore-Manifest
Write-Info "Done. Upload dist/*.fpk to fnOS App Center -> Manual Install"

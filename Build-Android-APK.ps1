$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$logPath = Join-Path $projectRoot 'build-android-apk.log'
$nodeDir = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$nodePath = Join-Path $nodeDir 'node.exe'
$pnpmPath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd'
$localEasCmd = Join-Path $projectRoot 'node_modules\.bin\eas.CMD'
$envLocalPath = Join-Path $projectRoot '.env.local'

function Write-Step {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Write-Host $line
  Add-Content -LiteralPath $logPath -Encoding UTF8 -Value $line
}

function Invoke-LoggedNative {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  $stdoutPath = Join-Path $projectRoot 'build-android-apk.stdout.tmp'
  $stderrPath = Join-Path $projectRoot 'build-android-apk.stderr.tmp'
  Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue

  try {
    $process = Start-Process -FilePath $FilePath -ArgumentList $Arguments -WorkingDirectory $projectRoot -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath

    if (Test-Path -LiteralPath $stdoutPath) {
      Get-Content -LiteralPath $stdoutPath -Encoding Unicode -ErrorAction SilentlyContinue | Tee-Object -FilePath $logPath -Append
    }
    if (Test-Path -LiteralPath $stderrPath) {
      Get-Content -LiteralPath $stderrPath -Encoding Unicode -ErrorAction SilentlyContinue | Tee-Object -FilePath $logPath -Append
    }

    return $process.ExitCode
  } finally {
    Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
  }
}

function Get-EnvLocalValue {
  param([string]$Name)

  if (!(Test-Path -LiteralPath $envLocalPath)) {
    return ''
  }

  $line = Get-Content -LiteralPath $envLocalPath -Encoding UTF8 |
    Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } |
    Select-Object -First 1

  if (!$line) {
    return ''
  }

  return (($line -split '=', 2)[1]).Trim().Trim('"').Trim("'")
}

function Ensure-ExpoToken {
  $token = $env:EXPO_TOKEN
  if ([string]::IsNullOrWhiteSpace($token)) {
    $token = Get-EnvLocalValue -Name 'EXPO_TOKEN'
  }

  if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host ""
    Write-Host "Expo password login can fail for Google/GitHub/Apple accounts."
    Write-Host "Create an Expo Access Token in the Expo website, then paste it here."
    Write-Host "Do not share this token with anyone. It will be saved only to:"
    Write-Host $envLocalPath
    Write-Host ""
    $secureToken = Read-Host "Paste EXPO_TOKEN (input hidden)" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
    try {
      $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
      if ($bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
      }
    }
    $token = $token.Trim()

    if ([string]::IsNullOrWhiteSpace($token)) {
      throw "EXPO_TOKEN is required for cloud build."
    }

    "EXPO_TOKEN=$token" | Set-Content -LiteralPath $envLocalPath -Encoding UTF8
    Write-Step "Saved EXPO_TOKEN to .env.local. The token value is not logged."
  }

  $env:EXPO_TOKEN = $token
  Write-Step "Using EXPO_TOKEN authentication. Token value is hidden."
}

try {
  "==== Trade Discipline Journal Android APK Build ====" | Set-Content -LiteralPath $logPath -Encoding UTF8
  Write-Step "Project: $projectRoot"
  Write-Step "This window must stay open. EAS may ask you to log in to Expo."

  if (!(Test-Path -LiteralPath $pnpmPath)) {
    throw "pnpm was not found at $pnpmPath"
  }
  if (!(Test-Path -LiteralPath $nodePath)) {
    throw "node was not found at $nodePath"
  }

  $env:PATH = "$nodeDir;$env:PATH"
  $env:EAS_NO_VCS = '1'
  Write-Step "Checking TypeScript..."
  $tscPath = Join-Path $projectRoot 'node_modules\typescript\bin\tsc'
  if (!(Test-Path -LiteralPath $tscPath)) {
    throw "TypeScript compiler was not found. Run pnpm install first."
  }
  $typecheckExitCode = Invoke-LoggedNative -FilePath $nodePath -Arguments @($tscPath, '--noEmit')
  if ($typecheckExitCode -ne 0) {
    throw "TypeScript check failed."
  }

  if ($env:TDJ_SKIP_EAS_BUILD -eq '1') {
    Write-Step "TDJ_SKIP_EAS_BUILD=1, skipping cloud build self-test."
    return
  }

  Write-Step "Starting EAS Android APK cloud build..."
  if (!(Test-Path -LiteralPath $localEasCmd)) {
    throw "Local EAS CLI was not found. Run pnpm install first."
  }
  Ensure-ExpoToken
  Write-Step "Using local eas-cli from project node_modules to avoid pnpm dlx Windows path issues."
  Write-Step "Using EAS_NO_VCS=1 to build without local Git."
  Write-Step "The final output should include an APK download link."
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & $localEasCmd build -p android --profile preview
  $buildExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousPreference
  if ($buildExitCode -ne 0) {
    throw "EAS build command failed. Check $logPath"
  }

  Write-Step "Build command finished. Look above for the APK download link."
} catch {
  Write-Step "ERROR: $($_.Exception.Message)"
  Write-Host ""
  Write-Host "The log file is here:"
  Write-Host $logPath
}

Write-Host ""
Write-Host "Press Enter to close this window."
Read-Host | Out-Null

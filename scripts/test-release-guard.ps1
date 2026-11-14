# No API writes: exercise the release guard using a mock gh command.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path -Parent $PSScriptRoot
$version = [string]((Get-Content -Raw -Encoding UTF8 (Join-Path $root 'app.config.json') | ConvertFrom-Json).version)
$tag = "v$version"
$assetNames = @(
  "htmlapps-presentation-remote-v$version.html",
  "htmlapps-presentation-remote-v$version.self-extract.html",
  "htmlapps-presentation-remote-v$version.zip",
  'SHA256SUMS.txt'
)
$oldRepo = $env:GITHUB_REPOSITORY
$oldToken = $env:GH_TOKEN
$global:releaseGuardScenario = 'absent'
$env:GITHUB_REPOSITORY = 'mock/presentation-remote'
$env:GH_TOKEN = 'offline-mock-token'

function global:gh {
  $endpoint = [string]$args[1]
  $global:LASTEXITCODE = 0
  if ($endpoint.EndsWith('/releases?per_page=100')) {
    if ($global:releaseGuardScenario -eq 'api-failure') {
      $global:LASTEXITCODE = 1
      return
    }
    if ($global:releaseGuardScenario -in @('complete', 'missing-asset', 'draft', 'missing-tag')) {
      return $tag
    }
    return 'v1.1.2'
  }
  if ($endpoint.EndsWith('/git/refs/tags?per_page=100')) {
    if ($global:releaseGuardScenario -eq 'tag-only') { return "refs/tags/$tag" }
    return 'refs/tags/v1.1.2'
  }
  if ($endpoint.EndsWith("/releases/tags/$tag")) {
    $names = @($assetNames)
    if ($global:releaseGuardScenario -eq 'missing-asset') { $names = @($names | Where-Object { $_ -ne 'SHA256SUMS.txt' }) }
    $assets = @($names | ForEach-Object { @{ name = $_; size = 100 } })
    return (@{ draft = ($global:releaseGuardScenario -eq 'draft'); assets = $assets } | ConvertTo-Json -Depth 5 -Compress)
  }
  if ($endpoint.EndsWith("/git/ref/tags/$tag")) {
    if ($global:releaseGuardScenario -eq 'missing-tag') { $global:LASTEXITCODE = 1; return }
    return '{"object":{"sha":"0123456789abcdef0123456789abcdef01234567"}}'
  }
  throw "Unexpected mock GitHub API request: $endpoint"
}

function Assert-Scenario([string]$scenario, [string]$expectation, [string]$fragment) {
  $global:releaseGuardScenario = $scenario
  $result = $null
  $errorText = ''
  try {
    $result = @(& (Join-Path $root 'scripts/verify-release-state.ps1') -DryRun 6>&1)
  } catch {
    $errorText = [string]$_.Exception.Message
  }
  if ($expectation -eq 'pass') {
    if ($errorText) { throw "$scenario unexpectedly failed: $errorText" }
    if (-not (([string]($result -join ' ')).Contains($fragment))) {
      throw "$scenario did not produce expected state: $fragment"
    }
  } else {
    if (-not $errorText.Contains($fragment)) {
      throw "$scenario did not fail with '$fragment': $errorText"
    }
  }
  Write-Host "[OK] release guard $scenario"
}
try {
  Assert-Scenario 'absent' 'pass' 'publish=true'
  Assert-Scenario 'complete' 'pass' 'publish=false'
  Assert-Scenario 'missing-asset' 'fail' 'missing or has an empty asset'
  Assert-Scenario 'draft' 'fail' 'still a draft'
  Assert-Scenario 'missing-tag' 'fail' 'no readable tag reference'
  Assert-Scenario 'tag-only' 'fail' 'exists without a release'
  Assert-Scenario 'api-failure' 'fail' 'Failed to list GitHub releases'
  Write-Host 'Offline release guard tests passed.'
} finally {
  Remove-Item Function:\gh -ErrorAction SilentlyContinue
  Remove-Variable -Name releaseGuardScenario -Scope Global -ErrorAction SilentlyContinue
  $env:GITHUB_REPOSITORY = $oldRepo
  $env:GH_TOKEN = $oldToken
  $global:LASTEXITCODE = 0
}

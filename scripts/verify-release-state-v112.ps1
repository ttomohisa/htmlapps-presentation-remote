param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$version = [string]((Get-Content -Raw -Encoding UTF8 (Join-Path (Split-Path -Parent $PSScriptRoot) 'app.config.json') | ConvertFrom-Json).version)
if ($version -ne '1.1.2') { throw "Expected app version 1.1.2, got $version" }
if (-not $env:GITHUB_REPOSITORY) { throw 'GITHUB_REPOSITORY is required.' }
if (-not $env:GH_TOKEN) { throw 'GH_TOKEN is required.' }

# A missing individual release/tag is an expected condition, not a shell failure.
# List existing objects using endpoints that return HTTP 200 even when v1.1.2 is absent.
$releases = @(gh api "repos/$env:GITHUB_REPOSITORY/releases?per_page=100" --jq '.[].tag_name')
if ($LASTEXITCODE -ne 0) { throw 'Failed to list GitHub releases; refusing to publish.' }

$publish = 'true'
if ($releases -contains 'v1.1.2') {
  $publish = 'false'
  Write-Host 'Release v1.1.2 already exists. Leaving it unchanged.'
} else {
  $refs = @(gh api "repos/$env:GITHUB_REPOSITORY/git/refs/tags?per_page=100" --jq '.[].ref')
  if ($LASTEXITCODE -ne 0) { throw 'Failed to list Git tags; refusing to publish.' }
  if ($refs -contains 'refs/tags/v1.1.2') {
    throw 'Tag v1.1.2 exists without a release. Inspect the tag before retrying.'
  }
  Write-Host 'Release v1.1.2 and tag are absent; publication is allowed.'
}

if ($DryRun) {
  Write-Host "Dry run succeeded. Would set publish=$publish. No output or repository state changed."
} else {
  if (-not $env:GITHUB_OUTPUT) { throw 'GITHUB_OUTPUT is required outside dry-run mode.' }
  "publish=$publish" | Out-File -FilePath $env:GITHUB_OUTPUT -Encoding utf8 -Append
}

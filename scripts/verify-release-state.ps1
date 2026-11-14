param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$config = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'app.config.json') | ConvertFrom-Json
$version = [string]$config.version
if ($version -notmatch '^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$') { throw "Invalid release version: $version" }
$tag = "v$version"
if (-not $env:GITHUB_REPOSITORY) { throw 'GITHUB_REPOSITORY is required.' }
if (-not $env:GH_TOKEN) { throw 'GH_TOKEN is required.' }
if (-not (Test-Path -LiteralPath (Join-Path $root ".github/releases/$tag.md"))) {
  throw "Missing release notes for $tag."
}

# Query collections rather than treating an individual 404 as an authentication error.
$releases = @(gh api "repos/$env:GITHUB_REPOSITORY/releases?per_page=100" --jq '.[].tag_name')
if ($LASTEXITCODE -ne 0) { throw 'Failed to list GitHub releases; refusing to publish.' }
$publish = 'true'
if ($releases -contains $tag) {
  $publish = 'false'
  Write-Host "Release $tag already exists. Leaving it unchanged."
} else {
  $refs = @(gh api "repos/$env:GITHUB_REPOSITORY/git/refs/tags?per_page=100" --jq '.[].ref')
  if ($LASTEXITCODE -ne 0) { throw 'Failed to list Git tags; refusing to publish.' }
  if ($refs -contains "refs/tags/$tag") {
    throw "Tag $tag exists without a release. Inspect the tag before retrying."
  }
  Write-Host "Release $tag and tag are absent; publication is allowed."
}

if ($DryRun) {
  Write-Host "Dry run succeeded. Would set publish=$publish for $tag. No repository state changed."
} else {
  if (-not $env:GITHUB_OUTPUT) { throw 'GITHUB_OUTPUT is required outside dry-run mode.' }
  "publish=$publish" | Out-File -FilePath $env:GITHUB_OUTPUT -Encoding utf8 -Append
  "tag=$tag" | Out-File -FilePath $env:GITHUB_OUTPUT -Encoding utf8 -Append
  "version=$version" | Out-File -FilePath $env:GITHUB_OUTPUT -Encoding utf8 -Append
}

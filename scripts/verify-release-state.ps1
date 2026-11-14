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
  # A rerun must not turn an incomplete public release into an apparently successful job.
  $releaseText = gh api "repos/$env:GITHUB_REPOSITORY/releases/tags/$tag"
  if ($LASTEXITCODE -ne 0) { throw "Cannot inspect existing release $tag; refusing to skip validation." }
  $release = $releaseText | ConvertFrom-Json
  if ($release.draft) { throw "Release $tag is still a draft; inspect the incomplete release before retrying." }
  $expectedAssets = @(
    "htmlapps-presentation-remote-v$version.html",
    "htmlapps-presentation-remote-v$version.self-extract.html",
    "htmlapps-presentation-remote-v$version.zip",
    'SHA256SUMS.txt'
  )
  foreach ($name in $expectedAssets) {
    $found = @($release.assets | Where-Object { $_.name -eq $name -and [long]$_.size -gt 0 })
    if ($found.Count -ne 1) {
      throw "Existing release $tag is missing or has an empty asset: $name. Repair it before retrying."
    }
  }
  $refText = gh api "repos/$env:GITHUB_REPOSITORY/git/ref/tags/$tag"
  if ($LASTEXITCODE -ne 0) { throw "Published release $tag has no readable tag reference." }
  $tagRef = $refText | ConvertFrom-Json
  if (-not $tagRef.object.sha) { throw "Published release $tag has an invalid tag reference." }
  $publish = 'false'
  Write-Host "Release $tag already has its tag and all four nonempty assets. Leaving it unchanged."
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

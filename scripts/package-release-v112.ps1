# Build the v1.1.2 release bundle from verified dist files.
# Used by both PR validation and the post-merge release workflow.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  $ErrorActionPreference = 'Stop'
  $out = 'release-out'
  $stage = Join-Path $out 'package'
  New-Item -ItemType Directory -Force -Path $out, $stage, (Join-Path $stage 'assets') | Out-Null
  
  $readable = Join-Path $out 'htmlapps-presentation-remote-v1.1.2.html'
  $extract = Join-Path $out 'htmlapps-presentation-remote-v1.1.2.self-extract.html'
  $archive = Join-Path $out 'htmlapps-presentation-remote-v1.1.2.zip'
  Copy-Item 'dist/index.html' $readable
  Copy-Item 'dist/index.self-extract.html' $extract
  
  $packageFiles = @{
    'index.html' = 'dist/index.html'
    'index.self-extract.html' = 'dist/index.self-extract.html'
    'dependency-manifest.json' = 'dist/dependency-manifest.json'
    'self-extract-manifest.json' = 'dist/self-extract-manifest.json'
    'app.config.json' = 'app.config.json'
    'README.md' = 'README.md'
    'README.ja.md' = 'README.ja.md'
    'CHANGELOG.md' = 'CHANGELOG.md'
    'README-FIRST.txt' = 'README-FIRST.txt'
    'LICENSE' = 'LICENSE'
    'THIRD_PARTY_NOTICES.md' = 'THIRD_PARTY_NOTICES.md'
  }
  foreach ($destName in $packageFiles.Keys) {
    Copy-Item -LiteralPath $packageFiles[$destName] -Destination (Join-Path $stage $destName)
  }
  if (Test-Path -LiteralPath 'dist/build-size-report.json') {
    Copy-Item -LiteralPath 'dist/build-size-report.json' -Destination (Join-Path $stage 'build-size-report.json')
  }
  Copy-Item -Path 'assets/screenshot*.png' -Destination (Join-Path $stage 'assets')
  Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $archive -CompressionLevel Optimal
  
  $assets = @($readable, $extract, $archive)
  $checksums = foreach ($asset in $assets) {
    $hash = (Get-FileHash -LiteralPath $asset -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $([System.IO.Path]::GetFileName($asset))"
  }
  [System.IO.File]::WriteAllLines((Join-Path $out 'SHA256SUMS.txt'), [string[]]$checksums, (New-Object System.Text.UTF8Encoding($false)))
  foreach ($asset in $assets) {
    $matching = @($checksums | Where-Object { $_ -like "*  $([System.IO.Path]::GetFileName($asset))" })
    if ($matching.Count -ne 1) { throw "Cannot locate checksum: $asset" }
    $expected = ($matching[0] -split '\s+')[0]
    $actual = (Get-FileHash -LiteralPath $asset -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($expected -ne $actual) { throw "Checksum mismatch: $asset" }
  }
} finally {
  Pop-Location
}

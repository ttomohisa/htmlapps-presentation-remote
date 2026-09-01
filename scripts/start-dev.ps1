param(
  [int]$Port = 8765,
  [switch]$SkipBuild,
  [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Dist = Join-Path $Root 'dist\index.html'
$ToolsDir = Join-Path $Root '.tools'
$CacheDir = Join-Path $Root '.dev-cache'
$CloudflaredLocal = Join-Path $ToolsDir 'cloudflared.exe'
$TunnelLog = Join-Path $CacheDir 'cloudflared.log'
$LoopbackBase = "http://127.0.0.1:$Port"
$MaxBody = 262144
$SignalTtlSeconds = 600
$Signals = @{}

function Write-DevLine([string]$Message) {
  Write-Host "[Presentation Remote] $Message"
}

function Find-Cloudflared {
  $cmd = Get-Command cloudflared.exe -ErrorAction SilentlyContinue
  if (-not $cmd) { $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue }
  if ($cmd) { return $cmd.Source }
  if (Test-Path $CloudflaredLocal) { return $CloudflaredLocal }
  return $null
}

function Ensure-Cloudflared {
  $existing = Find-Cloudflared
  if ($existing) { return $existing }

  New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
  $url = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
  Write-DevLine 'cloudflared が見つからないため、開発用ツールを .tools に取得します。'
  Write-DevLine '（生成する単一HTMLや本番配布物には含まれません）'
  try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}
  Invoke-WebRequest -Uri $url -OutFile $CloudflaredLocal -UseBasicParsing
  if (!(Test-Path $CloudflaredLocal)) { throw 'cloudflared の取得に失敗しました。' }
  return $CloudflaredLocal
}

function Start-QuickTunnel([string]$CloudflaredPath) {
  New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null
  Remove-Item $TunnelLog -Force -ErrorAction SilentlyContinue
  $args = @(
    'tunnel',
    '--no-autoupdate',
    '--url', $LoopbackBase,
    '--logfile', ('"' + $TunnelLog + '"'),
    '--loglevel', 'info'
  )
  $proc = Start-Process -FilePath $CloudflaredPath -ArgumentList $args -PassThru -WindowStyle Hidden

  $deadline = [DateTime]::UtcNow.AddSeconds(30)
  $publicUrl = $null
  while ([DateTime]::UtcNow -lt $deadline) {
    if ($proc.HasExited) {
      $log = if (Test-Path $TunnelLog) { Get-Content -Raw $TunnelLog } else { '' }
      throw "cloudflared が終了しました。`n$log"
    }
    if (Test-Path $TunnelLog) {
      $log = Get-Content -Raw $TunnelLog
      $m = [regex]::Match($log, 'https://[a-z0-9-]+\.trycloudflare\.com', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
      if ($m.Success) { $publicUrl = $m.Value.TrimEnd('/'); break }
    }
    Start-Sleep -Milliseconds 250
  }
  if (-not $publicUrl) {
    try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    $log = if (Test-Path $TunnelLog) { Get-Content -Raw $TunnelLog } else { '' }
    throw "一時HTTPS URLを取得できませんでした。cloudflared のログ:`n$log"
  }
  return @{ Process = $proc; PublicUrl = $publicUrl }
}

function Prune-Signals {
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  foreach ($key in @($Signals.Keys)) {
    $slot = $Signals[$key]
    if (($now - [int64]$slot.Updated) -gt $SignalTtlSeconds) { $Signals.Remove($key) }
  }
}

function Read-AsciiLine($Stream) {
  $bytes = New-Object System.Collections.Generic.List[byte]
  $prev = -1
  while ($bytes.Count -lt 65536) {
    $b = $Stream.ReadByte()
    if ($b -lt 0) { break }
    if ($prev -eq 13 -and $b -eq 10) {
      if ($bytes.Count -gt 0) { $bytes.RemoveAt($bytes.Count - 1) }
      return [Text.Encoding]::ASCII.GetString($bytes.ToArray())
    }
    $bytes.Add([byte]$b)
    $prev = $b
  }
  throw 'INVALID_HTTP_LINE'
}

function Read-ExactBytes($Stream, [int]$Length) {
  $body = [byte[]]::new($Length)
  $offset = 0
  while ($offset -lt $Length) {
    $n = $Stream.Read($body, $offset, $Length - $offset)
    if ($n -le 0) { throw 'INCOMPLETE_BODY' }
    $offset += $n
  }
  return $body
}

function Read-ChunkedBody($Stream) {
  $output = New-Object System.IO.MemoryStream
  try {
    while ($true) {
      $line = (Read-AsciiLine $Stream).Trim()
      $semi = $line.IndexOf(';')
      if ($semi -ge 0) { $line = $line.Substring(0,$semi) }
      $size = 0
      if (-not [int]::TryParse($line, [Globalization.NumberStyles]::HexNumber, [Globalization.CultureInfo]::InvariantCulture, [ref]$size)) { throw 'INVALID_CHUNK_SIZE' }
      if ($size -eq 0) {
        while ((Read-AsciiLine $Stream) -ne '') { }
        break
      }
      if (($output.Length + $size) -gt $MaxBody) { throw 'REQUEST_TOO_LARGE' }
      $chunk = Read-ExactBytes $Stream $size
      $output.Write($chunk,0,$chunk.Length)
      if ($Stream.ReadByte() -ne 13 -or $Stream.ReadByte() -ne 10) { throw 'INVALID_CHUNK_END' }
    }
    return $output.ToArray()
  } finally {
    $output.Dispose()
  }
}

function Read-HttpRequest([System.Net.Sockets.TcpClient]$Client) {
  $stream = $Client.GetStream()
  $requestLine = Read-AsciiLine $stream
  if ([string]::IsNullOrWhiteSpace($requestLine)) { return $null }
  $parts = $requestLine.Split(' ')
  if ($parts.Count -lt 2) { return $null }
  $headers = @{}
  while ($true) {
    $line = Read-AsciiLine $stream
    if ($line -eq '') { break }
    $idx = $line.IndexOf(':')
    if ($idx -gt 0) { $headers[$line.Substring(0,$idx).Trim().ToLowerInvariant()] = $line.Substring($idx+1).Trim() }
  }

  if ($headers.ContainsKey('transfer-encoding') -and $headers['transfer-encoding'].ToLowerInvariant().Contains('chunked')) {
    $body = Read-ChunkedBody $stream
  } else {
    $length = 0
    if ($headers.ContainsKey('content-length')) { [int]::TryParse($headers['content-length'], [ref]$length) | Out-Null }
    if ($length -gt $MaxBody) { throw 'REQUEST_TOO_LARGE' }
    $body = if ($length -gt 0) { Read-ExactBytes $stream $length } else { [byte[]]::new(0) }
  }
  return @{ Method=$parts[0].ToUpperInvariant(); Target=$parts[1]; Headers=$headers; Body=$body; Stream=$stream }
}

function Send-HttpResponse($Stream, [int]$Status, [string]$ContentType, [byte[]]$Body) {
  $reason = switch ($Status) { 200 {'OK'} 204 {'No Content'} 400 {'Bad Request'} 404 {'Not Found'} 413 {'Payload Too Large'} 503 {'Service Unavailable'} default {'OK'} }
  if ($null -eq $Body) { $Body = [byte[]]::new(0) }
  $header = "HTTP/1.1 $Status $reason`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`nConnection: close`r`n`r`n"
  $headBytes = [Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headBytes,0,$headBytes.Length)
  if ($Body.Length -gt 0) { $Stream.Write($Body,0,$Body.Length) }
  $Stream.Flush()
}

function Send-Json($Stream, [int]$Status, $Value) {
  $json = if ($null -eq $Value) { '' } else { $Value | ConvertTo-Json -Compress -Depth 8 }
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  Send-HttpResponse $Stream $Status 'application/json; charset=utf-8' $bytes
}

function Get-SignalRoute([string]$Path) {
  $m = [regex]::Match($Path, '^/__bkdev/signal/([^/]+)/(offer|answer)$')
  if (-not $m.Success) { return $null }
  $room = [Uri]::UnescapeDataString($m.Groups[1].Value)
  if ($room.Length -gt 80) { return $null }
  return @{ Room=$room; Kind=$m.Groups[2].Value }
}

function Serve-Client([System.Net.Sockets.TcpClient]$Client, [string]$PublicUrl) {
  try {
    $req = Read-HttpRequest $Client
    if ($null -eq $req) { return }
    $uri = [Uri]("http://localhost" + $req.Target)
    $path = $uri.AbsolutePath
    Prune-Signals

    $signal = Get-SignalRoute $path
    if ($signal) {
      if ($req.Method -eq 'GET') {
        if ($Signals.ContainsKey($signal.Room) -and $Signals[$signal.Room].ContainsKey($signal.Kind)) {
          Send-Json $req.Stream 200 $Signals[$signal.Room][$signal.Kind]
        } else {
          Send-HttpResponse $req.Stream 204 'application/json; charset=utf-8' ([byte[]]::new(0))
        }
        return
      }
      if ($req.Method -eq 'POST') {
        if ($req.Body.Length -le 0) { Send-Json $req.Stream 400 @{error='invalid body'}; return }
        try { $body = [Text.Encoding]::UTF8.GetString($req.Body) | ConvertFrom-Json } catch { Send-Json $req.Stream 400 @{error='invalid json'}; return }
        if (($body.type -notin @('offer','answer')) -or [string]::IsNullOrWhiteSpace([string]$body.sdp)) { Send-Json $req.Stream 400 @{error='invalid session description'}; return }
        if (-not $Signals.ContainsKey($signal.Room)) { $Signals[$signal.Room] = @{} }
        $Signals[$signal.Room][$signal.Kind] = @{ type=[string]$body.type; sdp=[string]$body.sdp }
        $Signals[$signal.Room]['Updated'] = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        Send-Json $req.Stream 200 @{ok=$true}
        return
      }
      Send-HttpResponse $req.Stream 404 'text/plain; charset=utf-8' ([byte[]]::new(0)); return
    }

    if ($path -eq '/__bkdev/health') {
      Send-Json $req.Stream 200 @{ok=$true; httpsBase=$PublicUrl; loopbackBase=$LoopbackBase}; return
    }

    if ($path -in @('/','/index.html')) {
      if (!(Test-Path $Dist)) { Send-Json $req.Stream 503 @{error='dist/index.html not found. Run the build first.'}; return }
      $html = Get-Content -Raw -Encoding UTF8 $Dist
      $html = $html.Replace("connect-src 'none'", "connect-src 'self'")
      $dev = @{ enabled=$true; baseUrl=$PublicUrl; loopbackUrl=$LoopbackBase; securePhone=$true } | ConvertTo-Json -Compress
      $inject = "<script>window.__BK_DEV__=Object.freeze($dev);</script>"
      $idx = $html.IndexOf('</head>', [StringComparison]::OrdinalIgnoreCase)
      if ($idx -ge 0) { $html = $html.Insert($idx, $inject) } else { $html = $inject + $html }
      $bytes = [Text.Encoding]::UTF8.GetBytes($html)
      Send-HttpResponse $req.Stream 200 'text/html; charset=utf-8' $bytes
      return
    }

    Send-HttpResponse $req.Stream 404 'text/plain; charset=utf-8' ([byte[]]::new(0))
  } catch {
    try {
      if ($_.Exception.Message -eq 'REQUEST_TOO_LARGE') { Send-Json $Client.GetStream() 413 @{error='request too large'} }
      else { Send-Json $Client.GetStream() 400 @{error='bad request'} }
    } catch {}
  } finally {
    try { $Client.Close() } catch {}
  }
}

if (-not $SkipBuild) {
  Write-DevLine '単一HTMLをビルドしています...'
  & (Join-Path $Root 'build-standalone.ps1')
}
if (!(Test-Path $Dist)) { throw 'dist/index.html がありません。start-dev.bat を先に実行してください。' }

$cloudflared = Ensure-Cloudflared
$listener = $null
$tunnelProcess = $null
try {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
  $listener.Start()
  Write-DevLine "ローカル開発サーバー: $LoopbackBase"

  Write-DevLine 'スマホ用の一時HTTPS URLを作成しています...'
  $tunnel = Start-QuickTunnel $cloudflared
  $tunnelProcess = $tunnel.Process
  $publicUrl = $tunnel.PublicUrl

  Write-Host ''
  Write-Host 'Browser Kitty Presentation Remote - HTTPS development mode'
  Write-Host '-----------------------------------------------------------'
  Write-Host "PC:    $LoopbackBase/?bkdev=host"
  Write-Host "Phone: $publicUrl/"
  Write-Host ''
  Write-Host '・スマホ側は HTTPS のためカメラ / QR スキャナーを使用できます。'
  Write-Host '・PPTX / PDF 本体はローカルのファイル入力から読み込み、シグナリングAPIへ送信しません。'
  Write-Host '・この一時URLは開発専用です。本番HTMLには含まれません。'
  Write-Host '・終了: Ctrl+C'
  Write-Host ''

  if (-not $NoOpen) { Start-Process "$LoopbackBase/?bkdev=host" | Out-Null }

  while ($true) {
    if ($tunnelProcess.HasExited) { throw 'cloudflared tunnel が終了しました。' }
    if ($listener.Pending()) {
      $client = $listener.AcceptTcpClient()
      Serve-Client $client $publicUrl
    } else {
      Start-Sleep -Milliseconds 30
    }
  }
} finally {
  if ($listener) { try { $listener.Stop() } catch {} }
  if ($tunnelProcess -and -not $tunnelProcess.HasExited) { try { Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue } catch {} }
  Write-Host ''
  Write-DevLine '開発サーバーを終了しました。'
}

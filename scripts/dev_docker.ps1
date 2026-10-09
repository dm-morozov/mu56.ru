param([ValidateSet('Start', 'Stop', 'Status', 'Logs')] [string]$Action = 'Start')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$composePath = Join-Path $projectRoot 'deploy/local/compose.yml'
$localPath = Join-Path $projectRoot '.local/docker-dev'
$envPath = Join-Path $localPath 'compose.env'
function Invoke-LocalCompose {
    & docker compose --env-file $envPath -f $composePath @args
    if ($LASTEXITCODE -ne 0) { throw 'Local Docker command failed.' }
}
if ($Action -ne 'Start') {
    if (-not (Test-Path -LiteralPath $envPath)) { throw 'Run Start first.' }
    switch ($Action) {
        Stop { Invoke-LocalCompose stop }
        Status { Invoke-LocalCompose ps }
        Logs { Invoke-LocalCompose logs --tail 60 }
    }
    return
}
New-Item -ItemType Directory -Force $localPath | Out-Null
if (-not (Test-Path -LiteralPath $envPath)) {
    $secretBytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($secretBytes) } finally { $rng.Dispose() }
    $password = [Convert]::ToBase64String($secretBytes)
    Set-Content -LiteralPath $envPath -Value "MU56_LOCAL_DB_PASSWORD=$password" -Encoding utf8
}
Invoke-LocalCompose up -d --wait database
$tableCount = Invoke-LocalCompose exec -T database psql -U mu56_local -d mu56 -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
if ([int]$tableCount -eq 0) {
    # Preserve the old Windows database. Import once into a separate Docker volume.
    & (Join-Path $PSScriptRoot 'dev_postgres.ps1') Load
    $dumpPath = Join-Path $localPath ('windows-local-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump')
    & 'C:/Program Files/PostgreSQL/18/bin/pg_dump.exe' -w -Fc --no-owner --no-acl -f $dumpPath
    if ($LASTEXITCODE -ne 0) { throw 'Could not back up the existing local database.' }
    Invoke-LocalCompose cp $dumpPath database:/tmp/windows-local.dump
    Invoke-LocalCompose exec -T database pg_restore -U mu56_local -d mu56 --no-owner --no-acl --exit-on-error /tmp/windows-local.dump
    Invoke-LocalCompose exec -T database rm /tmp/windows-local.dump
}
Invoke-LocalCompose up -d --build --wait --wait-timeout 180
Write-Host 'Site: http://127.0.0.1:3000/ | Admin: http://127.0.0.1:8001/admin/'

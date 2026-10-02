param([ValidateSet('Start', 'Stop', 'Load')] [string]$Action = 'Start')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$localRoot = Join-Path $projectRoot '.local'
$pgData = Join-Path $localRoot 'postgres'
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$credentialsFile = Join-Path $localRoot 'postgres-dev.json'

if ($Action -eq 'Stop') {
    & "$pgBin\pg_ctl.exe" -D $pgData -m fast -w stop
    if ($LASTEXITCODE -ne 0) { throw 'Не удалось остановить отдельный PostgreSQL.' }
    return
}

if (-not (Test-Path -LiteralPath $credentialsFile)) {
    if ($Action -eq 'Load') { throw 'Сначала запустите dev_postgres.ps1 Start.' }
    New-Item -ItemType Directory -Force $localRoot | Out-Null
    $secretBytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($secretBytes) } finally { $rng.Dispose() }
    @{ password = [Convert]::ToBase64String($secretBytes) } | ConvertTo-Json | Set-Content $credentialsFile
}
$credentials = Get-Content -LiteralPath $credentialsFile -Raw | ConvertFrom-Json
$env:PGHOST = '127.0.0.1'
$env:PGPORT = '55456'
$env:PGUSER = 'mu56_dev'
$env:PGDATABASE = 'mu56'
$env:PGPASSWORD = $credentials.password
Remove-Item Env:DJANGO_USE_SQLITE -ErrorAction SilentlyContinue
if ($Action -eq 'Load') { return }

if (-not (Test-Path -LiteralPath (Join-Path $pgData 'PG_VERSION'))) {
    $passwordFile = Join-Path $localRoot 'initdb-password'
    try {
        Set-Content -LiteralPath $passwordFile -Value $credentials.password -NoNewline
        & "$pgBin\initdb.exe" -D $pgData -U mu56_dev "--pwfile=$passwordFile" --auth=scram-sha-256 --encoding=UTF8 --locale=C
        if ($LASTEXITCODE -ne 0) { throw 'Не удалось создать отдельный кластер PostgreSQL.' }
    } finally {
        if (Test-Path -LiteralPath $passwordFile) { Remove-Item -LiteralPath $passwordFile }
    }
}
& "$pgBin\pg_ctl.exe" -D $pgData status *> $null
if ($LASTEXITCODE -ne 0) {
    & "$pgBin\pg_ctl.exe" -D $pgData -l (Join-Path $localRoot 'postgres.log') -o '-p 55456 -h 127.0.0.1' -w start
    if ($LASTEXITCODE -ne 0) { throw 'Не удалось запустить отдельный PostgreSQL.' }
}
$env:PGDATABASE = 'postgres'
$exists = & "$pgBin\psql.exe" -w -Atc "SELECT 1 FROM pg_database WHERE datname = 'mu56';"
if ($LASTEXITCODE -ne 0) { throw 'Не удалось подключиться к отдельному PostgreSQL.' }
if ($exists -ne '1') {
    & "$pgBin\createdb.exe" -w mu56
    if ($LASTEXITCODE -ne 0) { throw 'Не удалось создать базу mu56.' }
}
$env:PGDATABASE = 'mu56'
Write-Host 'Отдельный PostgreSQL доступен на 127.0.0.1:55456. Параметры загружены в текущий терминал.'

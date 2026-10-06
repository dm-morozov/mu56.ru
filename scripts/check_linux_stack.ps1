# Run a new isolated Compose project; keep its data for inspection, stop services afterwards.
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskDocker = Get-Command docker -ErrorAction SilentlyContinue
if ($taskDocker) { $taskDockerPath = $taskDocker.Source }
else { $taskDockerPath = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe' }
if (-not (Test-Path -LiteralPath $taskDockerPath)) { throw 'Docker Desktop is required.' }
$taskProject = 'mu56-linux-qa-' + [guid]::NewGuid().ToString('N').Substring(0, 10)
$taskDirectory = Join-Path $taskRoot ('.local\' + $taskProject)
New-Item -ItemType Directory -Path (Join-Path $taskDirectory 'report') -Force | Out-Null
$taskPriorCatalog = $env:QA_CATALOG
$taskPriorReport = $env:QA_REPORT
$taskPriorKeep = $env:QA_KEEP_RUNNING
$taskCompose = Join-Path $taskRoot 'deploy\qa\compose.yml'
function Invoke-QaDocker {
    & $taskDockerPath compose -f $taskCompose -p $taskProject @args
    if ($LASTEXITCODE -ne 0) { throw 'Linux QA command failed; see output above.' }
}
Push-Location $taskRoot
try {
    & (Join-Path $PSScriptRoot 'dev_postgres.ps1') Load
    & (Join-Path $taskRoot '.venv\Scripts\python.exe') backend/manage.py export_catalog (Join-Path $taskDirectory 'catalog')
    if ($LASTEXITCODE -ne 0) { throw 'Catalog export failed.' }
    $env:QA_CATALOG = (Join-Path $taskDirectory 'catalog').Replace('\', '/')
    $env:QA_REPORT = (Join-Path $taskDirectory 'report').Replace('\', '/')
    $env:QA_KEEP_RUNNING = '0'
    Invoke-QaDocker config --quiet
    Invoke-QaDocker build acceptance
    Invoke-QaDocker up --abort-on-container-exit --exit-code-from acceptance
    $taskReportPath = Join-Path $taskDirectory 'report\linux-stack.json'
    if (-not (Test-Path -LiteralPath $taskReportPath)) { throw 'No successful QA report was created.' }
    $taskReport = Get-Content -Raw -LiteralPath $taskReportPath | ConvertFrom-Json
    if (-not $taskReport.verified) { throw 'QA report is not verified.' }
    Write-Host ('Linux QA passed. Report: ' + $taskReportPath)
} finally {
    # Down removes only this run's containers/network; no -v, no global prune.
    if ($env:QA_CATALOG -and $env:QA_REPORT) { & $taskDockerPath compose -f $taskCompose -p $taskProject down }
    $env:QA_CATALOG = $taskPriorCatalog
    $env:QA_REPORT = $taskPriorReport
    $env:QA_KEEP_RUNNING = $taskPriorKeep
    Pop-Location
}

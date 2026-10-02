param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Configure', 'ConfigureExisting', 'Test', 'Worker', 'Once')]
    [string]$Action
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
& "$PSScriptRoot/dev_postgres.ps1" Load
$env:PYTHONUTF8 = '1'
$taskPython = Join-Path $projectRoot '.venv/Scripts/python.exe'
$taskManage = Join-Path $projectRoot 'backend/manage.py'
switch ($Action) {
    'Configure' { & $taskPython $taskManage configure_telegram }
    'ConfigureExisting' { & $taskPython $taskManage configure_telegram --existing }
    'Test' { & $taskPython $taskManage test_telegram }
    'Worker' { & $taskPython $taskManage telegram_worker }
    'Once' { & $taskPython $taskManage telegram_worker --once }
}
if ($LASTEXITCODE -ne 0) { throw 'Команда Telegram не завершена. Причина указана выше.' }

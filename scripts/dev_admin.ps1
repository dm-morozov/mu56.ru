$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
& "$PSScriptRoot/dev_postgres.ps1" Load
$env:PYTHONUTF8 = '1'
$taskPython = Join-Path $projectRoot '.venv/Scripts/python.exe'
$taskManage = Join-Path $projectRoot 'backend/manage.py'
& $taskPython $taskManage createsuperuser
if ($LASTEXITCODE -ne 0) { throw 'Учётная запись администратора не создана. Причина указана выше.' }

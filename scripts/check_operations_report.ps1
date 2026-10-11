$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$helper = Join-Path $PSScriptRoot 'report_site_operations.ps1'
$fixtureDirectory = Join-Path $repoRoot '.local/operations-helper-tests'
New-Item -ItemType Directory -Force -Path $fixtureDirectory | Out-Null
$fixtureKey = Join-Path $fixtureDirectory ([guid]::NewGuid().ToString('N') + '.fixture')
[IO.File]::WriteAllText($fixtureKey, 'Not a key; SSH is mocked.')
$global:mu56OperationsMockMode = 'success'
$global:mu56OperationsMockCalls = @()
$script:savedFiles = @()
function Assert($Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function ssh {
    $global:mu56OperationsMockCalls += ,$args
    $global:LASTEXITCODE = 0
    if ($global:mu56OperationsMockMode -eq 'ssh-failure') { $global:LASTEXITCODE = 255; return 'private raw output' }
    if ($args[-1] -like '*report_leads*') {
        if ($global:mu56OperationsMockMode -eq 'invalid-json') { return 'private non-JSON'; }
        if ($global:mu56OperationsMockMode -eq 'wrong-period') { $startDate = '2026-10-08' } else { $startDate = '2026-10-09' }
        $fixture = @{
            schema='lead-aggregates-v1'; period=@{start=$startDate;end='2026-10-15';timezone='Asia/Yekaterinburg'}
            test_leads='private server note'; leads=2
            by_status=@(@{value='new';count=2}); by_program=@(@{value='animation';count=1},@{value=$null;count=1})
            telegram=@{by_status=@(@{value='sent';count=2});without_notification=0};notes=@('private note')
        }
        if ($global:mu56OperationsMockMode -eq 'private-field') { $fixture.phone = 'private' }
        if ($global:mu56OperationsMockMode -eq 'private-group') { $fixture.by_program = @(@{value='+79000000000';count=1}) }
        if ($global:mu56OperationsMockMode -eq 'digit-slug') { $fixture.by_program = @(@{value='party-2027';count=2}) }
        if ($global:mu56OperationsMockMode -eq 'unknown-status') { $fixture.by_status = @(@{value='private';count=2}) }
        if ($global:mu56OperationsMockMode -eq 'negative-count') { $fixture.leads = -1 }
        return ($fixture | ConvertTo-Json -Depth 8)
    }
    if ($global:mu56OperationsMockMode -eq 'second-failure') { $global:LASTEXITCODE=1; return 'private second-command log' }
    return (@{configured=$true;queue=@{pending=0;sending=0;sent=2;failed=0;uncertain=0};overdue_pending=0;stale_sending=0;needs_manual_review=0;healthy=$true;scope='private note'} | ConvertTo-Json)
}
function Run-Helper([string]$First='2026-10-09', [string]$Last='2026-10-15') {
    return (& $helper -Start $First -End $Last -IdentityFile $fixtureKey)
}
function Report-Count {
    $directory = Join-Path $repoRoot '.local/operations-reports'
    if (-not (Test-Path -LiteralPath $directory)) { return 0 }
    return @(Get-ChildItem -LiteralPath $directory -File).Count
}
try {
    $result = Run-Helper
    $saved = ($result | Where-Object { $_ -like 'Saved private report: *' }) -replace '^Saved private report: ', ''
    if ($saved) { $script:savedFiles += $saved }
    Assert ($global:mu56OperationsMockCalls.Count -eq 2) 'Expected only two read-only SSH calls.'
    foreach ($call in $global:mu56OperationsMockCalls) {
        Assert ($call -contains 'StrictHostKeyChecking=yes') 'Host checking must be strict.'
        Assert ($call -contains 'BatchMode=yes') 'No password prompting.'
        Assert ($call[-1] -cmatch '^cd /srv/projects/mu56 && docker compose exec -T (backend python manage.py report_leads --start 2026-10-09 --end 2026-10-15|worker python manage.py telegram_status)$') 'Unexpected remote command.'
    }
    Assert ($saved -and (Test-Path -LiteralPath $saved)) 'Expected a saved private fixture report.'

    $text = [IO.File]::ReadAllText($saved)
    Assert ($text -notmatch 'private note|private server note|phone') 'Raw or personal fields escaped validation.'
    $parsed = $text | ConvertFrom-Json
    Assert ($parsed.leads.leads -eq 2 -and $parsed.telegram_current.healthy) 'Fixture aggregate mismatch.'
    Assert ($parsed.leads.period.start -eq '2026-10-09') 'Period mismatch.'
    $global:mu56OperationsMockMode='digit-slug'
    $digitResult = Run-Helper
    $digitPath = ($digitResult | Where-Object { $_ -like 'Saved private report: *' }) -replace '^Saved private report: ', ''
    if ($digitPath) { $script:savedFiles += $digitPath }
    Assert (([IO.File]::ReadAllText($digitPath) | ConvertFrom-Json).leads.by_program[0].value -eq 'party-2027') 'Public slug digits rejected.'
    foreach ($mode in @('ssh-failure','invalid-json','wrong-period','private-field','private-group','unknown-status','negative-count','second-failure')) {
        $global:mu56OperationsMockMode=$mode
        $count = Report-Count
        $failed=$false
        try { Run-Helper | Out-Null } catch {
            $failed=$true
            Assert ($_.Exception.Message -notmatch 'private raw|private second|\+790') 'Unsafe error detail.'
        }
        Assert $failed "Expected failure: $mode"
        Assert ((Report-Count) -eq $count) "Failure wrote a misleading report: $mode"
    }
    foreach ($pair in @(@('2026-10-16','2026-10-15'),@('2026-02-30','2026-10-15'),@('2026-10-09; touch x','2026-10-15'),@('2026-10-09','9999-12-31'))) {
        $global:mu56OperationsMockCalls=@(); $failed=$false
        try { Run-Helper $pair[0] $pair[1] | Out-Null } catch { $failed=$true }
        Assert $failed 'Invalid date accepted.'
        Assert ($global:mu56OperationsMockCalls.Count -eq 0) 'Invalid dates reached SSH.'
    }
    Write-Output 'Operations helper: mocked SSH, strict host checking, ISO dates, schema/privacy checks, second-command failure and no false-success files passed. Production was not contacted.'
} finally {
    # Only exact files created in this run, no directory deletion or recursive cleanup.
    foreach ($path in $script:savedFiles) { Remove-Item -LiteralPath $path -Force }
    Remove-Item -LiteralPath $fixtureKey -Force
    Remove-Item Function:\ssh
    Remove-Variable mu56OperationsMockMode,mu56OperationsMockCalls -Scope Global
}

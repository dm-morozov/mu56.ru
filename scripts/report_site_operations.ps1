param(
    [Parameter(Mandatory = $true)][string]$Start,
    [Parameter(Mandatory = $true)][string]$End,
    [string]$IdentityFile = (Join-Path $env:USERPROFILE '.ssh/id_ed25519_selectel_vds')
)

# Read-only commands; no worker, configuration, migrations or message transmission.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$temporaryPath = $null
try {
    $culture = [Globalization.CultureInfo]::InvariantCulture
    $startDate = [datetime]::ParseExact($Start, 'yyyy-MM-dd', $culture)
    $endDate = [datetime]::ParseExact($End, 'yyyy-MM-dd', $culture)
    if ($Start -cne $startDate.ToString('yyyy-MM-dd') -or $End -cne $endDate.ToString('yyyy-MM-dd') -or $startDate -gt $endDate -or $endDate -eq [datetime]::MaxValue.Date) {
        throw 'Invalid period.'
    }
    if (-not (Test-Path -LiteralPath $IdentityFile -PathType Leaf)) { throw 'Missing existing SSH key.' }
    if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) { throw 'Missing OpenSSH.' }

    function Read-RemoteJson([string]$Command) {
        # Suppress raw stderr: upstream logs may contain details unsuitable for an aggregate report.
        $lines = & ssh -T -i $IdentityFile -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=2 root@161.104.32.37 $Command 2>$null
        if ($LASTEXITCODE -ne 0) { throw 'SSH or remote command failed.' }
        $result = ($lines -join "`n") | ConvertFrom-Json -ErrorAction Stop
        if ($null -eq $result) { throw 'Empty JSON.' }
        return $result
    }
    function Assert-Fields($Object, [string[]]$Fields) {
        if ($null -eq $Object -or @($Object.PSObject.Properties.Name).Count -ne $Fields.Count) { throw 'Unexpected report schema.' }
        foreach ($field in $Object.PSObject.Properties.Name) {
            if ($field -cnotin $Fields) { throw 'Unexpected report field.' }
        }
    }
    function Assert-Count($Value) {
        if ($Value -isnot [int] -and $Value -isnot [long]) { throw 'Invalid count.' }
        if ($Value -lt 0) { throw 'Negative count.' }
    }
    function Assert-Groups($Rows, [bool]$Nullable, [string[]]$Allowed = @()) {
        foreach ($row in $Rows) {
            Assert-Fields $row @('value', 'count')
            Assert-Count $row.count
            if ($null -eq $row.value -and $Nullable) { continue }
            if ($row.value -isnot [string] -or $row.value -cnotmatch '^[a-z][a-z0-9_-]{0,69}$') { throw 'Non-public grouping value.' }
            if ($Allowed.Count -gt 0 -and $row.value -cnotin $Allowed) { throw 'Unknown status.' }
        }
    }

    # Dates are exact ISO dates validated above; no caller-supplied shell fragments.
    $leads = Read-RemoteJson "cd /srv/projects/mu56 && docker compose exec -T backend python manage.py report_leads --start $Start --end $End"
    $telegram = Read-RemoteJson 'cd /srv/projects/mu56 && docker compose exec -T worker python manage.py telegram_status'
    Assert-Fields $leads @('schema', 'period', 'test_leads', 'leads', 'by_status', 'by_program', 'telegram', 'notes')
    Assert-Fields $leads.period @('start', 'end', 'timezone')
    if ($leads.schema -cne 'lead-aggregates-v1' -or $leads.period.start -cne $Start -or $leads.period.end -cne $End -or $leads.period.timezone -cne 'Asia/Yekaterinburg') { throw 'Mismatched report period.' }
    Assert-Count $leads.leads
    Assert-Groups $leads.by_status $false @('new', 'contacted', 'proposal', 'confirmed', 'cancelled')
    Assert-Groups $leads.by_program $true
    Assert-Fields $leads.telegram @('by_status', 'without_notification')
    Assert-Groups $leads.telegram.by_status $false @('pending', 'sending', 'sent', 'failed', 'uncertain')
    Assert-Count $leads.telegram.without_notification
    Assert-Fields $telegram @('configured', 'queue', 'overdue_pending', 'stale_sending', 'needs_manual_review', 'healthy', 'scope')
    Assert-Fields $telegram.queue @('pending', 'sending', 'sent', 'failed', 'uncertain')
    foreach ($value in $telegram.queue.PSObject.Properties.Value) { Assert-Count $value }
    foreach ($field in @('overdue_pending', 'stale_sending', 'needs_manual_review')) { Assert-Count $telegram.$field }
    if ($telegram.configured -isnot [bool] -or $telegram.healthy -isnot [bool]) { throw 'Invalid queue flags.' }

    # Free-form server notes are replaced with fixed local text rather than copied.
    $leads.test_leads = 'included; no reliable test marker exists'
    $leads.notes = @('Saved leads, not unique customers or paid orders.', 'Current statuses; tests included.')
    $telegram.scope = 'Entire current queue; no network or worker liveness check'
    $report = [ordered]@{
        schema = 'site-operations-v1'
        collected_at_utc = [datetime]::UtcNow.ToString('o')
        leads = $leads
        telegram_current = $telegram
    }
    $outputDirectory = Join-Path $repoRoot '.local/operations-reports'
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
    $suffix = [guid]::NewGuid().ToString('N')
    $finalPath = Join-Path $outputDirectory "operations-$Start-$End-$suffix.json"
    $temporaryPath = Join-Path $outputDirectory "pending-$suffix.tmp"
    [IO.File]::WriteAllText($temporaryPath, ($report | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporaryPath -Destination $finalPath
    $temporaryPath = $null
    Write-Output "Saved private report: $finalPath"
    if (-not $telegram.healthy) { Write-Warning 'Queue needs attention. The report is valid; delivery and worker liveness are not confirmed.' }
} catch {
    if ($temporaryPath -and (Test-Path -LiteralPath $temporaryPath)) { Remove-Item -LiteralPath $temporaryPath -Force }
    # Do not expose raw JSON, stderr, key paths or exception text.
    throw 'Report not saved. Check ISO dates, existing SSH key, trusted host, access and supported report schema. No messages were sent by this helper.'
}

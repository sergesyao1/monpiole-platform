$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

$tasksDir = Join-Path $Root ".codex\tasks"
$runner   = Join-Path $Root ".codex\automation\run-task.ps1"

if (-not (Test-Path $tasksDir)) {
    Write-Host "TASK DIRECTORY MISSING: $tasksDir" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $runner)) {
    Write-Host "RUNNER MISSING: $runner" -ForegroundColor Red
    exit 1
}

Write-Host "=== CODEX NEXT TASK ORCHESTRATOR ===" -ForegroundColor Cyan

$tasks = Get-ChildItem $tasksDir -Filter "TASK-*.md" |
    Sort-Object Name

$candidates = foreach ($task in $tasks) {

    $content = Get-Content $task.FullName -Raw

    $statusMatch = [regex]::Match(
        $content,
        '(?ms)^## Status\s+(.*?)(?=^## |\z)'
    )

    $status = $statusMatch.Groups[1].Value.Trim()

    [PSCustomObject]@{
        Name   = $task.Name
        Path   = $task.FullName
        Status = $status
    }
}

Write-Host "`n=== TASK INVENTORY ===" -ForegroundColor Yellow
$candidates | Format-Table -AutoSize

$next = $candidates |
    Where-Object {
        $_.Status -match '^(TODO|READY_FOR_IMPLEMENTATION|READY)$'
    } |
    Select-Object -First 1

if (-not $next) {
    Write-Host "`nNO ELIGIBLE TASK FOUND" -ForegroundColor Yellow
    exit 0
}

Write-Host "`n=== NEXT TASK ===" -ForegroundColor Green
Write-Host "Name   : $($next.Name)"
Write-Host "Status : $($next.Status)"

Write-Host "`n=== PRE-RUN STATUS ===" -ForegroundColor Cyan
git status --short

$worktreeDirty = git status --porcelain

if ($worktreeDirty) {
    Write-Host "`nWORKTREE IS NOT CLEAN. ABORTING." -ForegroundColor Red
    exit 1
}

Write-Host "`n=== RUNNING NEXT TASK ===" -ForegroundColor Yellow

& $runner -TaskFile $next.Path

$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    Write-Host "`nTASK EXECUTION FAILED: $($next.Name)" -ForegroundColor Red
    exit $exitCode
}

Write-Host "`n=== POST-RUN STATUS ===" -ForegroundColor Cyan
git status --short

Write-Host "`nNEXT TASK EXECUTION COMPLETED" -ForegroundColor Green

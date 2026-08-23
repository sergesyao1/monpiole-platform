param(
    [Parameter(Mandatory = $true)]
    [string]$TaskFile
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

if (-not (Test-Path $TaskFile)) {
    Write-Host "TASK FILE NOT FOUND: $TaskFile" -ForegroundColor Red
    exit 1
}

$taskName = [System.IO.Path]::GetFileNameWithoutExtension($TaskFile)
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

$reportDir = Join-Path $Root ".codex\reports"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null

$reportFile = Join-Path $reportDir "$taskName-$timestamp.md"
$promptFile = Join-Path $reportDir "$taskName-$timestamp.prompt.txt"

$taskContent = Get-Content $TaskFile -Raw

$prompt = @"
You are executing a governed MonPiole repository task.

Repository:
$Root

Task:
$TaskFile

Repository governance:
- Read AGENTS.md before making changes.
- Read all relevant ADRs.
- Current ADR baseline is ADR-0001 through ADR-0006 only.
- ADR-0007 and higher do not exist in the current project baseline.
- Respect ADR-0002 Technology Selection Gate.
- Do not select or install new platform technology unless explicitly authorized by an accepted ADR.
- Preserve apps / services / packages boundaries.
- Preserve unrelated repository content.

Git safety:
- Do not commit.
- Do not push.
- Do not reset, clean, checkout, restore, rebase, or otherwise discard user changes.
- Keep modifications limited to the requested task.

Verification rules:
- Never report PASS for a check that was not actually executed.
- Documentation PASS is not equivalent to technical enforcement PASS.
- If technical implementation does not yet exist, retain PENDING where appropriate.
- If blocked by ADR-0002 or a missing prerequisite, report BLOCKED/PENDING rather than bypassing governance.

Required workflow:
1. Inspect git status.
2. Read the task.
3. Read applicable ADRs and repository documentation.
4. Determine current implementation state.
5. Perform only justified changes.
6. Run all relevant available verification.
7. Inspect git diff.
8. Update the task record only when evidence supports the change.
9. Produce a final report.

Final report must contain:
- Outcome
- Task status
- Files created
- Files modified
- Files deleted
- Verification executed
- Verification results
- Remaining pending items
- Blockers
- Recommended next task

TASK CONTENT
============

$taskContent
"@

[System.IO.File]::WriteAllText(
    $promptFile,
    $prompt,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "=== CODEX TASK RUNNER ===" -ForegroundColor Cyan
Write-Host "Task   : $TaskFile"
Write-Host "Prompt : $promptFile"
Write-Host "Report : $reportFile"

Write-Host "`n=== PRE-RUN GIT STATUS ===" -ForegroundColor Cyan
git status --short

Write-Host "`n=== RUNNING CODEX ===" -ForegroundColor Yellow

$prompt | codex exec `
    --cd "$Root" `
    --sandbox workspace-write `
    --output-last-message "$reportFile" `
    -

$exitCode = $LASTEXITCODE

Write-Host "`n=== POST-RUN GIT STATUS ===" -ForegroundColor Cyan
git status --short

Write-Host "`n=== GIT DIFF STAT ===" -ForegroundColor Cyan
git diff --stat

Write-Host "`n=== REPORT ===" -ForegroundColor Cyan

if (Test-Path $reportFile) {
    Get-Content $reportFile
}

if ($exitCode -ne 0) {
    Write-Host "`nCODEX FAILED WITH EXIT CODE $exitCode" -ForegroundColor Red
    exit $exitCode
}

Write-Host "`nCODEX TASK COMPLETED" -ForegroundColor Green

param([Parameter(Mandatory=$true)][string]$Message)
$pat = ('sb_' + 'secret_|sb_' + 'publishable_|AQ' + '\.|AI' + 'za')
$hits = git grep --untracked -lE $pat
if ($hits) { Write-Host "STOP: possible secret in:"; $hits; exit 1 }
git add -A
$staged = git diff --cached --name-only
$bad = $staged | Where-Object { ($_ -match '(^|/)\.env' -and $_ -notmatch '\.env\.example$') -or ($_ -match '\.venv/') -or ($_ -match '\.pdf$') }
if ($bad) { Write-Host "STOP: should not be committed:"; $bad; git reset | Out-Null; exit 1 }
git commit -m $Message
git push -u origin (git branch --show-current)

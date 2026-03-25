# Auto-Pull Watcher for Binee Command Center
# Watches the remote Git repo and auto-pulls new changes
# so the local Next.js dev server always serves the latest code.

$pollInterval = 10
$branch = "test"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Binee Auto-Pull Watcher" -ForegroundColor Cyan
Write-Host "  Watching branch: $branch (every $pollInterval sec)" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

while ($true) {
    try {
        git fetch origin $branch 2>$null

        $localHash = git rev-parse HEAD 2>$null
        $remoteHash = git rev-parse "origin/$branch" 2>$null

        if ($localHash -ne $remoteHash) {
            $timestamp = Get-Date -Format "HH:mm:ss"
            Write-Host "[$timestamp] New changes detected - pulling..." -ForegroundColor Yellow

            $result = git pull origin $branch 2>&1

            if ($LASTEXITCODE -eq 0) {
                $shortHash = $remoteHash.Substring(0, 7)
                Write-Host "[$timestamp] Pull successful ($shortHash)" -ForegroundColor Green

                $changedFiles = git diff --name-only "$localHash..$remoteHash" 2>$null
                if ($changedFiles) {
                    Write-Host "  Changed files:" -ForegroundColor DarkGray
                    foreach ($file in $changedFiles) {
                        Write-Host "    - $file" -ForegroundColor DarkGray
                    }
                }

                $needsInstall = $false
                if ($changedFiles) {
                    foreach ($file in $changedFiles) {
                        if ($file -match "package") {
                            $needsInstall = $true
                            break
                        }
                    }
                }
                if ($needsInstall) {
                    Write-Host "[$timestamp] package.json changed - running npm install..." -ForegroundColor Magenta
                    npm install 2>$null
                    Write-Host "[$timestamp] npm install complete" -ForegroundColor Green
                }

                Write-Host ""
            }
            else {
                Write-Host "[$timestamp] Pull failed - you may have local changes:" -ForegroundColor Red
                Write-Host $result -ForegroundColor Red
                Write-Host ""
            }
        }
        else {
            $timestamp = Get-Date -Format "HH:mm:ss"
            Write-Host "[$timestamp] Up to date" -ForegroundColor DarkGray
        }
    }
    catch {
        $timestamp = Get-Date -Format "HH:mm:ss"
        $errMsg = $_.Exception.Message
        Write-Host "[$timestamp] Error: $errMsg" -ForegroundColor Red
    }

    Start-Sleep -Seconds $pollInterval
}

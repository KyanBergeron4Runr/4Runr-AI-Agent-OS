Write-Host "🛑 Stopping 4Runr Gateway..." -ForegroundColor Cyan

# Find and kill Node.js processes running simple-gateway.js
Write-Host "🔍 Finding gateway processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
foreach ($process in $nodeProcesses) {
    try {
        $commandLine = (Get-WmiObject -Class Win32_Process -Filter "ProcessId = $($process.Id)").CommandLine
        if ($commandLine -like "*simple-gateway.js*") {
            Write-Host "Stopping gateway process $($process.Id)" -ForegroundColor Yellow
            Stop-Process -Id $process.Id -Force
        }
    } catch {
        # Ignore errors
    }
}

# Also kill any process using port 3000
Write-Host "🔍 Stopping processes on port 3000..." -ForegroundColor Yellow
$processes = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
foreach ($processId in $processes) {
    Write-Host "Stopping process $processId" -ForegroundColor Yellow
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

Write-Host "✅ Gateway stopped successfully." -ForegroundColor Green

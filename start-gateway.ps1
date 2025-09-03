Write-Host "🚀 Starting 4Runr Gateway with robust process management..." -ForegroundColor Cyan

# Kill any existing Node.js processes on port 3000
Write-Host "🔍 Checking for existing processes on port 3000..." -ForegroundColor Yellow
$processes = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
foreach ($processId in $processes) {
    Write-Host "Stopping process $processId" -ForegroundColor Yellow
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

# Wait a moment for processes to fully stop
Start-Sleep -Seconds 2

# Check if port 3000 is free
$portCheck = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($portCheck) {
    Write-Host "❌ Port 3000 is still in use. Please check manually." -ForegroundColor Red
    Read-Host "Press Enter to continue"
    exit 1
}

Write-Host "✅ Port 3000 is free, starting gateway..." -ForegroundColor Green

# Start the gateway
node simple-gateway.js

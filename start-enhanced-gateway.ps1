Write-Host "========================================" -ForegroundColor Cyan
Write-Host "STARTING ENHANCED GATEWAY (POWERSHELL)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This will start the enhanced gateway in the background:" -ForegroundColor Yellow
Write-Host "- Sentinel/Shield integration" -ForegroundColor White
Write-Host "- Security headers" -ForegroundColor White
Write-Host "- Missing endpoints implemented" -ForegroundColor White
Write-Host "- Improved performance" -ForegroundColor White
Write-Host "- Guard events SSE" -ForegroundColor White
Write-Host ""

Write-Host "Stopping any existing gateway processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host ""
Write-Host "Starting enhanced gateway in background..." -ForegroundColor Yellow
Start-Process -FilePath "node" -ArgumentList "registry-gateway-enhanced.js" -WindowStyle Hidden

Write-Host ""
Write-Host "Waiting for gateway to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "Checking if gateway is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Enhanced gateway is running successfully!" -ForegroundColor Green
        Write-Host "📍 URL: http://localhost:3000" -ForegroundColor White
        Write-Host "📍 Health: http://localhost:3000/health" -ForegroundColor White
        Write-Host "📍 Metrics: http://localhost:3000/metrics" -ForegroundColor White
        Write-Host ""
        Write-Host "The gateway will continue running in the background." -ForegroundColor Green
        Write-Host "To stop it, run: .\stop-reliable.bat" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Gateway failed to start properly" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "GATEWAY STARTUP COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "🧪 Testing 4Runr Gateway System..." -ForegroundColor Cyan

# Check if gateway is running
Write-Host "🔍 Checking gateway status..." -ForegroundColor Yellow
try {
    $status = node cli.js status 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Gateway is not running. Starting it now..." -ForegroundColor Red
        Start-Process -FilePath "node" -ArgumentList "simple-gateway.js" -WindowStyle Hidden
        Start-Sleep -Seconds 3
    }
} catch {
    Write-Host "❌ Gateway is not running. Starting it now..." -ForegroundColor Red
    Start-Process -FilePath "node" -ArgumentList "simple-gateway.js" -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

# Test basic functionality
Write-Host "📋 Testing basic functionality..." -ForegroundColor Yellow
node cli.js status
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Gateway health check failed" -ForegroundColor Red
    Read-Host "Press Enter to continue"
    exit 1
}

Write-Host "✅ Gateway is healthy" -ForegroundColor Green

# Test agent listing
Write-Host "📋 Testing agent listing..." -ForegroundColor Yellow
node cli.js list
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Agent listing failed" -ForegroundColor Red
    Read-Host "Press Enter to continue"
    exit 1
}

Write-Host "✅ Agent listing works" -ForegroundColor Green

# Test run creation
Write-Host "🚀 Testing run creation..." -ForegroundColor Yellow
node cli.js run demo-enricher
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Run creation failed" -ForegroundColor Red
    Read-Host "Press Enter to continue"
    exit 1
}

Write-Host "✅ Run creation works" -ForegroundColor Green

# Test run listing
Write-Host "📋 Testing run listing..." -ForegroundColor Yellow
node cli.js ps
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Run listing failed" -ForegroundColor Red
    Read-Host "Press Enter to continue"
    exit 1
}

Write-Host "✅ Run listing works" -ForegroundColor Green

# Run the full Prove-It test
Write-Host "🧪 Running comprehensive Prove-It test..." -ForegroundColor Yellow
node prove-it-agents-runs.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Prove-It test failed" -ForegroundColor Red
    Read-Host "Press Enter to continue"
    exit 1
}

Write-Host "🎉 All tests passed! System is 100% operational." -ForegroundColor Green

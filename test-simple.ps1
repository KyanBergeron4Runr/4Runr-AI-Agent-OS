# Simple Sentinel Test
Write-Host "Testing Sentinel System" -ForegroundColor Green
Write-Host ("=" * 40) -ForegroundColor Green

$baseUrl = "http://localhost:3000"

try {
    # Test 1: Server health
    Write-Host "`n1. Testing server health..." -ForegroundColor Yellow
    $healthResponse = Invoke-WebRequest -Uri "$baseUrl/health" -Method GET
    $healthData = $healthResponse.Content | ConvertFrom-Json
    Write-Host "   Server is running: $($healthData.ok)" -ForegroundColor Green

    # Test 2: Sentinel metrics
    Write-Host "`n2. Testing Sentinel metrics..." -ForegroundColor Yellow
    $metricsResponse = Invoke-WebRequest -Uri "$baseUrl/api/sentinel/metrics" -Method GET
    $metricsData = $metricsResponse.Content | ConvertFrom-Json
    Write-Host "   Sentinel metrics: $($metricsData.success)" -ForegroundColor Green
    Write-Host "   Total spans: $($metricsData.data.totalSpans)" -ForegroundColor Cyan
    Write-Host "   Total events: $($metricsData.data.totalEvents)" -ForegroundColor Cyan

    Write-Host "`n" + ("=" * 40) -ForegroundColor Green
    Write-Host "All tests completed successfully!" -ForegroundColor Green

} catch {
    Write-Host "Test failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`nTest completed!" -ForegroundColor Green

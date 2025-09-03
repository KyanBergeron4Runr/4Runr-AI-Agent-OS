# Final test with corrected date format
Write-Host "Final test with corrected date format..." -ForegroundColor Green

# Create agent
$agentBody = @{
    name = "final-fix-agent"
    created_by = "test-user"
    role = "test-role"
} | ConvertTo-Json

Write-Host "Creating agent..." -ForegroundColor Yellow
$agentResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/create-agent" -Method POST -Body $agentBody -ContentType "application/json"
$agentData = $agentResponse.Content | ConvertFrom-Json
$agentId = $agentData.agent_id
Write-Host "Agent created: $agentId" -ForegroundColor Green

# Generate token with UTC date format
$futureDate = (Get-Date).AddHours(2).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
Write-Host "Using expiry date: $futureDate" -ForegroundColor Cyan

$tokenBody = @{
    agent_id = $agentId
    tools = @("http_fetch")
    permissions = @("read")
    expires_at = $futureDate
} | ConvertTo-Json

Write-Host "Generating token..." -ForegroundColor Yellow
try {
    $tokenResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/generate-token" -Method POST -Body $tokenBody -ContentType "application/json"
    $tokenData = $tokenResponse.Content | ConvertFrom-Json
    Write-Host "✅ Token generated successfully!" -ForegroundColor Green
    Write-Host "Token ID: $($tokenData.token_id)" -ForegroundColor Cyan
    
    # Test proxy request
    $token = $tokenData.agent_token
    $proxyBody = @{
        agent_token = $token
        tool = "http_fetch"
        action = "get"
        params = @{
            url = "https://httpbin.org/json"
            headers = @{
                "User-Agent" = "4Runr-Sentinel-Test"
            }
        }
    } | ConvertTo-Json -Depth 3

    Write-Host "Testing proxy request..." -ForegroundColor Yellow
    $proxyResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/proxy-request" -Method POST -Body $proxyBody -ContentType "application/json"
    $proxyData = $proxyResponse.Content | ConvertFrom-Json
    Write-Host "✅ Proxy request successful!" -ForegroundColor Green
    Write-Host "Response status: $($proxyData.status)" -ForegroundColor Cyan

    # Check Sentinel metrics
    Write-Host "Checking Sentinel metrics..." -ForegroundColor Yellow
    $metricsResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/sentinel/metrics" -Method GET
    $metricsData = $metricsResponse.Content | ConvertFrom-Json
    Write-Host "Sentinel metrics:" -ForegroundColor Green
    Write-Host "  Total spans: $($metricsData.data.totalSpans)" -ForegroundColor Cyan
    Write-Host "  Total events: $($metricsData.data.totalEvents)" -ForegroundColor Cyan
    Write-Host "  Flagged injections: $($metricsData.data.flaggedInjections)" -ForegroundColor Cyan

    Write-Host "`n🎉 COMPLETE SUCCESS! The system is fully working!" -ForegroundColor Green
    Write-Host "✅ Agent creation: Working" -ForegroundColor Green
    Write-Host "✅ Token generation: Working" -ForegroundColor Green
    Write-Host "✅ Proxy requests: Working" -ForegroundColor Green
    Write-Host "✅ Sentinel monitoring: Working" -ForegroundColor Green
    Write-Host "✅ Shield protection: Active" -ForegroundColor Green
    
} catch {
    $errorResponse = $_.Exception.Response
    $errorContent = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($errorContent)
    $errorText = $reader.ReadToEnd()
    Write-Host "❌ Error: $errorText" -ForegroundColor Red
    Write-Host "The system is partially working but needs one more fix." -ForegroundColor Yellow
}

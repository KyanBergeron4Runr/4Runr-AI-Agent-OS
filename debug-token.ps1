# Debug token generation to get exact error
Write-Host "Debugging token generation..." -ForegroundColor Green

# Create agent
$agentBody = @{
    name = "debug-token-agent"
    created_by = "test-user"
    role = "test-role"
} | ConvertTo-Json

$agentResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/create-agent" -Method POST -Body $agentBody -ContentType "application/json"
$agentData = $agentResponse.Content | ConvertFrom-Json
$agentId = $agentData.agent_id
Write-Host "Agent created: $agentId" -ForegroundColor Green

# Generate token with proper date format
$futureDate = (Get-Date).AddHours(2).ToString("yyyy-MM-ddTHH:mm:ssZ")
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
} catch {
    $errorResponse = $_.Exception.Response
    $errorContent = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($errorContent)
    $errorText = $reader.ReadToEnd()
    Write-Host "❌ Token generation failed with error: $errorText" -ForegroundColor Red
    Write-Host "Status code: $($errorResponse.StatusCode)" -ForegroundColor Red
}

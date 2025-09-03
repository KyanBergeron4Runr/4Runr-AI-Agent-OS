# Quick test to debug token generation
Write-Host "Quick token generation test..." -ForegroundColor Green

# Create agent
$agentBody = @{
    name = "debug-agent"
    created_by = "test-user"
    role = "test-role"
} | ConvertTo-Json

$agentResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/create-agent" -Method POST -Body $agentBody -ContentType "application/json"
$agentData = $agentResponse.Content | ConvertFrom-Json
$agentId = $agentData.agent_id
Write-Host "Agent created: $agentId" -ForegroundColor Green

# Try different date formats
$formats = @(
    (Get-Date).AddHours(2).ToString("yyyy-MM-ddTHH:mm:ssZ"),
    (Get-Date).AddHours(2).ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
    (Get-Date).AddHours(2).ToString("yyyy-MM-ddTHH:mm:ss.000Z"),
    (Get-Date).AddHours(2).ToString("yyyy-MM-ddTHH:mm:ss")
)

foreach ($format in $formats) {
    Write-Host "`nTrying format: $format" -ForegroundColor Yellow
    
    $tokenBody = @{
        agent_id = $agentId
        tools = @("http_fetch")
        permissions = @("read")
        expires_at = $format
    } | ConvertTo-Json

    try {
        $tokenResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/generate-token" -Method POST -Body $tokenBody -ContentType "application/json"
        $tokenData = $tokenResponse.Content | ConvertFrom-Json
        Write-Host "✅ SUCCESS with format: $format" -ForegroundColor Green
        Write-Host "Token ID: $($tokenData.token_id)" -ForegroundColor Cyan
        break
    } catch {
        $errorResponse = $_.Exception.Response
        $errorContent = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorContent)
        $errorText = $reader.ReadToEnd()
        Write-Host "❌ Failed: $errorText" -ForegroundColor Red
    }
}

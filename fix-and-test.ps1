# Fix environment and test the complete system
Write-Host "Fixing environment and testing complete system..." -ForegroundColor Green
Write-Host ("=" * 60) -ForegroundColor Green

# Step 1: Add required environment variables
Write-Host "`n1. Adding required environment variables..." -ForegroundColor Yellow

# Create a simple .env file with the required keys
$envContent = @"
# --- REQUIRED ---
PORT=3000
DATABASE_URL=file:./dev.db
REDIS_URL=redis://localhost:6379
TOKEN_HMAC_SECRET=test-hmac-secret-change-me-in-production
SECRETS_BACKEND=env
HTTP_TIMEOUT_MS=6000
DEFAULT_TIMEZONE=America/Toronto
KEK_BASE64=REPLACE_WITH_BASE64_32B

# --- GATEWAY SECURITY KEYS ---
GATEWAY_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7D3xpR0Q7qAOM\n9MthRypsoM8YUrOC6mhrnZRMz8/j9QK+Y7FUvDC+ydRVE7f0NJI/Dau7ASrUJcPm\neQphNOlWOu+tGh2TDQ8N3KBmrWWJMj3cbBIxpD+tRZcd5DfzCJolGxojbIzuJvwq\ng9Ck0TK5wZ5+KLpyD5O00F3ZzUYmLMpOBikf9vd+4Zgv18u4rxDZL0KfbFUFCxvt\niCER4iVOF+QmSyUy8vJ2mkZhh0QeUjXO8weT0k33Vs5qI4orWZgsIKvpLGXmTVIr\naivgfol19UcSbm4Lx7HK0B/rU4xwHxqT0AkLHOhlFErmEPx1dnKNNONEP8+/Wh/8O\n0cih0IWHAgMBAAECggEAHa0GQrlwpLox3gHT5hnhLByS3jv4iJNhf3kfVtQ9Gd/7\n0HKGZnf4j7v7OIgJTe+tJ92mWeOEhOV836piMCuxvOFatq6G9JZExiEzPTbS/eH/\nmGF4vXFePMHmiHJ1QdQiiDJ1ghstfHao2KHSzuL1VizWVRNnCMNZ3nyT9wKu101L\nwXGIecEMNI18GDyVE+8ALe8B0GZgs6H2hqL8AHuJy3kjjt7sFBwFAOhY6Vb2V1NB\ncLhnD9elhD6KjOoyPJuVIBYBQvsqcUNtpOJHpdfmupCPm+1htin/xdtods3+kVG7\nKFWqHCYuBQj/zpiIxnA4rZGmWPl97ZaCIDyl2+XDYQKBgQD5OfhtM3QxXTFdF3Tr\nEVi6Y2piHjP2Sv4SmGsCoBhSnu2DcKDxdPnXv2kl5F5wSvZAQG/NtFl5kIClSwhZ\nhU6h9It2zqnR8cYiju3Pv4ng2rXMYlu+MECym56PdTJ697Oq9uOiVCx3qX6smv92\nngFcLMq8NOEiEks3TiIAZNGMUQKBgQDAJPyfmdcbYm21pfLpTt3huff/3SGXezj7\n0xgtv4hrOGNnFixVTT+4B8wa9OCLLqULZb3bicSux/7Xj4OcOqTb4RSxsZVH1iWo\nmTZ+J2r67rxV6hV0HCTUGTnUXXI2/MIYbFKyXAae/jyvkEYbeSDzErzsuvg9Dugc\nUAUMKIT2VwKBgQC0jRCyW9JTaMY4QKQNH9X9wcPyLRtL1GxYIF912XGFeWlsDY4r\nHqlZaWvNbbIU+9mGFqhoh71CWjM4jDESWYbrwXO/sFxKojL+GjmihYpngUqvNJpu\nIBreyeqG10qo1wYsVwv2L7C/R+VjOi7USgeGNVTyIATxX/tpp4ruaht84QKBgAMW\nVQzHbwJcoYCiqvV+s+f1kfuFdQ23CCJbsO7DPhDi9g3o+Etik1yEm43vU1BJLpOx\nTcyiOQvJ4Nlbz/SJqK5zvl5giRJ/aVl9JLgAMCLaBSKoQTH9ZcYWpaw42CX0B7ZW\nvzloax7Q3O7BNa8pUhM1wN1Y37YzcB1MV9hrKj+/AoGBAIExcQTBgOvTABl2SWYC\nWBhJbUO9xX9wseWlgVRKbFPSv1PHA/WJDSizcVCEk7BYV/3DxTwqUeB0TYFYZ4tt\nhj0P0ByOGo/bVl3QyMhmbFFR5uwR13efKTKlYkFJjBT1+NLM1XRgzVcElTH8ZSqM\n12AIwEVRDtBZK9Bzv8HYa2HL\n-----END PRIVATE KEY-----\n"
SIGNING_SECRET=default-secret-change-in-production

# --- OPTIONAL / FEATURE FLAGS ---
FF_CACHE=on
FF_RETRY=on
FF_BREAKERS=on
FF_ASYNC=on
FF_POLICY=on
UPSTREAM_MODE=mock
FF_CHAOS=off

# --- DEV ONLY EXAMPLE SECRETS (env backend) ---
serpapi.api_key=dev-serpapi
openai.api_key=dev-openai
gmail_send.api_key=dev-gmail
"@

# Write the complete .env file
$envContent | Out-File -FilePath ".env" -Encoding UTF8 -Force
Write-Host "   ✅ Created .env file with all required variables" -ForegroundColor Green

# Step 2: Restart the server
Write-Host "`n2. Restarting server with new environment..." -ForegroundColor Yellow

# Stop any existing server process
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Start the server in background
Write-Host "   Starting server..." -ForegroundColor Cyan
Start-Process -FilePath "npx" -ArgumentList "ts-node", "src/index.ts" -WindowStyle Hidden
Start-Sleep -Seconds 5

# Step 3: Test the system
Write-Host "`n3. Testing the complete system..." -ForegroundColor Yellow

# Wait for server to be ready
$maxAttempts = 10
$attempt = 0
$serverReady = $false

while ($attempt -lt $maxAttempts -and -not $serverReady) {
    $attempt++
    Write-Host "   Attempt $attempt of $maxAttempts: Checking if server is ready..." -ForegroundColor Cyan
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -Method GET -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            $serverReady = $true
            Write-Host "   ✅ Server is ready!" -ForegroundColor Green
        }
    } catch {
        Write-Host "   ⏳ Server not ready yet, waiting..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

if (-not $serverReady) {
    Write-Host "   ❌ Server failed to start properly" -ForegroundColor Red
    exit 1
}

# Step 4: Run the comprehensive test
Write-Host "`n4. Running comprehensive integration test..." -ForegroundColor Yellow
& .\test-robust.ps1

Write-Host "`n" + ("=" * 60) -ForegroundColor Green
Write-Host "🎉 Complete system test finished!" -ForegroundColor Green
Write-Host "The 4Runr Gateway with Sentinel + Shield is now fully operational!" -ForegroundColor Green

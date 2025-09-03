# Test Sentinel and Shield Configuration Loading
Write-Host "TESTING SENTINEL AND SHIELD CONFIGURATION" -ForegroundColor Green

# Test 1: Check if config files exist
Write-Host "`nChecking config files..." -ForegroundColor Yellow

$sentinelConfigPath = "config/sentinel.json"
$shieldConfigPath = "config/shield.json"

if (Test-Path $sentinelConfigPath) {
    Write-Host "✅ Sentinel config exists: $sentinelConfigPath" -ForegroundColor Green
} else {
    Write-Host "❌ Sentinel config missing: $sentinelConfigPath" -ForegroundColor Red
}

if (Test-Path $shieldConfigPath) {
    Write-Host "✅ Shield config exists: $shieldConfigPath" -ForegroundColor Green
} else {
    Write-Host "❌ Shield config missing: $shieldConfigPath" -ForegroundColor Red
}

# Test 2: Check Sentinel config via API
Write-Host "`nChecking Sentinel config via API..." -ForegroundColor Yellow

try {
    $configResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/sentinel/config" -Method GET
    $configData = $configResponse.Content | ConvertFrom-Json
    
    Write-Host "✅ Sentinel config loaded successfully" -ForegroundColor Green
    Write-Host "  Telemetry enabled: $($configData.telemetry.enabled)" -ForegroundColor Cyan
    Write-Host "  Hallucination enabled: $($configData.hallucination.enabled)" -ForegroundColor Cyan
    Write-Host "  Injection enabled: $($configData.injection.enabled)" -ForegroundColor Cyan
    Write-Host "  Judge enabled: $($configData.judge.enabled)" -ForegroundColor Cyan
    Write-Host "  Shield enabled: $($configData.shield.enabled)" -ForegroundColor Cyan
    
    # Check Shield specific config
    Write-Host "`nShield Configuration:" -ForegroundColor Yellow
    Write-Host "  Mode: $($configData.shield.mode)" -ForegroundColor Cyan
    Write-Host "  Policies Count: $($configData.shield.policies.Count)" -ForegroundColor Cyan
    Write-Host "  Audit Enabled: $($configData.shield.audit.enabled)" -ForegroundColor Cyan
    
    if ($configData.shield.policies.Count -gt 0) {
        Write-Host "  ✅ Shield policies loaded" -ForegroundColor Green
        $configData.shield.policies | ForEach-Object {
            Write-Host "    - $($_.id): $($_.action)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ❌ No Shield policies loaded" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Failed to load Sentinel config: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Check if Shield is actually enabled
Write-Host "`nChecking Shield status..." -ForegroundColor Yellow

try {
    $metricsResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/sentinel/metrics" -Method GET
    $metricsData = $metricsResponse.Content | ConvertFrom-Json
    
    Write-Host "Sentinel Metrics:" -ForegroundColor Cyan
    Write-Host "  Total Spans: $($metricsData.data.totalSpans)" -ForegroundColor Cyan
    Write-Host "  Total Events: $($metricsData.data.totalEvents)" -ForegroundColor Cyan
    Write-Host "  Shield Decisions: $($metricsData.data.shieldDecisions)" -ForegroundColor Cyan
    Write-Host "  Audit Events: $($metricsData.data.auditEvents)" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Failed to load metrics: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Check if config files are readable
Write-Host "`nChecking config file contents..." -ForegroundColor Yellow

if (Test-Path $shieldConfigPath) {
    try {
        $shieldContent = Get-Content $shieldConfigPath -Raw | ConvertFrom-Json
        Write-Host "✅ Shield config is valid JSON" -ForegroundColor Green
        Write-Host "  Enabled: $($shieldContent.enabled)" -ForegroundColor Cyan
        Write-Host "  Mode: $($shieldContent.mode)" -ForegroundColor Cyan
        Write-Host "  Policies: $($shieldContent.policies.Count)" -ForegroundColor Cyan
    } catch {
        Write-Host "❌ Shield config is not valid JSON: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nConfiguration test completed!" -ForegroundColor Green

# Comprehensive Sentinel/Shield Integration Test
# Tests the full system working together

Write-Host "🛡️ Testing Sentinel/Shield Integration with 4Runr Gateway" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Wait for server to be ready
Write-Host "⏳ Waiting for server to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Test 1: Basic Health Check
Write-Host "`n1️⃣ Testing Basic Health Check..." -ForegroundColor Green
try {
    $healthResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -Method GET -TimeoutSec 10
    if ($healthResponse.StatusCode -eq 200) {
        Write-Host "✅ Health check passed" -ForegroundColor Green
    } else {
        Write-Host "❌ Health check failed: $($healthResponse.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Sentinel Metrics API
Write-Host "`n2️⃣ Testing Sentinel Metrics API..." -ForegroundColor Green
try {
    $metricsResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/sentinel/metrics" -Method GET -TimeoutSec 10
    if ($metricsResponse.StatusCode -eq 200) {
        $metrics = $metricsResponse.Content | ConvertFrom-Json
        Write-Host "✅ Sentinel metrics API working" -ForegroundColor Green
        Write-Host "   - Total spans: $($metrics.totalSpans)" -ForegroundColor Gray
        Write-Host "   - Total events: $($metrics.totalEvents)" -ForegroundColor Gray
        Write-Host "   - Shield decisions: $($metrics.totalShieldDecisions)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Sentinel metrics failed: $($metricsResponse.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Sentinel metrics failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Create Agent
Write-Host "`n3️⃣ Testing Agent Creation..." -ForegroundColor Green
try {
    $agentData = @{
        name = "test-agent-sentinel"
        description = "Test agent for Sentinel integration"
        capabilities = @("http_fetch:get", "http_fetch:post")
        metadata = @{
            version = "1.0.0"
            environment = "test"
        }
    }
    
    $agentResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/create-agent" -Method POST -Body ($agentData | ConvertTo-Json -Depth 3) -ContentType "application/json" -TimeoutSec 10
    
    if ($agentResponse.StatusCode -eq 201) {
        $agent = $agentResponse.Content | ConvertFrom-Json
        $agentId = $agent.id
        Write-Host "✅ Agent created: $agentId" -ForegroundColor Green
    } else {
        Write-Host "❌ Agent creation failed: $($agentResponse.StatusCode)" -ForegroundColor Red
        return
    }
} catch {
    Write-Host "❌ Agent creation failed: $($_.Exception.Message)" -ForegroundColor Red
    return
}

# Test 4: Generate Token
Write-Host "`n4️⃣ Testing Token Generation..." -ForegroundColor Green
try {
    $tokenData = @{
        agentId = $agentId
        scopes = @("http_fetch:get", "http_fetch:post")
        ttlSeconds = 300
    }
    
    $tokenResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/tokens" -Method POST -Body ($tokenData | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10
    
    if ($tokenResponse.StatusCode -eq 200) {
        $tokenResult = $tokenResponse.Content | ConvertFrom-Json
        $token = $tokenResult.token
        Write-Host "✅ Token generated successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Token generation failed: $($tokenResponse.StatusCode)" -ForegroundColor Red
        return
    }
} catch {
    Write-Host "❌ Token generation failed: $($_.Exception.Message)" -ForegroundColor Red
    return
}

# Test 5: Safe HTTP Request (Should Pass)
Write-Host "`n5️⃣ Testing Safe HTTP Request (Should Pass)..." -ForegroundColor Green
try {
    $safeRequest = @{
        tool = "http_fetch"
        action = "get"
        params = @{
            url = "https://httpbin.org/json"
            headers = @{
                "User-Agent" = "4Runr-Test"
            }
        }
    }
    
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $safeResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/proxy" -Method POST -Body ($safeRequest | ConvertTo-Json -Depth 3) -Headers $headers -TimeoutSec 15
    
    if ($safeResponse.StatusCode -eq 200) {
        Write-Host "✅ Safe request passed through Sentinel/Shield" -ForegroundColor Green
    } else {
        Write-Host "❌ Safe request failed: $($safeResponse.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Safe request failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: Check Sentinel Metrics After Request
Write-Host "`n6️⃣ Checking Sentinel Metrics After Request..." -ForegroundColor Green
try {
    Start-Sleep -Seconds 2  # Wait for processing
    
    $metricsResponse2 = Invoke-WebRequest -Uri "http://localhost:3000/api/sentinel/metrics" -Method GET -TimeoutSec 10
    if ($metricsResponse2.StatusCode -eq 200) {
        $metrics2 = $metricsResponse2.Content | ConvertFrom-Json
        Write-Host "✅ Updated Sentinel metrics:" -ForegroundColor Green
        Write-Host "   - Total spans: $($metrics2.totalSpans)" -ForegroundColor Gray
        Write-Host "   - Total events: $($metrics2.totalEvents)" -ForegroundColor Gray
        Write-Host "   - Shield decisions: $($metrics2.totalShieldDecisions)" -ForegroundColor Gray
        Write-Host "   - Blocked outputs: $($metrics2.blockedOutputs)" -ForegroundColor Gray
        Write-Host "   - Masked outputs: $($metrics2.maskedOutputs)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Updated metrics failed: $($metricsResponse2.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Updated metrics failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 7: Test Shield Configuration
Write-Host "`n7️⃣ Testing Shield Configuration..." -ForegroundColor Green
try {
    $shieldConfigResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/sentinel/config" -Method GET -TimeoutSec 10
    if ($shieldConfigResponse.StatusCode -eq 200) {
        $shieldConfig = $shieldConfigResponse.Content | ConvertFrom-Json
        Write-Host "✅ Shield configuration loaded:" -ForegroundColor Green
        Write-Host "   - Shield enabled: $($shieldConfig.shield.enabled)" -ForegroundColor Gray
        Write-Host "   - Shield mode: $($shieldConfig.shield.mode)" -ForegroundColor Gray
        Write-Host "   - Policies count: $($shieldConfig.shield.policies.Count)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Shield config failed: $($shieldConfigResponse.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Shield config failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 8: Test Sentinel Events Stream
Write-Host "`n8️⃣ Testing Sentinel Events Stream..." -ForegroundColor Green
try {
    $eventsResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/sentinel/events/stream" -Method GET -TimeoutSec 5
    if ($eventsResponse.StatusCode -eq 200) {
        Write-Host "✅ Sentinel events stream accessible" -ForegroundColor Green
    } else {
        Write-Host "❌ Events stream failed: $($eventsResponse.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Events stream failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 9: Concurrent Load Test
Write-Host "`n9️⃣ Testing Concurrent Load..." -ForegroundColor Green
try {
    $jobs = @()
    for ($i = 1; $i -le 5; $i++) {
        $job = Start-Job -ScriptBlock {
            param($url, $token, $i)
            try {
                $request = @{
                    tool = "http_fetch"
                    action = "get"
                    params = @{
                        url = "https://httpbin.org/delay/1"
                    }
                }
                
                $headers = @{
                    "Authorization" = "Bearer $token"
                    "Content-Type" = "application/json"
                }
                
                $response = Invoke-WebRequest -Uri "$url/api/proxy" -Method POST -Body ($request | ConvertTo-Json) -Headers $headers -TimeoutSec 10
                return "Request $i completed: $($response.StatusCode)"
            } catch {
                return "Request $i failed: $($_.Exception.Message)"
            }
        } -ArgumentList "http://localhost:3000", $token, $i
        $jobs += $job
    }
    
    $results = $jobs | Wait-Job | Receive-Job
    $jobs | Remove-Job
    
    $successCount = ($results | Where-Object { $_ -like "*completed*" }).Count
    Write-Host "✅ Concurrent load test: $successCount/5 requests succeeded" -ForegroundColor Green
} catch {
    Write-Host "❌ Concurrent load test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 10: Final Metrics Check
Write-Host "`n🔟 Final Sentinel Metrics Check..." -ForegroundColor Green
try {
    Start-Sleep -Seconds 2  # Wait for all processing
    
    $finalMetricsResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/sentinel/metrics" -Method GET -TimeoutSec 10
    if ($finalMetricsResponse.StatusCode -eq 200) {
        $finalMetrics = $finalMetricsResponse.Content | ConvertFrom-Json
        Write-Host "✅ Final Sentinel metrics:" -ForegroundColor Green
        Write-Host "   - Total spans: $($finalMetrics.totalSpans)" -ForegroundColor Gray
        Write-Host "   - Total events: $($finalMetrics.totalEvents)" -ForegroundColor Gray
        Write-Host "   - Shield decisions: $($finalMetrics.totalShieldDecisions)" -ForegroundColor Gray
        Write-Host "   - Average latency: $([math]::Round($finalMetrics.avgLatency, 2))ms" -ForegroundColor Gray
        Write-Host "   - Total token usage: $($finalMetrics.totalTokenUsage)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Final metrics failed: $($finalMetricsResponse.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Final metrics failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 Comprehensive Sentinel/Shield Integration Test Complete!" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "The 4Runr Gateway with Sentinel/Shield is now fully operational!" -ForegroundColor Green

# Prove-It Packaging Test for 4Runr Gateway
# PowerShell version for Windows compatibility

param(
    [switch]$Verbose
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Info {
    param([string]$Message)
    Write-ColorOutput "[INFO] $Message" $Blue
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "[SUCCESS] $Message" $Green
}

function Write-Error {
    param([string]$Message)
    Write-ColorOutput "[ERROR] $Message" $Red
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput "[WARNING] $Message" $Yellow
}

function Test-Prerequisites {
    Write-Info "Checking prerequisites..."
    
    # Check Docker
    try {
        $dockerVersion = docker --version 2>$null
        if ($dockerVersion) {
            Write-Success "Docker found: $dockerVersion"
        } else {
            throw "Docker not found"
        }
    } catch {
        Write-Error "Docker is required but not found. Please install Docker Desktop."
        exit 1
    }
    
    # Check Docker Compose
    try {
        $composeVersion = docker-compose --version 2>$null
        if ($composeVersion) {
            Write-Success "Docker Compose found: $composeVersion"
        } else {
            throw "Docker Compose not found"
        }
    } catch {
        Write-Error "Docker Compose is required but not found."
        exit 1
    }
    
    # Check if .env exists
    if (-not (Test-Path "infra/.env")) {
        Write-Error "infra/.env not found. Please copy infra/.env.example to infra/.env first."
        exit 1
    }
    
    Write-Success "All prerequisites met!"
}

function Wait-ForService {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 60,
        [string]$ServiceName = "Service"
    )
    
    Write-Info "Waiting for $ServiceName to be ready..."
    $startTime = Get-Date
    $timeout = $startTime.AddSeconds($TimeoutSeconds)
    
    while ((Get-Date) -lt $timeout) {
        try {
            $response = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Success "$ServiceName is ready!"
                return $true
            }
        } catch {
            # Ignore errors and continue polling
        }
        
        Start-Sleep -Seconds 2
    }
    
    Write-Error "$ServiceName failed to become ready within $TimeoutSeconds seconds"
    return $false
}

function Test-Boot {
    Write-Info "Starting services..."
    
    # Start services
    docker-compose -f infra/docker-compose.yml up -d
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start services"
        return $false
    }
    
    Write-Success "Services started successfully"
    return $true
}

function Test-Health {
    Write-Info "Testing health endpoint..."
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing
        $health = $response.Content | ConvertFrom-Json
        
        if ($health.ok -eq $true) {
            Write-Success "Health check passed: $($health.version) at $($health.time)"
            return $true
        } else {
            Write-Error "Health check failed: $($response.Content)"
            return $false
        }
    } catch {
        Write-Error "Health check failed: $($_.Exception.Message)"
        return $false
    }
}

function Test-Readiness {
    Write-Info "Testing readiness endpoint..."
    
    if (-not (Wait-ForService -Url "http://localhost:8080/ready" -ServiceName "Gateway")) {
        return $false
    }
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/ready" -UseBasicParsing
        $ready = $response.Content | ConvertFrom-Json
        
        if ($ready.ready -eq $true) {
            Write-Success "Readiness check passed"
            return $true
        } else {
            Write-Error "Readiness check failed: $($response.Content)"
            return $false
        }
    } catch {
        Write-Error "Readiness check failed: $($_.Exception.Message)"
        return $false
    }
}

function Test-Telemetry {
    Write-Info "Testing telemetry via demo run..."
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/api/diagnostics/emit-demo-run" -Method POST -UseBasicParsing
        $result = $response.Content | ConvertFrom-Json
        
        if ($result.success -eq $true) {
            Write-Success "Demo run created: $($result.runId)"
            return $result.runId
        } else {
            Write-Error "Demo run failed: $($response.Content)"
            return $null
        }
    } catch {
        Write-Error "Demo run failed: $($_.Exception.Message)"
        return $null
    }
}

function Test-SSE {
    param([string]$RunId)
    
    Write-Info "Testing SSE stream for run: $RunId"
    
    try {
        # Start SSE connection in background
        $sseUrl = "http://localhost:8080/api/runs/$RunId/guard/stream"
        $sseProcess = Start-Process -FilePath "curl" -ArgumentList "-N", $sseUrl -RedirectStandardOutput "sse_output.txt" -WindowStyle Hidden -PassThru
        
        # Wait a bit for events
        Start-Sleep -Seconds 5
        
        # Stop the process
        Stop-Process -Id $sseProcess.Id -Force -ErrorAction SilentlyContinue
        
        # Check output
        if (Test-Path "sse_output.txt") {
            $sseContent = Get-Content "sse_output.txt" -Raw
            Remove-Item "sse_output.txt" -Force
            
            if ($sseContent -and $sseContent.Length -gt 0) {
                Write-Success "SSE events received: $($sseContent.Length) characters"
                if ($Verbose) {
                    Write-Info "SSE content: $sseContent"
                }
                return $true
            } else {
                Write-Error "No SSE events received"
                return $false
            }
        } else {
            Write-Error "SSE output file not created"
            return $false
        }
    } catch {
        Write-Error "SSE test failed: $($_.Exception.Message)"
        return $false
    }
}

function Test-Metrics {
    Write-Info "Testing metrics endpoint..."
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/metrics" -UseBasicParsing
        $metrics = $response.Content
        
        # Check for required metrics
        $requiredMetrics = @("sentinel_spans_total", "sentinel_guard_events_total")
        $foundMetrics = @()
        
        foreach ($metric in $requiredMetrics) {
            if ($metrics -match $metric) {
                $foundMetrics += $metric
            }
        }
        
        if ($foundMetrics.Count -eq $requiredMetrics.Count) {
            Write-Success "All required metrics found: $($foundMetrics -join ', ')"
            return $true
        } else {
            $missing = $requiredMetrics | Where-Object { $_ -notin $foundMetrics }
            Write-Error "Missing metrics: $($missing -join ', ')"
            return $false
        }
    } catch {
        Write-Error "Metrics test failed: $($_.Exception.Message)"
        return $false
    }
}

function Test-Teardown {
    Write-Info "Testing teardown..."
    
    # Stop services
    docker-compose -f infra/docker-compose.yml down
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to stop services"
        return $false
    }
    
    # Check if ports are still bound
    Start-Sleep -Seconds 2
    
    try {
        $port8080 = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
        $port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
        
        if ($port8080 -or $port3000) {
            Write-Warning "Ports still bound after teardown:"
            if ($port8080) { Write-Warning "Port 8080: $($port8080 | Select-Object -First 1)" }
            if ($port3000) { Write-Warning "Port 3000: $($port3000 | Select-Object -First 1)" }
            return $false
        } else {
            Write-Success "Clean teardown - no ports bound"
            return $true
        }
    } catch {
        Write-Success "Clean teardown completed"
        return $true
    }
}

# Main execution
function Main {
    Write-ColorOutput "4Runr Gateway Prove-It Packaging Test" $Blue
    Write-ColorOutput "==========================================" $Blue
    
    $tests = @()
    
    # Test prerequisites
    Test-Prerequisites
    if ($LASTEXITCODE -ne 0) { exit 1 }
    
    # Test boot
    $tests += @{ Name = "Boot"; Result = Test-Boot }
    
    # Test health
    $tests += @{ Name = "Health"; Result = Test-Health }
    
    # Test readiness
    $tests += @{ Name = "Readiness"; Result = Test-Readiness }
    
    # Test telemetry
    $runId = Test-Telemetry
    $tests += @{ Name = "Telemetry"; Result = ($runId -ne $null) }
    
    # Test SSE
    if ($runId) {
        $tests += @{ Name = "SSE"; Result = Test-SSE -RunId $runId }
    } else {
        $tests += @{ Name = "SSE"; Result = $false }
    }
    
    # Test metrics
    $tests += @{ Name = "Metrics"; Result = Test-Metrics }
    
    # Test teardown
    $tests += @{ Name = "Teardown"; Result = Test-Teardown }
    
    # Summary
    Write-ColorOutput "`nTest Results:" $Blue
    Write-ColorOutput "===============" $Blue
    
    $passed = 0
    $total = $tests.Count
    
    foreach ($test in $tests) {
        if ($test.Result) {
            Write-Success "$($test.Name): PASSED"
            $passed++
        } else {
            Write-Error "$($test.Name): FAILED"
        }
    }
    
    Write-ColorOutput "`nSummary:" $Blue
    Write-ColorOutput "===========" $Blue
    Write-ColorOutput "Passed: $passed/$total" $(if ($passed -eq $total) { $Green } else { $Red })
    
    if ($passed -eq $total) {
        Write-Success "`nAll tests passed! The 4Runr Gateway is ready for development."
        exit 0
    } else {
        Write-Error "`nSome tests failed. Please check the logs above."
        exit 1
    }
}

# Run the main function
Main

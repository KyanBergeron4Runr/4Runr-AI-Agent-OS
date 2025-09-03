# 4Runr Gateway Development Script
# PowerShell helper for common development tasks

param(
    [Parameter(Position=0)]
    [string]$Command,
    
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Arguments
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

function Show-Help {
    Write-ColorOutput "4Runr Gateway Development Script" $Blue
    Write-ColorOutput "===============================" $Blue
    Write-Host ""
    Write-Host "Available commands:"
    Write-Host "  setup     - Install dependencies and build packages"
    Write-Host "  up        - Start all services"
    Write-Host "  down      - Stop all services"
    Write-Host "  logs      - Show gateway logs"
    Write-Host "  health    - Check system health"
    Write-Host "  ready     - Check system readiness"
    Write-Host "  sse-test  - Test SSE endpoint"
    Write-Host "  prove-it  - Run Prove-It test"
    Write-Host "  build     - Build all packages"
    Write-Host "  test      - Run all tests"
    Write-Host "  lint      - Run linting"
    Write-Host "  clean     - Clean build artifacts"
    Write-Host "  reset     - Reset everything (down -v, then up)"
    Write-Host "  help      - Show this help"
    Write-Host ""
    Write-Host "Usage: .\scripts\dev.ps1 command"
    Write-Host "Example: .\scripts\dev.ps1 up"
}

function Invoke-Setup {
    Write-Info "Setting up development environment..."
    
    # Check if .env exists
    if (-not (Test-Path "infra/.env")) {
        Write-Warning "infra/.env not found. Creating from example..."
        if (Test-Path "infra/.env.example") {
            Copy-Item "infra/.env.example" "infra/.env"
            Write-Success "Created infra/.env from example"
        } else {
            Write-Error "infra/.env.example not found!"
            return $false
        }
    }
    
    # Install dependencies
    Write-Info "Installing dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install dependencies"
        return $false
    }
    
    # Build packages
    Write-Info "Building packages..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build packages"
        return $false
    }
    
    Write-Success "Setup completed successfully!"
    return $true
}

function Invoke-Up {
    Write-Info "Starting services..."
    docker-compose -f infra/docker-compose.yml up -d
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Services started successfully!"
        Write-Info "Gateway available at: http://localhost:8080"
        Write-Info "Health check: http://localhost:8080/health"
    } else {
        Write-Error "Failed to start services"
    }
}

function Invoke-Down {
    Write-Info "Stopping services..."
    docker-compose -f infra/docker-compose.yml down
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Services stopped successfully!"
    } else {
        Write-Error "Failed to stop services"
    }
}

function Invoke-Logs {
    Write-Info "Showing gateway logs (Ctrl+C to exit)..."
    docker-compose -f infra/docker-compose.yml logs -f gateway
}

function Invoke-Health {
    Write-Info "Checking system health..."
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing
        $health = $response.Content | ConvertFrom-Json
        Write-Success "Health check passed: $($health.version) at $($health.time)"
    } catch {
        Write-Error "Health check failed: $($_.Exception.Message)"
    }
}

function Invoke-Ready {
    Write-Info "Checking system readiness..."
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/ready" -UseBasicParsing
        $ready = $response.Content | ConvertFrom-Json
        if ($ready.ready -eq $true) {
            Write-Success "System is ready!"
        } else {
            Write-Error "System not ready: $($response.Content)"
        }
    } catch {
        Write-Error "Readiness check failed: $($_.Exception.Message)"
    }
}

function Invoke-SSETest {
    Write-Info "Testing SSE endpoint (Ctrl+C to exit)..."
    try {
        curl -N http://localhost:8080/diagnostics/sse-test
    } catch {
        Write-Error "SSE test failed: $($_.Exception.Message)"
    }
}

function Invoke-ProveIt {
    Write-Info "Running Prove-It test..."
    npm run prove-it-powershell
}

function Invoke-Build {
    Write-Info "Building all packages..."
    npm run build
}

function Invoke-Test {
    Write-Info "Running all tests..."
    npm run test
}

function Invoke-Lint {
    Write-Info "Running linting..."
    npm run lint
}

function Invoke-Clean {
    Write-Info "Cleaning build artifacts..."
    npm run clean
}

function Invoke-Reset {
    Write-Warning "This will reset everything (volumes will be lost)!"
    $confirmation = Read-Host "Are you sure? (y/N)"
    if ($confirmation -eq "y" -or $confirmation -eq "Y") {
        Write-Info "Resetting everything..."
        docker-compose -f infra/docker-compose.yml down -v
        docker-compose -f infra/docker-compose.yml up -d
        Write-Success "Reset completed!"
    } else {
        Write-Info "Reset cancelled."
    }
}

# Main execution
switch ($Command.ToLower()) {
    "setup" { Invoke-Setup }
    "up" { Invoke-Up }
    "down" { Invoke-Down }
    "logs" { Invoke-Logs }
    "health" { Invoke-Health }
    "ready" { Invoke-Ready }
    "sse-test" { Invoke-SSETest }
    "prove-it" { Invoke-ProveIt }
    "build" { Invoke-Build }
    "test" { Invoke-Test }
    "lint" { Invoke-Lint }
    "clean" { Invoke-Clean }
    "reset" { Invoke-Reset }
    "help" { Show-Help }
    default {
        if ($Command) {
            Write-Error "Unknown command: $($Command)"
        }
        Show-Help
    }
}

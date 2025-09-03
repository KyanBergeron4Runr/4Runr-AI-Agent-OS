@echo off
echo 🚀 Starting 4Runr Gateway Sandbox Environment
echo =============================================

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running. Please start Docker first.
    pause
    exit /b 1
)

echo 📦 Building and starting services...
docker-compose -f docker-compose.sandbox.yml up -d --build

echo ⏳ Waiting for services to be ready...
timeout /t 10 /nobreak >nul

echo 🔍 Checking service health...
echo.

REM Check Gateway
curl -f http://localhost:3000/api/health >nul 2>&1
if not errorlevel 1 (
    echo ✅ Gateway is running at http://localhost:3000
) else (
    echo ⚠️  Gateway is still starting up...
)

echo.
echo 🎯 SANDBOX ENVIRONMENT READY!
echo ==============================
echo.
echo 📱 Sandbox UI:        http://localhost:8080/sandbox.html
echo 🔧 Gateway API:       http://localhost:3000
echo 📊 Prometheus:        http://localhost:9090
echo 📈 Grafana:           http://localhost:3001 (admin/sandbox)
echo 📖 Documentation:     http://localhost:8080/docs/
echo.
echo 🧪 QUICK START:
echo 1. Open the Sandbox UI: http://localhost:8080/sandbox.html
echo 2. Create an agent and generate a token
echo 3. Make API calls and watch live metrics
echo 4. Test security by making unauthorized requests
echo.
echo 📊 To view metrics in Grafana:
echo 1. Go to http://localhost:3001
echo 2. Login with admin/sandbox
echo 3. Import the 4Runr Gateway dashboard
echo.
echo 🛑 To stop the sandbox:
echo    docker-compose -f docker-compose.sandbox.yml down
echo.
echo 📋 To view logs:
echo    docker-compose -f docker-compose.sandbox.yml logs -f gateway
echo.

REM Open sandbox in browser
start http://localhost:8080/sandbox.html

pause

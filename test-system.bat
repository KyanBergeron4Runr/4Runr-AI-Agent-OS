@echo off
echo 🧪 Testing 4Runr Gateway System...

REM Check if gateway is running
echo 🔍 Checking gateway status...
node cli.js status >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Gateway is not running. Starting it now...
    start /B node simple-gateway.js
    timeout /t 3 /nobreak >nul
)

REM Test basic functionality
echo 📋 Testing basic functionality...
node cli.js status
if %errorlevel% neq 0 (
    echo ❌ Gateway health check failed
    pause
    exit /b 1
)

echo ✅ Gateway is healthy

REM Test agent listing
echo 📋 Testing agent listing...
node cli.js list
if %errorlevel% neq 0 (
    echo ❌ Agent listing failed
    pause
    exit /b 1
)

echo ✅ Agent listing works

REM Test run creation
echo 🚀 Testing run creation...
node cli.js run demo-enricher
if %errorlevel% neq 0 (
    echo ❌ Run creation failed
    pause
    exit /b 1
)

echo ✅ Run creation works

REM Test run listing
echo 📋 Testing run listing...
node cli.js ps
if %errorlevel% neq 0 (
    echo ❌ Run listing failed
    pause
    exit /b 1
)

echo ✅ Run listing works

REM Run the full Prove-It test
echo 🧪 Running comprehensive Prove-It test...
node prove-it-agents-runs.js
if %errorlevel% neq 0 (
    echo ❌ Prove-It test failed
    pause
    exit /b 1
)

echo 🎉 All tests passed! System is 100% operational.
pause

@echo off
echo ========================================
echo STARTING ENHANCED GATEWAY (BACKGROUND)
echo ========================================
echo.
echo This will start the enhanced gateway in the background:
echo - Sentinel/Shield integration
echo - Security headers
echo - Missing endpoints implemented
echo - Improved performance
echo - Guard events SSE
echo.

echo Stopping any existing gateway processes...
taskkill /f /im node.exe >nul 2>&1

echo.
echo Starting enhanced gateway in background...
start /B node registry-gateway-enhanced.js

echo.
echo Waiting for gateway to start...
timeout /t 3 /nobreak >nul

echo.
echo Checking if gateway is running...
curl -s http://localhost:3000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Enhanced gateway is running successfully!
    echo 📍 URL: http://localhost:3000
    echo 📍 Health: http://localhost:3000/health
    echo 📍 Metrics: http://localhost:3000/metrics
    echo.
    echo The gateway will continue running in the background.
    echo To stop it, run: .\stop-reliable.bat
) else (
    echo ❌ Gateway failed to start properly
    echo Check the logs above for errors
)

echo.
echo ========================================
echo GATEWAY STARTUP COMPLETE
echo ========================================

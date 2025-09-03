@echo off
echo ========================================
echo T1 COMPREHENSIVE FUNCTIONALITY TEST
echo ========================================
echo.
echo This test will:
echo - Start the registry gateway
echo - Run comprehensive T1 test (ALL features)
echo - Test agents, runs, privacy, registry, caps, SSE
echo - Catch ALL issues and provide detailed report
echo.
echo Press any key to start...
pause >nul

echo.
echo 🚀 Starting Registry Gateway...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
start /B node registry-gateway.js

echo Waiting for gateway to start...
timeout /t 5 /nobreak >nul

echo.
echo 🧪 Running T1 Comprehensive Test...
echo This will take 5-10 minutes and test EVERYTHING
echo.
node T1-comprehensive-test.js

echo.
echo 📊 Test Complete!
echo Check T1-comprehensive-results.json for detailed results
echo.
pause

@echo off
echo 🚀 Starting 4Runr Gateway REAL Demo
echo ====================================

echo 📦 Starting the REAL gateway...
start /B npm start

echo ⏳ Waiting for gateway to start...
timeout /t 8 /nobreak >nul

echo 🔍 Testing gateway connection...
curl -f http://localhost:3000/api/health >nul 2>&1
if not errorlevel 1 (
    echo ✅ REAL Gateway is running!
    echo.
    echo 🎯 Opening REAL Demo...
    start live-real-demo.html
) else (
    echo ⚠️ Gateway is still starting up...
    echo 💡 The demo will connect automatically when ready
    start live-real-demo.html
)

echo.
echo 🎉 REAL Demo ready!
echo ===================
echo.
echo 📱 Demo URL: live-real-demo.html
echo 🔧 Gateway: http://localhost:3000
echo.
echo 💡 The demo will show REAL functionality:
echo    - Real agent creation with private keys
echo    - Real JWT token generation and validation
echo    - Real API requests through the gateway
echo    - Real security enforcement
echo    - Real metrics collection
echo.
pause

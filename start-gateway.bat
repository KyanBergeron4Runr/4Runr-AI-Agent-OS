@echo off
echo 🚀 Starting 4Runr Gateway with robust process management...

REM Kill any existing Node.js processes on port 3000
echo 🔍 Checking for existing processes on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    echo Stopping process %%a
    taskkill /PID %%a /F >nul 2>&1
)

REM Wait a moment for processes to fully stop
timeout /t 2 /nobreak >nul

REM Check if port 3000 is free
netstat -an | findstr :3000 >nul
if %errorlevel% equ 0 (
    echo ❌ Port 3000 is still in use. Please check manually.
    pause
    exit /b 1
)

echo ✅ Port 3000 is free, starting gateway...

REM Start the gateway
node simple-gateway.js

REM If we get here, the gateway has stopped
echo 🛑 Gateway has stopped.
pause

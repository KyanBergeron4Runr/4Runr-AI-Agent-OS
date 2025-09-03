@echo off
echo 🛑 Stopping 4Runr Gateway...

REM Find and kill Node.js processes running simple-gateway.js
echo 🔍 Finding gateway processes...
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO CSV ^| findstr node') do (
    echo Checking process %%a
    wmic process where "ProcessId=%%a" get CommandLine /format:list | findstr simple-gateway >nul
    if !errorlevel! equ 0 (
        echo Stopping gateway process %%a
        taskkill /PID %%a /F
    )
)

REM Also kill any process using port 3000
echo 🔍 Stopping processes on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    echo Stopping process %%a
    taskkill /PID %%a /F >nul 2>&1
)

echo ✅ Gateway stopped successfully.
pause

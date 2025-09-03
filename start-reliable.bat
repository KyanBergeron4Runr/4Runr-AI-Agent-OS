@echo off
echo Starting 4Runr Gateway...

REM Kill any existing Node.js processes
taskkill /F /IM node.exe >nul 2>&1

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Start the gateway
node simple-gateway.js

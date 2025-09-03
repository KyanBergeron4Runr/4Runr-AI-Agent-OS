@echo off
echo Stopping 4Runr Gateway...

REM Kill all Node.js processes
taskkill /F /IM node.exe >nul 2>&1

echo Gateway stopped.
pause

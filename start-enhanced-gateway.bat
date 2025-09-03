@echo off
echo ========================================
echo STARTING ENHANCED GATEWAY
echo ========================================
echo.
echo This will start the enhanced gateway with:
echo - Sentinel/Shield integration
echo - Security headers
echo - Missing endpoints implemented
echo - Improved performance
echo - Guard events SSE
echo.

echo Stopping any existing gateway processes...
taskkill /f /im node.exe >nul 2>&1

echo.
echo Starting enhanced gateway...
node registry-gateway-enhanced.js

echo.
echo Enhanced gateway stopped.

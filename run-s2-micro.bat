@echo off
echo ========================================
echo S2 Micro Smoke Test (60 Seconds)
echo ========================================
echo.
echo Starting S2 Micro Smoke Test...
echo Duration: 60 seconds
echo Workloads: 4 SSE clients, 2 runs
echo Expected: Both runs succeed, 0-1 SSE reconnects, no availability errors
echo.
echo Press Ctrl+C to stop early
echo.

node s2-micro-smoke.js

echo.
echo ========================================
echo S2 Micro Smoke Test Complete
echo ========================================
echo.
pause

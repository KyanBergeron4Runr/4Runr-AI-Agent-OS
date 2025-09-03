@echo off
echo ========================================
echo S2 Smoke Test (15 Minutes)
echo ========================================
echo.
echo Starting S2 Smoke Test...
echo Duration: 15 minutes
echo Workloads: W1-W6 (chaos disabled)
echo Expected: ~45 runs, 20 SSE, continuous heartbeats
echo.
echo Press Ctrl+C to stop early
echo.

node s2-smoke-test.js

echo.
echo ========================================
echo S2 Smoke Test Complete
echo ========================================
echo.
echo Check results in:
echo - s2-smoke-results-*.json
echo - s2-logs/s2-smoke-*.log
echo.
pause

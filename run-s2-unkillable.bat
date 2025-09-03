@echo off
echo ========================================
echo S2 Unkillable Harness (120 Minutes)
echo ========================================
echo.
echo Starting S2 Unkillable Harness...
echo Duration: 120 minutes (2 hours)
echo Workloads: W1-W6 with chaos events
echo Expected: ~360 runs, 20 SSE, chaos at 45/75/90m
echo.
echo Chaos Events:
echo - T+45m: Redis restart
echo - T+75m: Gateway restart  
echo - T+90m: +150ms latency injection
echo.
echo Press Ctrl+C to stop early
echo.

node s2-harness-unkillable.js

echo.
echo ========================================
echo S2 Unkillable Harness Complete
echo ========================================
echo.
echo Check results in:
echo - s2-unkillable-results-*.json
echo - s2-logs/s2-harness-*.log
echo - s2-snapshot-*.json (every 10 minutes)
echo.
pause

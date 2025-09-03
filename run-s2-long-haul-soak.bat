@echo off
echo ========================================
echo S2 — LONG-HAUL SOAK (2 HOURS)
echo ZERO-LEAK CERTIFICATION TEST
echo ========================================
echo.
echo This will run a comprehensive 2-hour soak test
echo to validate system stability and catch slow leaks.
echo.
echo Prerequisites:
echo - Gateway must be running on localhost:3000
echo - Demo agents must be available
echo - Plan set to Pro for testing
echo - Privacy mode default storePlain=true
echo.
echo Workloads:
echo - W1: Realistic runs (3 runs/min)
echo - W2: SSE churn (40 concurrent clients)
echo - W3: Registry pulse (every 10 min)
echo - W4: Safety probes (every 15 min)
echo - W5: Privacy slice (every 20 min)
echo - W6: Light chaos (45/75/90 min)
echo.
echo KPIs to validate:
echo - Availability ≥ 99.9%
echo - Latency targets (P95/P99)
echo - SSE reconnect success ≥ 99%
echo - Error rate ≤ 0.5%
echo - Zero memory/file handle leaks
echo - 100% safety compliance
echo - Zero privacy leaks
echo.
echo Press any key to start the 2-hour test...
pause >nul

echo.
echo 🚀 Starting S2 Long-Haul Soak Test...
echo 📊 Duration: 120 minutes
echo 📈 Expected runs: ~360 total
echo 🔄 SSE churn: Every 5 minutes
echo 🛡️ Safety probes: Every 15 minutes
echo 🔒 Privacy slices: Every 20 minutes
echo 💥 Chaos events: 45/75/90 minutes
echo.
echo Test will run continuously for 2 hours.
echo Monitor the output for real-time progress.
echo.

REM Run the S2 long-haul soak test
node s2-long-haul-soak.js

echo.
echo ========================================
echo S2 LONG-HAUL SOAK TEST COMPLETE
echo ========================================
echo.
echo Check the results file for detailed analysis.
echo Look for: s2-long-haul-soak-results-*.json
echo.
echo Key artifacts captured:
echo - Metrics snapshots every 10 minutes
echo - Histogram cuts at 30/60/90/120 min
echo - System metrics (RSS/CPU/FDs)
echo - SSE connection statistics
echo - Safety compliance data
echo - Privacy leak detection
echo - Registry integrity checks
echo.
pause

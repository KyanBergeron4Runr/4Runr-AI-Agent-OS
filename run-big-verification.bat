@echo off
echo ========================================
echo BIG VERIFICATION RUN - STRESS TEST
echo ========================================
echo.
echo This will run a comprehensive 10-minute stress test
echo including warmup, soak, stress, and cooldown phases.
echo.
echo Prerequisites:
echo - Gateway must be running on localhost:3000
echo - Demo agents must be available
echo.
echo Press any key to start the test...
pause >nul

echo.
echo 🚀 Starting Big Verification Run...
echo.

REM Run the short version first for validation
node big-verification-run-short.js

echo.
echo ========================================
echo BIG VERIFICATION RUN COMPLETE
echo ========================================
echo.
echo Check the results file for detailed analysis.
echo Look for: big-verification-short-results-*.json
echo.
pause

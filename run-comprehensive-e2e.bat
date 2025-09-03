@echo off
echo ========================================
echo COMPREHENSIVE E2E TEST - SYSTEM PROOF
echo ========================================
echo.
echo This test will:
echo - Prove end-to-end correctness
echo - Deliberately shake out bugs
echo - Test bad states, race conditions
echo - Check privacy leaks, idempotency errors
echo - Validate SSE edge cases
echo - Test signing and caps enforcement
echo.
echo Starting comprehensive E2E test...
echo.

node T1-comprehensive-e2e-test.js

echo.
echo ========================================
echo COMPREHENSIVE E2E TEST COMPLETE
echo ========================================
echo.
echo Check the results file for detailed analysis
echo Look for T1-comprehensive-e2e-results-*.json

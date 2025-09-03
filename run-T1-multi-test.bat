@echo off
echo ========================================
echo T1 MULTI-TEST AUTOMATION
echo ========================================
echo.
echo This will run T1 tests multiple times
echo No user interaction required
echo Finding ALL issues automatically
echo.

set TEST_COUNT=3
set CURRENT_TEST=1

:test_loop
echo.
echo ========================================
echo RUNNING TEST %CURRENT_TEST% OF %TEST_COUNT%
echo ========================================
echo.

node T1-full-auto-test.js > T1-test-run-%CURRENT_TEST%.txt 2>&1

echo.
echo Test %CURRENT_TEST% completed
echo Results saved to: T1-test-run-%CURRENT_TEST%.txt
echo.

if %CURRENT_TEST% LSS %TEST_COUNT% (
    set /a CURRENT_TEST+=1
    echo Waiting 5 seconds before next test...
    timeout /t 5 /nobreak >nul
    goto test_loop
)

echo.
echo ========================================
echo ALL TESTS COMPLETED
echo ========================================
echo.
echo Test runs completed: %TEST_COUNT%
echo Check individual results in:
echo - T1-test-run-1.txt
echo - T1-test-run-2.txt
echo - T1-test-run-3.txt
echo.
echo Final results in: T1-full-auto-results.json
echo.

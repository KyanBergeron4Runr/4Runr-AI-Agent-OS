@echo off
echo ========================================
echo VERIFYING ENHANCED GATEWAY FIXES
echo ========================================
echo.
echo This will verify that all critical issues have been fixed:
echo - Sentinel/Shield integration
echo - Security headers
echo - Missing endpoints
echo - Performance improvements
echo - Guard events SSE
echo.

echo Running verification tests...
node T1-verify-fixes.js

echo.
echo ========================================
echo VERIFICATION COMPLETE
echo ========================================
echo.
echo Check the results above and the generated JSON file
echo for detailed verification results.

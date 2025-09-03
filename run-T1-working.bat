@echo off
echo ========================================
echo T1 WORKING FUNCTIONALITY TEST
echo ========================================
echo.
echo This test will:
echo - Use the registry gateway (already running)
echo - Test what actually works
echo - Adapt to gateway capabilities
echo - Provide comprehensive report
echo.
echo Press any key to start...
pause >nul

echo.
echo 🧪 Running T1 Working Test...
echo This will test the actual gateway capabilities
echo.
node T1-working-test.js

echo.
echo 📊 Test Complete!
echo Check T1-working-results.json for detailed results
echo.
pause

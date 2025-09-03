@echo off
echo Testing 4Runr Registry System...

echo.
echo 1. Testing registry CLI help...
node registry-cli.js help

echo.
echo 2. Testing registry search...
node registry-cli.js search "demo"

echo.
echo 3. Testing registry show...
node registry-cli.js show demo/hello-world

echo.
echo 4. Running Prove-It Registry Test...
node prove-it-registry-mvp.js

echo.
echo Registry system test complete!
pause

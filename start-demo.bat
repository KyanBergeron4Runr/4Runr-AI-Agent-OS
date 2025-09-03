@echo off
echo 🚀 Starting 4Runr Gateway Demo
echo ==============================

echo 📦 Setting up environment...
set DATABASE_URL=file:./dev.db
set PORT=3000
set REDIS_URL=redis://localhost:6379
set TOKEN_HMAC_SECRET=test-hmac-secret-change-me-in-production
set SECRETS_BACKEND=env
set HTTP_TIMEOUT_MS=6000
set DEFAULT_TIMEZONE=America/Toronto
set KEK_BASE64=VWlfSPt7wF0WlLOIlPxB6AkLgbJOREL3x1ijF/xlEkU=
set NODE_ENV=development

echo 🔧 Setting up database...
npx prisma generate
npx prisma db push

echo 🚀 Starting gateway...
start /B npm start

echo ⏳ Waiting for gateway to start...
timeout /t 5 /nobreak >nul

echo 🎯 Opening demo...
start simple-real-demo.html

echo.
echo 🎉 Demo ready!
echo ==============
echo.
echo 📱 Demo URL: simple-real-demo.html
echo 🔧 Gateway: http://localhost:3000
echo.
echo 💡 The demo shows:
echo    - Real agent creation with private keys
echo    - Real API proxy functionality
echo    - Real security enforcement
echo.
pause

@echo off
echo 🚀 Starting 4Runr Gateway (Simple Mode)
echo ======================================

echo 📦 Setting environment variables...
set DATABASE_URL=file:./dev.db
set PORT=3000
set REDIS_URL=redis://localhost:6379
set TOKEN_HMAC_SECRET=sandbox-secret-key-not-for-production
set SECRETS_BACKEND=env
set HTTP_TIMEOUT_MS=30000
set DEFAULT_TIMEZONE=UTC
set KEK_BASE64=c2FuZGJveC1lbmNyeXB0aW9uLWtleS1ub3QtZm9yLXByb2R1Y3Rpb24=
set NODE_ENV=development

echo 🔧 Initializing database...
npx prisma generate
npx prisma db push

echo 🚀 Starting gateway...
npm start

pause

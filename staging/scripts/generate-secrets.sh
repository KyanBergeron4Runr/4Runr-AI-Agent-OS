#!/usr/bin/env bash
set -euo pipefail

# 4Runr Gateway Staging - Secret Generation Script
# This script generates secure secrets for the staging environment

echo "🔐 Generating secure secrets for 4Runr Gateway Staging..."

# Create secrets directory
mkdir -p secrets

# Generate KEK (Key Encryption Key) - 32 bytes base64
echo "🔑 Generating KEK (Key Encryption Key)..."
KEK_BASE64=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
echo "KEK_BASE64=$KEK_BASE64"

# Generate HMAC secret - 32 bytes hex
echo "🔑 Generating HMAC secret..."
TOKEN_HMAC_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "TOKEN_HMAC_SECRET=$TOKEN_HMAC_SECRET"

# Generate signing secret - 32 bytes hex
echo "🔑 Generating signing secret..."
SIGNING_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "SIGNING_SECRET=$SIGNING_SECRET"

# Generate database password - 16 bytes base64
echo "🔑 Generating database password..."
DB_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(16).toString('base64'))")
echo "DB_PASSWORD=$DB_PASSWORD"

# Generate Redis password - 16 bytes base64
echo "🔑 Generating Redis password..."
REDIS_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(16).toString('base64'))")
echo "REDIS_PASSWORD=$REDIS_PASSWORD"

# Generate RSA key pair for gateway
echo "🔑 Generating RSA key pair..."
mkdir -p temp-keys
openssl genrsa -out temp-keys/gateway-private.pem 2048
openssl rsa -in temp-keys/gateway-private.pem -pubout -out temp-keys/gateway-public.pem

# Convert private key to base64
GATEWAY_PRIVATE_KEY=$(base64 -w 0 temp-keys/gateway-private.pem)
echo "GATEWAY_PRIVATE_KEY=$GATEWAY_PRIVATE_KEY"

# Clean up temporary files
rm -rf temp-keys

# Create .env file with generated secrets
echo "📝 Creating .env file..."
cat > .env << EOF
# 4Runr Gateway Staging Environment Configuration
# Generated on $(date)

# === REQUIRED CONFIGURATION ===
PORT=3000
DATABASE_URL=postgresql://gateway:${DB_PASSWORD}@db:5432/gateway
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
TOKEN_HMAC_SECRET=${TOKEN_HMAC_SECRET}
SECRETS_BACKEND=file
SECRETS_FILE=/run/secrets/4runr-secrets.json
HTTP_TIMEOUT_MS=6000
DEFAULT_TIMEZONE=America/Toronto

# 32-byte base64 for KEK
KEK_BASE64=${KEK_BASE64}

# === DATABASE CONFIGURATION ===
DB_PASSWORD=${DB_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}

# === FEATURE FLAGS ===
UPSTREAM_MODE=mock        # start with mock; switch to live later
FF_POLICY=on
FF_BREAKERS=on
FF_RETRY=on
FF_CACHE=on
FF_ASYNC=on
FF_CHAOS=off              # keep off in staging
FF_TEST_BYPASS=off        # keep off in staging

# === LOGGING ===
LOG_LEVEL=info
LOG_FORMAT=json

# === SECURITY ===
GATEWAY_PRIVATE_KEY=${GATEWAY_PRIVATE_KEY}
SIGNING_SECRET=${SIGNING_SECRET}

# === MONITORING ===
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30s
EOF

# Create secrets file template
echo "📝 Creating secrets file template..."
cat > secrets/4runr-secrets.json << EOF
{
  "serpapi": { 
    "api_key": { 
      "v1": "REPLACE_WITH_SERPAPI_KEY" 
    } 
  },
  "openai": { 
    "api_key": { 
      "v1": "REPLACE_WITH_OPENAI_KEY" 
    } 
  },
  "gmail_send": { 
    "api_key": { 
      "v1": "REPLACE_WITH_GMAIL_KEY" 
    } 
  }
}
EOF

# Set proper permissions
chmod 600 .env
chmod 600 secrets/4runr-secrets.json

echo ""
echo "✅ Secrets generated successfully!"
echo ""
echo "📋 Generated secrets:"
echo "  - KEK_BASE64: ${KEK_BASE64:0:20}..."
echo "  - TOKEN_HMAC_SECRET: ${TOKEN_HMAC_SECRET:0:20}..."
echo "  - SIGNING_SECRET: ${SIGNING_SECRET:0:20}..."
echo "  - DB_PASSWORD: ${DB_PASSWORD:0:20}..."
echo "  - REDIS_PASSWORD: ${REDIS_PASSWORD:0:20}..."
echo "  - GATEWAY_PRIVATE_KEY: ${GATEWAY_PRIVATE_KEY:0:50}..."
echo ""
echo "📁 Files created:"
echo "  - .env (chmod 600)"
echo "  - secrets/4runr-secrets.json (chmod 600)"
echo ""
echo "⚠️  IMPORTANT:"
echo "1. Update secrets/4runr-secrets.json with your actual API keys"
echo "2. Keep .env and secrets files secure - never commit to git"
echo "3. Backup these secrets securely"
echo ""
echo "🚀 Ready to deploy with: ./deploy.sh"

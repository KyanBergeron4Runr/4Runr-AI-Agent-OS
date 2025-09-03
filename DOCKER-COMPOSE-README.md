# 🐳 4Runr Gateway - Docker Compose Setup

## 🚀 **One Command to Run Everything**

```bash
# Setup environment
cp config/env.example config/.env
# Edit config/.env with your values

# Start everything
make up
make migrate
make seed
make smoke
```

## 📋 **Prerequisites**

- Docker Desktop running
- Make (or use the commands directly)
- jq (for JSON parsing in smoke tests)

## 🔧 **Setup Instructions**

### 1. **Copy Environment File**
```bash
cp config/env.example config/.env
```

### 2. **Edit Environment Variables**
Edit `config/.env` and set your values:
```bash
# Required - Update these with your values
PORT=3000
DATABASE_URL=postgresql://gateway:gateway@db:5432/gateway
REDIS_URL=redis://redis:6379
TOKEN_HMAC_SECRET=your-secure-hmac-secret
SECRETS_BACKEND=env
HTTP_TIMEOUT_MS=6000
DEFAULT_TIMEZONE=America/Toronto
KEK_BASE64=your-32-byte-base64-key

# Optional - Feature flags
FF_CACHE=on
FF_RETRY=on
FF_BREAKERS=on
FF_ASYNC=on
FF_POLICY=on
UPSTREAM_MODE=live

# Development secrets (for testing)
serpapi.api_key=dev-serpapi
openai.api_key=dev-openai
gmail_send.api_key=dev-gmail
```

### 3. **Generate KEK (Key Encryption Key)**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 🎯 **Make Commands**

| Command | Description |
|---------|-------------|
| `make up` | Build & start full stack (PostgreSQL + Redis + Gateway) |
| `make down` | Stop & remove volumes |
| `make logs` | Tail gateway logs |
| `make migrate` | Run Prisma migrations |
| `make seed` | Seed baseline policies |
| `make smoke` | Run end-to-end smoke test |
| `make smoke-win` | Run smoke test (Windows PowerShell) |
| `make ps` | Show running containers |

## 🧪 **Smoke Test**

The smoke test verifies:
- ✅ Health endpoints (`/health`, `/ready`)
- ✅ Agent creation
- ✅ Token generation
- ✅ Happy path (allowed request)
- ✅ Policy denial (403 for unauthorized)
- ✅ Metrics collection

### Run Smoke Test:
```bash
# Linux/Mac
make smoke

# Windows
make smoke-win
```

## 📊 **Services**

### **PostgreSQL (db)**
- **Port**: 5432
- **Database**: gateway
- **User**: gateway
- **Password**: gateway
- **Health Check**: `pg_isready`

### **Redis (redis)**
- **Port**: 6379
- **Health Check**: `redis-cli ping`

### **4Runr Gateway (gateway)**
- **Port**: 3000
- **Health Check**: `curl /ready`
- **Dependencies**: PostgreSQL, Redis

## 🔍 **Health Endpoints**

### `/health` - Basic Health
```json
{
  "ok": true,
  "timestamp": "2025-08-12T00:00:00.000Z",
  "uptime": 12345,
  "memory": { "used": 12345678, "total": 23456789 },
  "process": { "pid": 1234, "version": "v20.0.0" }
}
```

### `/ready` - Readiness Check
```json
{
  "ready": true,
  "timestamp": "2025-08-12T00:00:00.000Z",
  "checks": {
    "database": true,
    "circuitBreakers": {},
    "cache": true
  }
}
```

## 🌱 **Seeded Data**

The seed script creates baseline policies:

### **Scraper Policy**
- **Role**: scraper
- **Scopes**: serpapi:search, http_fetch:get, http_fetch:head
- **Intent**: data_collection
- **Quotas**: 100 searches/day, 500 fetches/day

### **Enricher Policy**
- **Role**: enricher
- **Scopes**: http_fetch:get, openai:chat, openai:complete
- **Intent**: data_enrichment
- **Quotas**: 50 AI calls/day, 200 fetches/day

### **Engager Policy**
- **Role**: engager
- **Scopes**: gmail_send:send, gmail_send:profile
- **Intent**: communication
- **Quotas**: 10 emails/day

## 🔧 **Troubleshooting**

### **Port Already in Use**
```bash
# Check what's using port 3000
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Mac/Linux

# Kill the process
taskkill /PID <PID> /F        # Windows
kill -9 <PID>                 # Mac/Linux
```

### **Database Connection Issues**
```bash
# Check if PostgreSQL is running
docker compose ps db

# View database logs
docker compose logs db
```

### **Gateway Won't Start**
```bash
# Check environment validation
docker compose logs gateway

# Verify .env file exists
ls -la config/.env
```

### **Smoke Test Fails**
```bash
# Check if all services are healthy
docker compose ps

# View gateway logs
docker compose logs gateway

# Test health endpoints manually
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

## 🚀 **Production Deployment**

For production, update these in `config/.env`:

```bash
# Use strong secrets
TOKEN_HMAC_SECRET=your-production-hmac-secret-here
KEK_BASE64=your-production-32-byte-base64-key

# Use production database
DATABASE_URL=postgresql://user:pass@prod-db:5432/gateway

# Use production Redis
REDIS_URL=redis://prod-redis:6379

# Disable dev features
UPSTREAM_MODE=live
```

## 📈 **Monitoring**

### **Metrics Endpoint**
```bash
curl http://localhost:3000/metrics
```

### **Container Health**
```bash
docker compose ps
```

### **Resource Usage**
```bash
docker stats
```

## 🔄 **Development Workflow**

```bash
# Start development environment
make up

# View logs
make logs

# Run tests
make smoke

# Stop everything
make down
```

---

**Status**: ✅ **READY** - One command to run Postgres + Redis + Gateway with full smoke test!

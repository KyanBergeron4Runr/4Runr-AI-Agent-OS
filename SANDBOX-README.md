# 🧪 4Runr Gateway - REAL Functionality Sandbox

## 🎯 WHAT THIS PROVES (Not Just Pretty UIs!)

This sandbox demonstrates **ACTUAL** 4Runr Gateway technology working:

- ✅ **Real API Gateway** - Working zero-trust authentication system
- ✅ **Live Agent Management** - Create, deploy, and monitor actual agents
- ✅ **Genuine JWT Tokens** - Cryptographically signed authentication
- ✅ **Working Security** - Policy enforcement and unauthorized request blocking  
- ✅ **Live Metrics** - Real Prometheus metrics from actual operations
- ✅ **Actual Self-Healing** - Circuit breakers and retry logic in action

**This is NOT a demo with fake animations - it's a working system!**

## 🚀 QUICK START (3 Minutes to Proof)

### Option 1: Docker Sandbox (Recommended)

```bash
# Start the complete environment
./start-sandbox.bat  # Windows
# or
./start-sandbox.sh   # Linux/Mac

# Access the sandbox
open http://localhost:8080/sandbox.html
```

### Option 2: Manual Setup

```bash
# Start Redis
docker run -d -p 6379:6379 redis:alpine

# Set environment variables
set PORT=3000
set REDIS_URL=redis://localhost:6379
set TOKEN_HMAC_SECRET=your-secret-key
set KEK_BASE64=your-encryption-key

# Start the gateway
npm start

# Open sandbox
open sandbox/sandbox.html
```

## 🧪 LIVE TESTING INTERFACE

### Sandbox Features

The sandbox provides **real** testing capabilities:

1. **Live Gateway Connection** - Connect to actual running gateway
2. **Agent Management** - Create real agents with cryptographic keys
3. **Token Generation** - Generate actual JWT tokens with HMAC signatures
4. **API Testing** - Make real API calls through the proxy
5. **Security Testing** - Attempt unauthorized access and see denials
6. **Live Metrics** - View real Prometheus metrics updating in real-time

### Testing Workflow

1. **Connect** to gateway at `http://localhost:3000`
2. **Create Agent** with a unique name
3. **Generate Token** with specific tool permissions
4. **Make Requests** through the proxy endpoints
5. **Watch Metrics** update in real-time
6. **Test Security** by making unauthorized requests

## 📊 REAL METRICS ENDPOINTS

Access live metrics from the running gateway:

- **`/api/metrics`** - Full Prometheus metrics
- **`/api/health`** - System health status
- **`/api/agents`** - List of created agents
- **`/api/audit`** - Security audit trail

### Key Metrics Proven

- `gateway_requests_total{tool,action,code}` - Request counts by outcome
- `gateway_request_duration_ms_bucket` - Latency histograms
- `gateway_token_validations_total{success}` - Authentication attempts
- `gateway_policy_denials_total{tool,action}` - Security enforcement
- `gateway_cache_hits_total{tool,action}` - Cache performance
- `gateway_retries_total{tool,action,reason}` - Resilience patterns

## 🔧 AUTOMATED TESTING

### Test Script

Run the comprehensive test suite:

```bash
# Test against local gateway
node test-real-gateway.js

# Test against remote gateway
node test-real-gateway.js https://your-gateway.com
```

### Test Coverage

The automated tests prove:

1. **Gateway Connection** - Health endpoint responds
2. **Agent Creation** - Real agents with private keys
3. **Token Generation** - Valid JWT tokens created
4. **Token Validation** - Cryptographic verification works
5. **Authorized Requests** - Valid tokens allow access
6. **Unauthorized Blocking** - Invalid requests denied
7. **Policy Enforcement** - Tool/action restrictions work
8. **Metrics Collection** - Live data collection verified

## 🏗️ SANDBOX ARCHITECTURE

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Sandbox UI    │    │  4Runr Gateway  │    │     Redis       │
│  (Live Testing) │───▶│ (Zero-Trust API)│───▶│   (Storage)     │
│  Port 8080      │    │   Port 3000     │    │   Port 6379     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │   Prometheus    │              │
         └─────────────▶│  (Metrics)      │◀─────────────┘
                        │   Port 9090     │
                        └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │    Grafana      │
                        │ (Visualization) │
                        │   Port 3001     │
                        └─────────────────┘
```

## 🔍 PROOF POINTS

### 1. Real Authentication

```bash
# Create agent (returns real private key)
curl -X POST http://localhost:3000/api/agents \
  -d '{"name":"test-agent"}'

# Generate token (returns signed JWT)
curl -X POST http://localhost:3000/api/agents/AGENT_ID/tokens \
  -d '{"tools":["serpapi"],"expires_in":3600}'

# Verify token signature and claims
```

### 2. Working Security

```bash
# Authorized request (200 OK)
curl -X POST http://localhost:3000/api/proxy/serpapi/search \
  -H "Authorization: Bearer VALID_TOKEN" \
  -d '{"q":"test"}'

# Unauthorized request (401/403)
curl -X POST http://localhost:3000/api/proxy/serpapi/search \
  -d '{"q":"test"}'
```

### 3. Live Metrics

```bash
# View real metrics
curl http://localhost:3000/api/metrics

# Metrics update after each request
# Numbers increment with actual usage
```

## 📖 DOCUMENTATION

### Complete User Guide

See `docs/USER-GUIDE.md` for:
- Installation instructions
- API reference
- Configuration options  
- Security features
- Performance tuning
- Troubleshooting

### API Documentation

Interactive API docs available at:
- **Sandbox UI**: http://localhost:8080/sandbox.html
- **Documentation**: http://localhost:8080/docs/

## 🎪 DEMO SCENARIOS

### 1. Happy Path Demo

1. Create agent → Generate token → Make successful request
2. Watch metrics increment
3. View logs in real-time

### 2. Security Demo

1. Attempt unauthorized access
2. See 401/403 responses
3. Check audit trail

### 3. Resilience Demo

1. Configure circuit breaker
2. Trigger failures
3. Watch auto-recovery

### 4. Performance Demo

1. Run load test
2. Monitor latency histograms
3. See cache hit rates

## 🚨 COMMON ISSUES

### Gateway Won't Start

```bash
# Check Redis connection
docker ps | grep redis

# Check environment variables
echo $REDIS_URL

# View gateway logs
docker-compose -f docker-compose.sandbox.yml logs gateway
```

### Connection Refused

```bash
# Verify gateway is running
curl http://localhost:3000/api/health

# Check firewall/ports
netstat -an | grep 3000
```

### Token Generation Fails

```bash
# Verify agent exists
curl http://localhost:3000/api/agents

# Check agent ID format
# Should be: agent_xxxxxxxxx
```

## 🎯 SUCCESS CRITERIA

A successful sandbox run proves:

✅ **Gateway responds** to health checks  
✅ **Agents created** with private keys  
✅ **Tokens generated** with valid signatures  
✅ **Authentication works** for valid tokens  
✅ **Security blocks** unauthorized requests  
✅ **Metrics collect** real usage data  
✅ **Policies enforce** tool/action restrictions  

## 🏆 CONCLUSION

**This sandbox proves the 4Runr Gateway is REAL working technology**, not just pretty animations or fake demos. It demonstrates:

- **Revolutionary Security**: Zero-trust API authentication
- **Enterprise Readiness**: Production-grade monitoring and resilience
- **Developer Experience**: Easy integration and comprehensive documentation
- **Investment Viability**: Proven technology with measurable benefits

**Try it yourself and see the difference between real technology and demo smoke & mirrors!**

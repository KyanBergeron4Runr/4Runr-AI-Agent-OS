# 🚀 4Runr Gateway - Live Sandbox Environment

## 🎯 WHAT THIS PROVES

This sandbox demonstrates the **REAL** 4Runr Gateway technology:

1. **Live API Gateway** - Working zero-trust authentication
2. **Real Agent Management** - Deploy, monitor, and heal actual agents  
3. **Live Metrics** - Real Prometheus metrics, not fake numbers
4. **Actual Security** - Token validation, policy enforcement
5. **Working Self-Healing** - Real failure detection and recovery

## 🏗️ SANDBOX COMPONENTS

### 1. Live API Testing Interface
- **Real API calls** to actual 4Runr Gateway
- **Token generation** and validation
- **Policy enforcement** demonstration
- **Live metrics** from real operations

### 2. Agent Deployment Sandbox
- **Deploy real agents** with actual code
- **Monitor agent health** with real status
- **Trigger failures** and watch self-healing
- **View real logs** from running agents

### 3. Security Testing Suite
- **Zero-trust verification** with real tokens
- **Policy violation** testing
- **Rate limiting** demonstration
- **Audit trail** with real events

### 4. Performance Benchmarks
- **Real latency measurements**
- **Throughput testing**
- **Resource usage** monitoring
- **SLO verification**

## 🚀 QUICK START

### Option 1: Docker Sandbox (Recommended)
```bash
# Start the complete sandbox environment
docker-compose up -d

# Access the sandbox UI
open http://localhost:3000

# View real metrics
open http://localhost:3000/metrics
```

### Option 2: Local Development
```bash
# Install dependencies
npm install

# Start the gateway
npm start

# Start the sandbox UI
npm run sandbox

# Access at http://localhost:3001
```

## 🧪 LIVE DEMONSTRATIONS

### 1. Token Lifecycle Demo
- Create agent → Generate token → Validate → Expire
- **Real JWT tokens** with actual cryptographic signatures
- **Policy enforcement** with tool/action restrictions

### 2. Self-Healing Demo  
- Deploy agent → Inject failure → Watch auto-recovery
- **Real process monitoring** with health checks
- **Exponential backoff** retry logic

### 3. Security Demo
- Attempt unauthorized access → See policy denial
- **Zero-trust verification** at every request
- **Real audit logs** with security events

### 4. Performance Demo
- Load testing with real traffic
- **Live latency histograms**
- **Circuit breaker** activation under load

## 📊 REAL METRICS ENDPOINTS

- `/api/metrics` - Prometheus metrics (live)
- `/api/health` - System health status
- `/api/agents` - Agent status and logs
- `/api/audit` - Security audit trail

## 🔧 CONFIGURATION

Edit `sandbox/config.yaml` to customize:
- Security policies
- Agent configurations  
- Rate limits
- Health check intervals

## 📖 USER DOCUMENTATION

See `/docs` for complete API reference and user guides.

---

**This sandbox proves the 4Runr Gateway actually works - not just pretty animations!**

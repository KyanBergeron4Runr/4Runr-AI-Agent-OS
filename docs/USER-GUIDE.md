# 📖 4Runr Gateway - Complete User Guide

## 🎯 WHAT IS 4RUNR GATEWAY?

4Runr Gateway is a **zero-trust API security platform** that provides:

- **Agent-based authentication** with fine-grained access control
- **Real-time monitoring** with Prometheus metrics
- **Automatic healing** and circuit breaker patterns
- **Policy enforcement** for tools and actions
- **Complete audit trail** for security compliance

## 🚀 QUICK START

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/your-org/4runr-gateway
cd 4runr-gateway

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### 2. Required Environment Variables

```bash
# Gateway Configuration
PORT=3000
REDIS_URL=redis://localhost:6379
TOKEN_HMAC_SECRET=your-secret-key-here
SECRETS_BACKEND=env
HTTP_TIMEOUT_MS=30000
DEFAULT_TIMEZONE=UTC
KEK_BASE64=your-base64-encryption-key
```

### 3. Start the Gateway

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The gateway will be available at `http://localhost:3000`

## 🤖 AGENT MANAGEMENT

### Creating an Agent

Agents are the core entities that access tools through the gateway.

```bash
# Create a new agent
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-data-processor",
    "description": "Processes customer data"
  }'
```

**Response:**
```json
{
  "id": "agent_123abc",
  "name": "my-data-processor",
  "description": "Processes customer data",
  "created_at": "2024-01-15T10:30:00Z",
  "private_key": "-----BEGIN PRIVATE KEY-----\n..."
}
```

**🔑 Important:** Save the `private_key` - it's only shown once!

### Listing Agents

```bash
curl http://localhost:3000/api/agents
```

### Getting Agent Details

```bash
curl http://localhost:3000/api/agents/agent_123abc
```

## 🔐 TOKEN MANAGEMENT

### Generating Access Tokens

Tokens provide time-limited access to specific tools and actions.

```bash
# Generate a token for an agent
curl -X POST http://localhost:3000/api/agents/agent_123abc/tokens \
  -H "Content-Type: application/json" \
  -d '{
    "tools": ["serpapi", "http_fetch"],
    "actions": ["search", "get"],
    "expires_in": 3600
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600,
  "tools": ["serpapi", "http_fetch"],
  "actions": ["search", "get"]
}
```

### Token Validation

```bash
# Validate a token
curl -X POST http://localhost:3000/api/validate \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🔧 MAKING API CALLS

### Proxy Requests

All API calls go through the gateway's proxy endpoint:

```bash
# Make a search request through SerpAPI
curl -X POST http://localhost:3000/api/proxy/serpapi/search \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "q": "4runr gateway security",
    "engine": "google"
  }'
```

### Supported Tools

| Tool | Actions | Description |
|------|---------|-------------|
| `serpapi` | `search` | Search engine results |
| `http_fetch` | `get`, `post` | HTTP requests |
| `code_exec` | `run` | Code execution (sandboxed) |

### Error Handling

The gateway returns standard HTTP status codes:

- `200` - Success
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (policy violation)
- `429` - Rate limited
- `500` - Internal server error

## 📊 MONITORING & METRICS

### Prometheus Metrics

Access real-time metrics at `/api/metrics`:

```bash
curl http://localhost:3000/api/metrics
```

**Key Metrics:**
- `gateway_requests_total` - Total requests by tool/action/status
- `gateway_request_duration_ms` - Request latency histogram  
- `gateway_token_validations_total` - Token validation attempts
- `gateway_policy_denials_total` - Policy violations
- `gateway_cache_hits_total` - Cache hit ratio
- `gateway_retries_total` - Retry attempts
- `gateway_breaker_state` - Circuit breaker status

### Health Checks

```bash
# Check gateway health
curl http://localhost:3000/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "uptime": 87234,
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 🛡️ SECURITY FEATURES

### Zero-Trust Architecture

Every request requires:
1. **Valid JWT token** with HMAC signature
2. **Agent authorization** for the requested tool
3. **Action permission** for the specific operation
4. **Rate limiting** to prevent abuse

### Policy Enforcement

The gateway enforces fine-grained policies:

```yaml
# Example policy configuration
policies:
  serpapi:
    search:
      rate_limit: 100/hour
      allowed_agents: ["data-processor", "research-bot"]
  
  http_fetch:
    get:
      rate_limit: 1000/hour
      blocked_domains: ["internal.company.com"]
```

### Audit Trail

All requests are logged with:
- Agent ID and token info
- Tool and action requested
- Request/response payload (configurable)
- Timestamp and outcome
- Policy decisions

## 🔄 RESILIENCE PATTERNS

### Circuit Breakers

Automatic failure protection:
- **Closed**: Normal operation
- **Open**: Failures exceed threshold, requests fast-fail
- **Half-Open**: Testing recovery after timeout

### Retry Logic

Automatic retry with exponential backoff:
- Network timeouts
- 5xx server errors  
- Rate limit responses
- Configurable max attempts

### Caching

Intelligent caching for:
- Search results (TTL configurable)
- HTTP responses (based on headers)
- Token validation (short-term)

## 📈 PERFORMANCE TUNING

### Configuration Options

```yaml
# config/production.yaml
gateway:
  timeout: 30000
  max_connections: 1000
  
rate_limiting:
  window: 3600  # 1 hour
  max_requests: 1000
  
caching:
  ttl: 300  # 5 minutes
  max_size: 1000
  
circuit_breaker:
  failure_threshold: 5
  timeout: 60000
  success_threshold: 2
```

### Scaling

- **Horizontal**: Multiple gateway instances behind load balancer
- **Vertical**: Increase CPU/memory for single instance
- **Database**: Redis cluster for high availability
- **Monitoring**: Prometheus + Grafana for observability

## 🧪 TESTING WITH SANDBOX

### Live Sandbox

Use the included sandbox to test with a real gateway:

```bash
# Open the sandbox in your browser
open sandbox/sandbox.html
```

The sandbox provides:
- **Real API testing** with actual gateway
- **Token lifecycle** demonstration
- **Security testing** with policy violations
- **Live metrics** from running gateway
- **Interactive documentation**

### Test Scenarios

1. **Happy Path**: Create agent → Generate token → Make request
2. **Security**: Attempt unauthorized access → See denial
3. **Resilience**: Trigger failures → Watch auto-recovery
4. **Performance**: Load testing → Monitor metrics

## 🔧 TROUBLESHOOTING

### Common Issues

**Gateway won't start:**
```bash
# Check environment variables
npm run check-env

# Check Redis connection
redis-cli ping
```

**Token generation fails:**
```bash
# Verify agent exists
curl http://localhost:3000/api/agents/YOUR_AGENT_ID

# Check logs for errors
npm run logs
```

**Requests fail with 403:**
- Verify token includes required tools
- Check policy configuration
- Review audit logs for denial reason

**Performance issues:**
- Monitor `/api/metrics` for bottlenecks
- Check Redis memory usage
- Review circuit breaker status

### Debug Mode

Enable detailed logging:

```bash
# Set debug environment
export DEBUG=4runr:*
npm start
```

### Support

- **Documentation**: `/docs`
- **API Reference**: `/api/docs`
- **Issues**: GitHub Issues
- **Community**: Discord Server

---

**This guide shows how to use the REAL 4Runr Gateway, not just a demo!**

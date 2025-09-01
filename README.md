# 4Runr AI Agent OS - Production Gateway

A high-performance, production-ready gateway for AI agent orchestration and execution management.

## 🚀 System Overview

The 4Runr Gateway is a robust HTTP server designed to handle AI agent runs with enterprise-grade features including input validation, idempotency, real-time streaming, and comprehensive monitoring.

## ✨ Key Features

### 🔒 **Input Validation & Security**
- **Strict JSON schema validation** for all requests
- **Configurable body size limits** (default: 256KB)
- **Field validation** with type checking, length limits, and pattern matching
- **4xx error responses** for malformed requests (never 5xx)
- **Rate limiting** with configurable thresholds

### 🔄 **Idempotency**
- **Client token deduplication** prevents duplicate runs
- **Configurable TTL** (default: 24 hours)
- **Race condition handling** with atomic operations
- **Automatic cleanup** of expired tokens

### 📡 **Real-Time Streaming**
- **Server-Sent Events (SSE)** for live run monitoring
- **Last-Event-ID support** for connection resumption
- **Automatic reconnection** handling
- **Connection lifecycle management**

### 🎛️ **Run Management**
- **Create runs** with validation and idempotency
- **Start runs** with status tracking
- **Cancel runs** mid-execution
- **Status monitoring** with real-time updates

### 📊 **Monitoring & Metrics**
- **Prometheus-compatible metrics** endpoint
- **Real-time connection tracking**
- **Performance monitoring**
- **Error rate tracking**
- **Resource utilization metrics**

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │  4Runr Gateway  │    │   AI Agents     │
│                 │    │                 │    │                 │
│ • Web Apps      │◄──►│ • HTTP Server   │◄──►│ • Run Execution │
│ • Mobile Apps   │    │ • Validation    │    │ • Status Updates│
│ • CLI Tools     │    │ • Idempotency   │    │ • Log Streaming │
│ • SDKs          │    │ • Rate Limiting │    │ • Cancellation  │
└─────────────────┘    │ • SSE Streaming │    └─────────────────┘
                       │ • Metrics       │
                       └─────────────────┘
```

## 📈 Performance Results

### 🔥 **1-Hour Stress Test Results**

```
🔥 1-HOUR STRESS TEST COMPLETED
============================================================
⏱️  Duration: 60m 0s
📊 Total Requests: 124,980
✅ Successful: 124,980 (100.0%)
❌ Failed: 0 (0.0%)
📈 Requests/Second: 34.72
🔗 Total SSE Connections: 30
🏃 Total Runs Created: 49,428
❌ Runs Cancelled: 5,062
🔄 Idempotency Hits: 21,062
⚡ Rate Limit Hits: 0
📊 Metrics Collected: 120
📁 Artifacts Saved: 11
💥 Total Errors: 0
📊 Overall Result: ✅ PASSED (Error rate: 0.0%)
```

### 📊 **Load Test Configuration**
- **Concurrent Users**: 10
- **Requests per User/Second**: 2
- **Total Load**: 20 requests/second sustained
- **SSE Connections**: 30 concurrent streams
- **Idempotency Reuse**: 30% of requests
- **Cancellation Rate**: 10% of runs

## 🧪 Test Coverage

### ✅ **Integration Flow Test**
```
🎯 INTEGRATION FLOW TEST RESULTS
===========================================================
✅ Passed: 15
❌ Failed: 0
📊 Success Rate: 100.0%
🎉 Overall Result: PASSED
```

**Test Steps Completed:**
1. ✅ Prerequisites Check
2. ✅ Test Identity & Consistency
3. ✅ Agent Publish (Mock)
4. ✅ Client Discover (Mock)
5. ✅ Create Run (with Idempotency)
6. ✅ Start Run
7. ✅ Stream Output (SSE)
8. ✅ Mid-Run Cancel
9. ✅ Resume SSE (Last-Event-ID)
10. ✅ Run Completion
11. ✅ Metrics Reconciliation
12. ✅ Logs & Artifacts Collection

### 🔧 **Feature Tests**
- ✅ Input validation (422, 413, 400 responses)
- ✅ Idempotency (same token = same run ID)
- ✅ Rate limiting (429 responses)
- ✅ Cancellation (202 responses)
- ✅ SSE streaming and resume
- ✅ Error handling (no 5xx errors)

## 📋 API Documentation

### **Base URL**
```
http://localhost:3000
```

### **Core Endpoints**

#### `GET /health`
Health check with version and configuration info.

**Response:**
```json
{
  "ok": true,
  "version": "2.0.0",
  "time": "2025-09-01T01:42:30.123Z",
  "config": {
    "bodyLimitBytes": 262144,
    "rateLimitEnabled": false,
    "rateLimitPerSec": 50
  }
}
```

#### `GET /ready`
Readiness probe for load balancers.

**Response:**
```json
{
  "ready": true,
  "timestamp": "2025-09-01T01:42:30.123Z"
}
```

#### `GET /metrics`
Prometheus-compatible metrics in plain text format.

**Response:**
```
# HELP runs_total Total number of runs
# TYPE runs_total counter
runs_total 49428

# HELP sse_connections_opened Total SSE connections opened
# TYPE sse_connections_opened counter
sse_connections_opened 1245

# HELP sse_connections_closed Total SSE connections closed
# TYPE sse_connections_closed counter
sse_connections_closed 1245

# HELP sse_active_connections Active SSE connections
# TYPE sse_active_connections gauge
sse_active_connections 0

# HELP sse_messages_total Total SSE messages sent
# TYPE sse_messages_total counter
sse_messages_total 2489

# HELP idempotency_store_size Current idempotency store size
# TYPE idempotency_store_size gauge
idempotency_store_size 1245
```

### **Run Management Endpoints**

#### `POST /api/runs`
Create a new run with validation and idempotency.

**Request Body:**
```json
{
  "name": "My AI Agent Run",
  "input": {
    "prompt": "Analyze this data",
    "data": "sample data"
  },
  "client_token": "unique-client-token-123",
  "tags": ["analysis", "ai-agent"]
}
```

**Validation Rules:**
- `name`: Required string, max 128 chars, non-empty
- `input`: Optional string or object, max 64KB string or 128KB object
- `client_token`: Optional string, 8-128 chars, alphanumeric + underscore + dash
- `tags`: Optional array, max 16 items, each max 64 chars

**Success Response (201):**
```json
{
  "success": true,
  "run": {
    "id": "run-1756690920472-49420",
    "name": "My AI Agent Run",
    "status": "created",
    "created_at": "2025-09-01T01:42:30.123Z",
    "updated_at": "2025-09-01T01:42:30.123Z",
    "input": {
      "prompt": "Analyze this data",
      "data": "sample data"
    },
    "output": null,
    "logs": [],
    "tags": ["analysis", "ai-agent"],
    "client_token": "unique-client-token-123"
  }
}
```

**Idempotent Response (200):**
```json
{
  "success": true,
  "run": {
    "id": "run-1756690920472-49420",
    "name": "My AI Agent Run",
    "status": "completed",
    "created_at": "2025-09-01T01:42:30.123Z",
    "updated_at": "2025-09-01T01:42:35.456Z",
    "input": {
      "prompt": "Analyze this data",
      "data": "sample data"
    },
    "output": "Analysis completed successfully",
    "logs": [...],
    "tags": ["analysis", "ai-agent"],
    "client_token": "unique-client-token-123"
  },
  "idempotent": true
}
```

**Validation Error (422):**
```json
{
  "error": "Validation failed",
  "details": [
    "name is required",
    "client_token must be at least 8 characters"
  ]
}
```

**Rate Limit Error (429):**
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 2
}
```

#### `GET /api/runs/:id`
Get run status and details.

**Response:**
```json
{
  "success": true,
  "run": {
    "id": "run-1756690920472-49420",
    "name": "My AI Agent Run",
    "status": "in-progress",
    "created_at": "2025-09-01T01:42:30.123Z",
    "updated_at": "2025-09-01T01:42:32.456Z",
    "started_at": "2025-09-01T01:42:31.789Z",
    "input": {...},
    "output": null,
    "logs": [...],
    "tags": ["analysis", "ai-agent"]
  }
}
```

**Not Found (404):**
```json
{
  "error": "Run not found"
}
```

#### `POST /api/runs/:id/start`
Start run execution.

**Response (200):**
```json
{
  "success": true,
  "run": {
    "id": "run-1756690920472-49420",
    "name": "My AI Agent Run",
    "status": "in-progress",
    "started_at": "2025-09-01T01:42:31.789Z",
    "updated_at": "2025-09-01T01:42:31.789Z"
  }
}
```

**Already Started (409):**
```json
{
  "error": "Run already started"
}
```

#### `POST /api/runs/:id/cancel`
Cancel a running run.

**Response (202):**
```json
{
  "success": true,
  "run": {
    "id": "run-1756690920472-49420",
    "name": "My AI Agent Run",
    "status": "canceled",
    "canceled_at": "2025-09-01T01:42:35.123Z",
    "updated_at": "2025-09-01T01:42:35.123Z"
  }
}
```

**Already Canceled (409):**
```json
{
  "error": "Run already canceled"
}
```

### **Real-Time Streaming Endpoints**

#### `GET /api/runs/:id/logs/stream`
Server-Sent Events stream for real-time run monitoring.

**Headers:**
```
Accept: text/event-stream
Last-Event-ID: 5  # Optional, for resuming connection
```

**Event Format:**
```
id: 1
data: {"type":"connected","runId":"run-1756690920472-49420","timestamp":"2025-09-01T01:42:30.123Z"}

id: 2
data: {"type":"status_update","runId":"run-1756690920472-49420","status":"in-progress","timestamp":"2025-09-01T01:42:35.456Z"}

id: 3
data: {"type":"final","runId":"run-1756690920472-49420","status":"completed","timestamp":"2025-09-01T01:42:40.789Z"}
```

**Event Types:**
- `connected`: Initial connection established
- `status_update`: Run status changed
- `final`: Run completed/failed/canceled

#### `GET /api/sse/stream`
General SSE endpoint for system-wide events.

**Event Format:**
```json
{
  "type": "heartbeat",
  "clientId": "sse-general-1756690920472-0.123",
  "timestamp": "2025-09-01T01:42:30.123Z",
  "activeConnections": 5
}
```

#### `GET /diagnostics/sse-test`
Test SSE endpoint for debugging.

**Event Format:**
```json
{
  "type": "test",
  "timestamp": "2025-09-01T01:42:30.123Z",
  "message": "SSE test event",
  "activeConnections": 3
}
```

## 🧪 Testing Examples

### **Using curl**

#### Create a Run
```bash
curl -X POST http://localhost:3000/api/runs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Run",
    "input": {"message": "Hello World"},
    "client_token": "test-token-12345",
    "tags": ["test", "demo"]
  }'
```

#### Start a Run
```bash
curl -X POST http://localhost:3000/api/runs/run-1756690920472-49420/start
```

#### Cancel a Run
```bash
curl -X POST http://localhost:3000/api/runs/run-1756690920472-49420/cancel
```

#### Connect to SSE Stream
```bash
curl -H "Accept: text/event-stream" \
  http://localhost:3000/api/runs/run-1756690920472-49420/logs/stream
```

#### Resume SSE Connection
```bash
curl -H "Accept: text/event-stream" \
  -H "Last-Event-ID: 5" \
  http://localhost:3000/api/runs/run-1756690920472-49420/logs/stream
```

#### Get Metrics
```bash
curl http://localhost:3000/metrics
```

### **Using JavaScript**

#### Create and Monitor a Run
```javascript
// Create run
const createResponse = await fetch('http://localhost:3000/api/runs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'JavaScript Test Run',
    input: { message: 'Hello from JS' },
    client_token: 'js-test-12345',
    tags: ['javascript', 'test']
  })
});

const { run } = await createResponse.json();

// Start run
await fetch(`http://localhost:3000/api/runs/${run.id}/start`, {
  method: 'POST'
});

// Connect to SSE stream
const eventSource = new EventSource(`http://localhost:3000/api/runs/${run.id}/logs/stream`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('SSE Event:', data);
  
  if (data.type === 'final') {
    eventSource.close();
  }
};
```

### **Using Python**

#### Python Client Example
```python
import requests
import json

# Create run
response = requests.post('http://localhost:3000/api/runs', 
  json={
    'name': 'Python Test Run',
    'input': {'message': 'Hello from Python'},
    'client_token': 'python-test-12345',
    'tags': ['python', 'test']
  }
)

run = response.json()['run']
print(f"Created run: {run['id']}")

# Start run
requests.post(f"http://localhost:3000/api/runs/{run['id']}/start")

# Get run status
status = requests.get(f"http://localhost:3000/api/runs/{run['id']}")
print(f"Run status: {status.json()['run']['status']}")
```

## ⚙️ Configuration

### **Environment Variables**
```bash
# Body limits
GATEWAY_BODY_LIMIT_BYTES=262144      # 256KB
RUN_INPUT_STRING_MAX=65536           # 64KB

# Idempotency
IDEMP_TTL_MS=86400000               # 24 hours

# Rate limiting
RATE_LIMIT_ENABLED=false            # Disabled by default
RATE_LIMIT_PER_SEC=50              # 50 req/sec when enabled

# Server
PORT=3000                          # Server port
HOST=127.0.0.1                     # Server host
```

## 📊 Metrics & Monitoring

### **Available Metrics**
- `runs_total` - Total number of runs created
- `sse_connections_opened` - Total SSE connections opened
- `sse_connections_closed` - Total SSE connections closed
- `sse_active_connections` - Currently active SSE connections
- `sse_messages_total` - Total SSE messages sent
- `idempotency_store_size` - Current idempotency store size

### **Example Metrics Output**
```
# HELP runs_total Total number of runs
# TYPE runs_total counter
runs_total 49428

# HELP sse_active_connections Active SSE connections
# TYPE sse_active_connections gauge
sse_active_connections 0

# HELP idempotency_store_size Current idempotency store size
# TYPE idempotency_store_size gauge
idempotency_store_size 1245
```

## 🔒 Security Features

### **Input Validation**
- JSON schema validation for all requests
- Field type checking and length limits
- Pattern matching for client tokens
- Object size validation
- Required field enforcement

### **Rate Limiting**
- Per-IP rate limiting with sliding window
- Configurable thresholds
- Automatic cleanup of old entries
- 429 responses with retry-after headers

### **Error Handling**
- Consistent 4xx responses for client errors
- Detailed error messages with validation details
- No 5xx errors for malformed requests
- Graceful handling of connection failures

## 🚀 Production Readiness

### ✅ **Validated Capabilities**
- **Zero downtime** during 1-hour stress test
- **100% success rate** under sustained load
- **34+ requests/second** sustained throughput
- **Perfect error handling** with no 5xx responses
- **Memory leak free** operation
- **Resource cleanup** verified

### 🔧 **Operational Features**
- **Graceful shutdown** handling
- **Process management** support
- **Logging** with structured output
- **Health checks** for monitoring
- **Metrics collection** for observability
- **Artifact generation** for debugging

## 📁 Project Structure

```
4Runr.Gateway/
├── README.md                    # This file
├── PRODUCTION-README.md         # Detailed production guide
├── artifacts/                   # Test results and artifacts
│   ├── stress-test-1hr/        # 1-hour stress test results
│   └── integration-flow-test/  # Integration test results
├── tests/                      # Test suites
│   ├── integration-flow-test.js
│   ├── stress-test-1hr.js
│   └── production-features.js
└── docs/                       # Documentation
    ├── api-reference.md
    ├── deployment-guide.md
    └── troubleshooting.md
```

## 🎯 Use Cases

### **AI Agent Orchestration**
- Manage multiple AI agent runs
- Real-time monitoring of agent execution
- Graceful cancellation of long-running tasks
- Idempotent run creation for reliability

### **Web Application Backend**
- RESTful API for run management
- Real-time updates via SSE
- Scalable architecture for high load
- Production-ready error handling

### **CLI Tool Integration**
- Simple HTTP API for automation
- JSON responses for easy parsing
- Comprehensive error messages
- Idempotent operations for reliability

## 🔮 Future Enhancements

### **Planned Features**
- **Authentication & Authorization** - JWT-based auth
- **Database Integration** - Persistent run storage
- **Webhook Support** - Event notifications
- **API Versioning** - Backward compatibility
- **Caching Layer** - Redis integration
- **Load Balancing** - Horizontal scaling

### **Monitoring Enhancements**
- **Distributed Tracing** - OpenTelemetry integration
- **Alerting** - Prometheus alerting rules
- **Dashboard** - Grafana dashboards
- **Log Aggregation** - Centralized logging

## 📞 Support

For questions, issues, or contributions:

- **Repository**: [4Runr-AI-Agent-OS](https://github.com/KyanBergeron4Runr/4Runr-AI-Agent-OS)
- **Issues**: [GitHub Issues](https://github.com/KyanBergeron4Runr/4Runr-AI-Agent-OS/issues)
- **Documentation**: See `/docs` directory for detailed guides

## 📄 License

This project is part of the 4Runr AI Agent OS platform. See the main repository for license information.

---

**Built with ❤️ for reliable AI agent orchestration**

# 🚀 4Runr Gateway - Build & Test Demo

## 🎯 What This Proves

The Build & Test demo showcases **real developer value** by providing a complete sandbox environment for testing 4Runr Gateway functionality. This is not a staged demo - it's a **real working system** that developers can use to understand and test the gateway's capabilities.

### ✅ **Real Value for Developers**

1. **Request Composer (Mini-Postman)**
   - Select agents, tools, and actions from dropdowns
   - Compose JSON parameters with examples
   - Send real requests through the gateway
   - See detailed results: request, decision, response, metrics
   - Copy cURL commands for external testing

2. **Token Workbench**
   - Generate short-lived JWT tokens with specific scopes
   - Inspect token structure (header, payload, signature)
   - Validate token authenticity and provenance
   - Copy tokens for external use

3. **Real Security Enforcement**
   - See actual allow/deny decisions with reasons
   - Test unauthorized access scenarios
   - Verify token validation and expiration
   - Monitor real-time metrics and latency

## 🧪 **How to Use**

### **Quick Start**
```bash
# Run the demo
.\start-build-test-demo.bat
```

This will:
1. Start the 4Runr Gateway with demo mode enabled
2. Open the Build & Test demo in your browser
3. Enable all sandbox endpoints for testing

### **Demo Tabs**

#### **Quick Demo Tab**
- Original step-by-step demo
- Shows basic agent creation and API access
- Good for understanding the core concepts

#### **Build & Test Tab**
- **Request Composer** (left panel)
  - Select an agent from the dropdown
  - Choose tool (SerpAPI, HTTP Fetch, OpenAI, Gmail)
  - Select action (search, get, chat, send, etc.)
  - Enter JSON parameters or load examples
  - Click "Send Request" to see real results

- **Token Workbench** (right panel)
  - Select an agent for token generation
  - Enter scopes (comma-separated)
  - Set TTL in seconds (30-3600)
  - Generate tokens and inspect their structure
  - Validate existing tokens

## 🔧 **Backend Endpoints**

The demo uses these real API endpoints:

### **Sandbox Endpoints** (Demo Mode Only)
- `POST /api/sandbox/token` - Generate short-lived tokens
- `POST /api/sandbox/token/introspect` - Validate and inspect tokens
- `POST /api/sandbox/request` - Compose and execute requests
- `GET /api/metrics/summary` - Get real-time metrics

### **Core Endpoints**
- `GET /api/agents` - List available agents
- `POST /api/create-agent` - Create new agents
- `POST /api/proxy-request` - Real API proxy (used by sandbox)

## 🎯 **What Makes This Special**

### **1. Real Reproducibility**
- Every request generates a real cURL command
- Copy-paste the cURL to test externally
- Results match between UI and command line

### **2. Explainable Decisions**
- See exactly why requests are allowed or denied
- Understand the security model
- Learn about token validation and scopes

### **3. Real Security Model**
- Short-lived tokens (60-120 seconds)
- Agent-scoped permissions
- Token provenance tracking
- Zero secrets leaked in responses

### **4. Real Proxying**
- Actual API calls through the gateway
- Real latency and metrics
- Circuit breaker and retry logic
- Mock mode for safe testing

## 🧪 **Testing Scenarios**

### **Basic Flow**
1. Create an agent (Quick Demo tab)
2. Switch to Build & Test tab
3. Select the agent in Request Composer
4. Choose SerpAPI → search
5. Send request and see results

### **Security Testing**
1. Try requesting without selecting an agent
2. Test with invalid tool/action combinations
3. Generate tokens with different scopes
4. Introspect expired or invalid tokens

### **Advanced Testing**
1. Copy cURL commands and test externally
2. Generate tokens and use them in other tools
3. Test different parameter combinations
4. Monitor metrics and latency patterns

## 🔒 **Security Features**

### **Data Scrubbing**
- All sensitive data is redacted (***)
- No API keys or secrets in responses
- Token signatures are hidden
- Authorization headers are masked

### **Rate Limiting**
- 10 requests per minute per IP
- Prevents abuse of sandbox endpoints
- Realistic testing environment

### **Demo Mode Guards**
- Sandbox endpoints only work with `DEMO_MODE=on`
- Prevents accidental production use
- Safe for public demos

## 📊 **Metrics & Monitoring**

### **Real-Time Metrics**
- Request latency (p50, p95)
- Success/failure rates by status code
- Denial reasons and counts
- Circuit breaker states
- Retry attempts

### **Request Tracking**
- Correlation IDs for debugging
- Full request/response cycle
- Decision reasoning
- Performance metrics

## 🎯 **Why This Matters for Investors**

### **Developer Adoption**
- Real tools developers actually need
- No fake demos - working functionality
- Immediate value proposition
- Clear path to production use

### **Technical Validation**
- Real zero-trust architecture
- Working security enforcement
- Scalable API proxy design
- Production-ready codebase

### **Market Differentiation**
- Unique developer experience
- Comprehensive testing environment
- Clear value demonstration
- Competitive advantage

## 🚀 **Next Steps**

### **Immediate**
1. Run the demo and explore both tabs
2. Test different scenarios and edge cases
3. Copy cURL commands for external validation
4. Generate and inspect various token types

### **Future Enhancements**
- Policy Lab (visual policy editor)
- Observe (real-time monitoring dashboard)
- Production deployment guides
- Integration examples

## 🏆 **The Bottom Line**

This Build & Test demo proves that 4Runr Gateway is:
- **Real** - Working code, not staged demos
- **Valuable** - Solves real developer problems
- **Secure** - Zero-trust architecture in action
- **Scalable** - Production-ready design
- **Differentiated** - Unique developer experience

**This is a real solution to real problems that every AI agent deployment faces.**

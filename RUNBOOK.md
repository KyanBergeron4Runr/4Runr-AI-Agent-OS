# 🚨 4Runr Gateway - On-Call Runbook

## 📋 **Quick Reference**

### **Critical Alerts (Page)**
- `HighErrorRate` - Error rate > 3% for 5m
- `BreakerStuckOpen` - Circuit breaker stuck OPEN > 2m

### **Warning Alerts**
- `HighLatencyP95` - p95 latency > 500ms for 5m
- `HighRetryRate` - Retry rate > 10% for 5m
- `BreakerStuckHalfOpen` - Breaker stuck HALF_OPEN > 1m

### **Info Alerts**
- `ChaosTestFailure` - Expected during chaos testing
- `HighTokenExpirationRate` - Tokens expiring frequently

## 🚨 **Step 1: Initial Assessment**

### **Check Current Metrics**
```bash
# Get current metrics snapshot
curl http://localhost:3000/metrics | grep -E "(gateway_requests_total|gateway_breaker_state|gateway_retries_total)"

# Check specific metrics
curl http://localhost:3000/metrics | grep "gateway_requests_total{code=~\"5..\"}"
curl http://localhost:3000/metrics | grep "gateway_breaker_state"
```

### **Check Gateway Health**
```bash
# Health check
curl http://localhost:3000/health

# Ready check
curl http://localhost:3000/ready

# Status check
curl http://localhost:3000/api/proxy/status
```

## 🔍 **Step 2: Identify Root Cause**

### **For HighErrorRate Alert**

1. **Check Error Distribution**
   ```bash
   # Get error breakdown by tool
   curl http://localhost:3000/metrics | grep "gateway_requests_total{code=~\"5..\"}"
   ```

2. **Check Circuit Breaker States**
   ```bash
   # Check which tools have open breakers
   curl http://localhost:3000/metrics | grep "gateway_breaker_state"
   ```

3. **Check Recent Logs**
   ```bash
   # Get recent request logs
   curl http://localhost:3000/api/proxy/logs?limit=50
   ```

### **For BreakerStuckOpen Alert**

1. **Identify Affected Tool**
   ```bash
   # Check breaker state for specific tool
   curl http://localhost:3000/metrics | grep "gateway_breaker_state{tool=\"SERPAAPI\"}"
   ```

2. **Check Upstream Health**
   ```bash
   # If in live mode, check external APIs
   curl -I https://serpapi.com/status
   curl -I https://api.openai.com/v1/models
   ```

## 🛠️ **Step 3: Immediate Actions**

### **If in Mock Mode (UPSTREAM_MODE=mock)**

1. **Disable Chaos Injection**
   ```bash
   # Stop chaos testing
   pkill -f "chaos-run"
   
   # Disable chaos flag
   sed -i 's/FF_CHAOS=on/FF_CHAOS=off/' config/.env
   
   # Restart Gateway
   docker compose restart gateway
   ```

2. **Verify Recovery**
   ```bash
   # Wait 30 seconds, then check metrics
   sleep 30
   curl http://localhost:3000/metrics | grep "gateway_requests_total{code=~\"5..\"}"
   ```

### **If in Live Mode (UPSTREAM_MODE=live)**

1. **Check External API Status**
   ```bash
   # Check SerpAPI
   curl -s https://serpapi.com/status | jq .
   
   # Check OpenAI
   curl -s -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models | jq .
   
   # Check Gmail API
   curl -s -H "Authorization: Bearer $GMAIL_API_KEY" https://gmail.googleapis.com/gmail/v1/users/me/profile | jq .
   ```

2. **Reset Circuit Breakers**
   ```bash
   # Use admin API to reset breakers (if available)
   curl -X POST http://localhost:3000/api/admin/reset-breakers \
     -H "Content-Type: application/json" \
     -d '{"tool": "serpapi"}'
   ```

3. **Check API Quotas**
   ```bash
   # Check rate limits and quotas
   curl -s -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models | jq '.headers'
   ```

## 🔄 **Step 4: Recovery Actions**

### **For High Latency**

1. **Check Resource Usage**
   ```bash
   # Check Gateway resource usage
   docker stats gateway
   
   # Check database and Redis
   docker stats db redis
   ```

2. **Scale Up (if needed)**
   ```bash
   # Increase Gateway resources
   docker compose up -d --scale gateway=2
   ```

### **For High Retry Rate**

1. **Check Upstream Stability**
   ```bash
   # Monitor upstream response times
   curl -w "@curl-format.txt" -o /dev/null -s "https://serpapi.com/search"
   ```

2. **Adjust Retry Configuration**
   ```bash
   # Modify retry settings in config
   # (Requires code change and restart)
   ```

## 📊 **Step 5: Post-Incident Analysis**

### **Collect Metrics Snapshot**
```bash
# Save metrics for analysis
curl http://localhost:3000/metrics > metrics-incident-$(date +%Y%m%d-%H%M%S).txt

# Get request logs
curl http://localhost:3000/api/proxy/logs?limit=100 > logs-incident-$(date +%Y%m%d-%H%M%S).json
```

### **Calculate Error Budget Impact**
```bash
# Calculate error budget consumption
# (Use Prometheus queries to determine SLO impact)
```

## 🎯 **SLO Targets & Error Budgets**

### **Current SLOs (Pilot Phase)**
- **Availability**: ≥ 97% (3% error budget)
- **Policy Accuracy**: ≥ 99% policy denials blocked
- **Breaker Recovery**: ≤ 60 seconds OPEN → CLOSED
- **Latency**: p95 < 500ms (mock mode)

### **Error Budget Management**
```bash
# If error budget > 50% consumed this month:
# 1. Stop chaos testing
# 2. Focus on stability
# 3. Review and adjust SLOs
```

## 🧪 **Chaos Testing Procedures**

### **Before Running Chaos Tests**
1. **Check Current Health**
   ```bash
   curl http://localhost:3000/health
   curl http://localhost:3000/metrics | grep "gateway_requests_total"
   ```

2. **Verify Mock Mode**
   ```bash
   grep "UPSTREAM_MODE=mock" config/.env
   ```

3. **Set Chaos Level**
   ```bash
   # Normal chaos (20% failure rate)
   export FF_CHAOS=on
   
   # High chaos (80% failure rate) - for alert testing
   # (Modify mock tools to increase failure rate)
   ```

### **During Chaos Testing**
1. **Monitor Alerts**
   - Watch for `ChaosTestFailure` alerts (expected)
   - Ensure `HighErrorRate` doesn't fire (unless testing alerts)

2. **Check Recovery**
   ```bash
   # Verify breakers recover
   curl http://localhost:3000/metrics | grep "gateway_breaker_state"
   ```

### **After Chaos Testing**
1. **Verify Recovery**
   ```bash
   # Check all metrics return to normal
   curl http://localhost:3000/metrics | grep -E "(gateway_requests_total|gateway_breaker_state)"
   ```

2. **Collect Results**
   ```bash
   # Save final metrics
   curl http://localhost:3000/metrics > metrics-chaos-complete-$(date +%Y%m%d-%H%M%S).txt
   ```

## 📞 **Escalation Path**

### **Level 1 (On-Call Engineer)**
- Follow this runbook
- Initial investigation and immediate actions
- Escalate if unresolved in 15 minutes

### **Level 2 (Senior Engineer)**
- Deep dive investigation
- Code review and configuration changes
- Escalate if unresolved in 1 hour

### **Level 3 (Engineering Lead)**
- Architecture review
- SLO adjustment decisions
- Customer communication

## 🔧 **Useful Commands**

### **Quick Diagnostics**
```bash
# Check all Gateway endpoints
curl -s http://localhost:3000/health && echo
curl -s http://localhost:3000/ready && echo
curl -s http://localhost:3000/api/proxy/status | jq .

# Check environment
echo "UPSTREAM_MODE: $(grep UPSTREAM_MODE config/.env)"
echo "FF_CHAOS: $(grep FF_CHAOS config/.env)"

# Check running processes
ps aux | grep -E "(node|chaos)" | grep -v grep
```

### **Metrics Queries**
```bash
# Error rate over last 5 minutes
curl -s http://localhost:3000/metrics | grep "gateway_requests_total{code=~\"5..\"}"

# Current breaker states
curl -s http://localhost:3000/metrics | grep "gateway_breaker_state"

# Retry rate
curl -s http://localhost:3000/metrics | grep "gateway_retries_total"
```

---

**Last Updated**: $(date)
**Version**: 1.0
**Contact**: On-Call Engineer

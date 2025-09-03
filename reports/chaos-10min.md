# 🎭 4Runr Gateway - 10-Minute Chaos Test Report

## 📊 **Test Summary**

- **Date**: `{{DATE}}`
- **Duration**: 10 minutes (600 seconds)
- **Mode**: `UPSTREAM_MODE=mock`
- **Chaos**: `FF_CHAOS=on`
- **Gateway Version**: `{{VERSION}}`

## 🎯 **Test Results**

### **Request Counts**
- **Total OK (2xx)**: `{{TOTAL_OK}}`
- **Policy Denials (403)**: `{{TOTAL_DENIED}}`
- **Rate Limited (429)**: `{{TOTAL_RATE_LIMITED}}`
- **Failed (5xx)**: `{{TOTAL_FAILED}}`
- **Total Requests**: `{{TOTAL_REQUESTS}}`

### **Success Rate**
- **Overall Success Rate**: `{{SUCCESS_RATE}}%`
- **Policy Denial Rate**: `{{DENIAL_RATE}}%`
- **Failure Rate**: `{{FAILURE_RATE}}%`

## 🔍 **Metrics Analysis**

### **Request Metrics**
```prometheus
# Check these metrics in metrics-chaos-snapshot.txt
gateway_requests_total{tool,action,code}
```

### **Latency Metrics**
```prometheus
# Histogram buckets for request duration
gateway_request_duration_ms_bucket{...}
```

### **Resilience Metrics**
```prometheus
# Retry attempts
gateway_retries_total{tool,action}

# Circuit breaker state
gateway_breaker_state{tool}
gateway_breaker_fastfail_total{tool}
```

### **Caching Metrics**
```prometheus
# Cache performance
gateway_cache_hits_total{tool,action}
gateway_cache_misses_total{tool,action}
```

### **Policy Metrics**
```prometheus
# Policy enforcement
gateway_policy_denials_total{...}
```

## 🚨 **Key Findings**

### **✅ What Worked Well**
- [ ] Policy denials recorded (gmail_send via scraper)
- [ ] Circuit breaker counters incremented
- [ ] Retry counters incremented for idempotent actions
- [ ] Cache hits recorded for repeated requests
- [ ] Metrics snapshot file generated

### **⚠️ Areas of Concern**
- [ ] High failure rate (>5%)
- [ ] Missing resilience metrics
- [ ] No cache hits detected
- [ ] Circuit breakers not triggering

### **🔧 Recommendations**
1. **If high failure rate**: Review chaos injection logic
2. **If missing metrics**: Check metric instrumentation
3. **If no cache hits**: Verify cache configuration
4. **If no circuit breakers**: Adjust breaker thresholds

## 📈 **Performance Notes**

### **Latency Distribution**
- **P50**: `{{P50_LATENCY}}ms`
- **P95**: `{{P95_LATENCY}}ms`
- **P99**: `{{P99_LATENCY}}ms`

### **Throughput**
- **Requests/sec**: `{{RPS}}`
- **Peak RPS**: `{{PEAK_RPS}}`

## 🔄 **Chaos Injection Results**

### **Fault Injection**
- **Total Faults Injected**: `{{TOTAL_FAULTS}}`
- **Fault Rate**: `{{FAULT_RATE}}%`
- **Recovery Success Rate**: `{{RECOVERY_RATE}}%`

### **Circuit Breaker Activity**
- **Breaker Opens**: `{{BREAKER_OPENS}}`
- **Breaker Half-Open**: `{{BREAKER_HALF_OPEN}}`
- **Breaker Closes**: `{{BREAKER_CLOSES}}`

## 📋 **Checklist**

### **Pre-Test Setup**
- [ ] `UPSTREAM_MODE=mock` in config/.env
- [ ] `FF_CHAOS=on` in config/.env
- [ ] Gateway running and healthy
- [ ] No external network dependencies

### **Post-Test Validation**
- [ ] Chaos run completed without manual intervention
- [ ] Metrics snapshot file created
- [ ] All expected metrics present
- [ ] No critical errors in logs

## 🎯 **Next Steps**

1. **If test passes**: Ready for longer duration tests
2. **If issues found**: Fix and re-run
3. **If metrics missing**: Add instrumentation
4. **If performance poor**: Optimize before production

---

**Report Generated**: `{{TIMESTAMP}}`
**Gateway Logs**: Check `docker compose logs gateway` for detailed error information

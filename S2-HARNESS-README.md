# S2 — Unkillable Harness

A robust, production-grade testing harness for 4Runr Gateway that runs continuous soak tests for 2 hours to catch slow leaks, memory issues, and stability problems.

## 🎯 Purpose

The S2 Harness is designed to catch issues that only appear over hours of continuous operation:
- Memory leaks and file handle leaks
- Clock drift and timing issues
- Queue buildup and backpressure
- Flaky SSE reconnections
- Registry consistency problems
- Safety and privacy violations

## 🏗️ Architecture

### Master Lifecycle Management
- **Single AbortController**: Controls the entire 120-minute test duration
- **Strong Intervals**: All timers/intervals stored in `handles[]` array, no `.unref()`
- **Graceful Shutdown**: Proper cleanup of all resources on exit
- **Global Error Sentry**: Catches unhandled rejections and exceptions

### Worker System
- **8 Concurrent Workers**: W1-W6 + Availability + Metrics
- **Retry Logic**: Exponential backoff with configurable limits
- **Fatal Error Handling**: Workers can mark errors as fatal to stop the harness
- **Signal Propagation**: All workers respond to master abort signal

### SSE Management
- **Client Registry**: `Map<clientId, EventSourceLike>`
- **Churn Logic**: 20% client rotation every 5 minutes (max 30%)
- **Auto-Reconnect**: Jittered reconnection with Last-Event-ID preservation
- **Duplicate Prevention**: Tracks and reports SSE duplicates

## 📊 Workloads

### W1: Realistic Runs
- **Rate**: 3 runs/minute (~360 total)
- **Timeout**: 90 seconds per run
- **SSE Attachment**: 30% of runs get SSE streams
- **Hardening**: Per-run timeout, error isolation

### W2: SSE Churn
- **Concurrent**: 20 SSE connections
- **Churn Rate**: 20% every 5 minutes (max 30%)
- **Reconnect Delay**: 1-2 seconds jittered
- **Hardening**: Never drop all clients, immediate replacements

### W3: Registry Pulse
- **Interval**: Every 10 minutes
- **Actions**: Publish agent versions, search registry
- **Hardening**: Timestamp suffix to avoid semver collisions
- **Tamper Test**: Attempt tampered manifest every hour

### W4: Safety Probes
- **Interval**: Every 15 minutes
- **Tests**: Prompt injection, PII masking
- **Hardening**: Avoids coinciding with SSE churn
- **Validation**: Verifies responses for safety compliance

### W5: Privacy Slice
- **Interval**: Every 20 minutes
- **Actions**: Toggle privacy settings, run hash-only tests
- **Hardening**: 2-second delay after privacy toggle
- **Validation**: Checks for plaintext leaks

### W6: Light Chaos
- **T+45m**: Redis restart simulation
- **T+75m**: Gateway restart simulation
- **T+90m**: +150ms latency injection
- **Hardening**: Waits for `/ready=200` after restarts

## 🚀 Usage

### Quick Start (Smoke Test)
```bash
# 15-minute validation test
run-s2-smoke.bat
```

### Full Test
```bash
# 120-minute soak test
run-s2-unkillable.bat
```

### Manual Execution
```bash
# Smoke test
node s2-smoke-test.js

# Full harness
node s2-harness-unkillable.js
```

## 📈 Monitoring

### Heartbeats
Every 5 minutes, the harness logs:
```
💓 S2 alive — t=XXm, active SSE=YY, runs started=ZZ
```

### Metrics Snapshots
Every 10 minutes, captures:
- Gateway metrics (`/metrics` endpoint)
- Test state metrics
- System metrics (RSS, heap usage)
- Saves to `s2-snapshot-S2-XX-{timestamp}.json`

### Logging
- **Console**: Real-time output with timestamps
- **File**: Rotated logs in `s2-logs/` directory
- **Levels**: INFO, ERROR, FATAL, HEARTBEAT

## 📁 Output Files

### Results
- `s2-smoke-results-{timestamp}.json` - Smoke test results
- `s2-unkillable-results-{timestamp}.json` - Full test results

### Logs
- `s2-logs/s2-smoke-{timestamp}.log` - Smoke test logs
- `s2-logs/s2-harness-{timestamp}.log` - Full test logs

### Snapshots
- `s2-snapshot-S2-00-{timestamp}.json` - 0-minute snapshot
- `s2-snapshot-S2-10-{timestamp}.json` - 10-minute snapshot
- `s2-snapshot-S2-20-{timestamp}.json` - 20-minute snapshot
- ... (every 10 minutes)

## 🎯 Success Criteria

### Smoke Test (15 minutes)
- ✅ No fatal errors in logs
- ✅ Continuous heartbeats at 5, 10, 15 minutes
- ✅ Harness runs full duration without early exit
- ✅ ~45 runs completed successfully

### Full Test (120 minutes)
- ✅ No fatal errors in logs
- ✅ Continuous heartbeats every 5 minutes
- ✅ Harness runs full 120 minutes
- ✅ Chaos events execute successfully
- ✅ All KPIs within target ranges

## 🔧 Configuration

### Test Duration
```javascript
// Smoke test
TEST_DURATION: 15 * 60 * 1000, // 15 minutes

// Full test  
TEST_DURATION: 120 * 60 * 1000, // 120 minutes
```

### Workload Rates
```javascript
W1_RUNS_PER_MIN: 3,           // Runs per minute
W2_CONCURRENT_SSE: 20,        // SSE connections
W2_CHURN_RATE: 0.2,           // 20% churn rate
W3_REGISTRY_INTERVAL: 10 * 60 * 1000, // 10 minutes
W4_SAFETY_INTERVAL: 15 * 60 * 1000,   // 15 minutes
W5_PRIVACY_INTERVAL: 20 * 60 * 1000,  // 20 minutes
```

### KPI Targets
```javascript
TARGETS: {
  AVAILABILITY: 99.9,
  START_TO_LOG_P95: 1200,     // 1.2s
  START_TO_LOG_P99: 1800,     // 1.8s
  JUDGE_P95: 300,             // 300ms
  SHIELD_P95: 200,            // 200ms
  SSE_WRITE_P99: 200,         // 200ms
  SSE_RECONNECT_SUCCESS: 99,  // 99%
  ERROR_RATE_OVERALL: 0.5,    // 0.5%
  ERROR_RATE_CHAOS: 2,        // 2%
  RSS_DRIFT_MAX: 10,          // 10%
  PUBLISH_SEARCH_DELAY: 10000 // 10s
}
```

## 🛡️ Hardening Features

### Master Lifecycle
- Single AbortController for entire test
- Master timeout prevents infinite runs
- Graceful shutdown on SIGINT/SIGTERM
- All handles stored and cleaned up

### Error Handling
- Global unhandledRejection handler
- Global uncaughtException handler
- Worker retry logic with exponential backoff
- Fatal error detection and propagation

### SSE Management
- Client registry with unique IDs
- Last-Event-ID preservation on reconnect
- Jittered reconnection delays
- Duplicate detection and reporting

### Worker Hardening
- W1: Per-run timeouts, error isolation
- W2: Churn limits, immediate replacements
- W3: Timestamp suffixes, collision avoidance
- W4: Churn avoidance, probe timing
- W5: Cache invalidation delays
- W6: Ready state verification

## 🔍 Troubleshooting

### Common Issues

**Harness exits early**
- Check for fatal errors in logs
- Verify gateway is running on localhost:3000
- Check for unhandled rejections

**No heartbeats**
- Verify all workers started successfully
- Check for worker crashes in logs
- Ensure no infinite loops in worker code

**SSE issues**
- Check SSE endpoint availability
- Verify Last-Event-ID handling
- Monitor reconnection success rates

**High error rates**
- Check gateway health
- Verify agent availability
- Monitor system resources

### Debug Mode
Add debug logging by modifying the `log()` function:
```javascript
function log(message, level = 'INFO') {
  // Add more verbose logging here
  console.log(`[DEBUG] ${message}`);
}
```

## 📊 Metrics Analysis

### Key Metrics to Monitor
- **Availability**: Should be ≥99.9%
- **Latency P95/P99**: Within target ranges
- **SSE Reconnect Rate**: Should be <1%
- **Error Rate**: Should be <0.5% (normal), <2% (chaos)
- **Memory Drift**: RSS should not grow >10%
- **Run Success Rate**: Should be >95%

### Anomaly Detection
- **Publish→Search Delay**: Should be <10s
- **Privacy Leaks**: Should be 0
- **SSE Duplicates**: Should be 0
- **Tampered Manifests**: Should all be rejected

## 🔄 Continuous Integration

### Automated Testing
```bash
# Run smoke test in CI
node s2-smoke-test.js

# Check exit code
if [ $? -eq 0 ]; then
  echo "Smoke test passed"
else
  echo "Smoke test failed"
  exit 1
fi
```

### Results Analysis
```bash
# Parse results JSON
jq '.summary' s2-smoke-results-*.json

# Check for fatal errors
jq '.fatalError' s2-smoke-results-*.json
```

## 📝 Changelog

### v2.0.0 - Unkillable Harness
- Complete rewrite with master lifecycle management
- Strong intervals and proper cleanup
- Global error sentry and fatal error handling
- SSE churn logic with registry and auto-reconnect
- Worker-specific hardening and retry logic
- Comprehensive logging and metrics snapshots

### v1.0.0 - Original S2
- Basic workload implementation
- Simple error handling
- Limited monitoring capabilities

## 🤝 Contributing

When modifying the harness:

1. **Test Changes**: Run smoke test before full test
2. **Preserve Hardening**: Don't remove error handling or cleanup
3. **Update Documentation**: Keep README current
4. **Add Logging**: Include appropriate log messages
5. **Handle Errors**: Always catch and handle errors gracefully

## 📞 Support

For issues with the S2 Harness:
1. Check the logs in `s2-logs/` directory
2. Review the results JSON files
3. Verify gateway configuration
4. Check system resources and network connectivity

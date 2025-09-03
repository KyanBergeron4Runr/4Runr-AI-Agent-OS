# 4Runr Gateway - Load Testing & Benchmark Suite

This directory contains the comprehensive load testing and benchmarking infrastructure for the 4Runr Gateway, designed to validate performance, reliability, and security under various load conditions.

## Overview

The benchmark suite includes:
- **Artillery** load testing scenarios
- **Chaos engineering** failure injection
- **Grafana dashboards** for monitoring
- **Automated test runner** with reporting
- **Comprehensive metrics** collection

## Prerequisites

1. **4Runr Gateway** running on `http://localhost:3000`
2. **Node.js** 18+ installed
3. **Artillery** installed globally: `npm install -g artillery`

## Quick Start

### 1. Install Dependencies
```bash
cd bench
npm install
npm run install-artillery
```

### 2. Run Full Test Suite
```bash
npm test
```

### 3. Run Individual Tests
```bash
# Baseline ramp test (0→50 RPS over 10 min)
npm run baseline

# Spike test (0→150 RPS in 30s, hold 2 min)
npm run spike

# Cache effectiveness test
npm run cache

# Chaos engineering test
npm run chaos
```

## Test Scenarios

### Baseline Ramp Test
- **Duration:** 10 minutes
- **Load:** 0 → 50 RPS
- **Purpose:** Validate latency targets and basic performance
- **Targets:** p50≤15ms, p95≤35ms, p99≤60ms

### Spike Test
- **Duration:** 2.5 minutes
- **Load:** 0 → 150 RPS spike
- **Purpose:** Test burst capacity and circuit breaker behavior
- **Targets:** No crashes, fast-fail <200ms when breakers open

### Soak Test
- **Duration:** 2 hours (run separately)
- **Load:** 15 RPS sustained
- **Purpose:** Validate long-term stability and memory usage
- **Targets:** No memory leaks, RSS plateau

### Chaos Engineering
- **Duration:** 10 minutes
- **Load:** 20 RPS with injected failures
- **Purpose:** Test resilience and recovery
- **Targets:** Proper breaker behavior, >70% retry success

### Cache Effectiveness
- **Duration:** 5 minutes
- **Load:** Repeated queries
- **Purpose:** Validate caching performance
- **Targets:** >40% cache hit ratio

## Test Scenarios Mix

The load tests simulate real-world usage patterns:

### Scraper (40% weight)
- **Tool:** SerpAPI
- **Action:** Search
- **Pattern:** Lead discovery queries
- **Cache:** High cacheability

### Enricher (30% weight)
- **Tools:** HTTP Fetch + OpenAI
- **Actions:** GET + Chat
- **Pattern:** Data enrichment workflows
- **Cache:** Mixed cacheability

### Engager (10% weight)
- **Tool:** Gmail Send
- **Action:** Send
- **Pattern:** Email engagement
- **Cache:** Low cacheability

### Denial Tests (10% weight)
- **Purpose:** Policy enforcement validation
- **Expected:** 403 responses for unauthorized actions

### Security Tests (10% weight)
- **Purpose:** Security validation
- **Expected:** 403 responses for invalid proofs

## Chaos Injection

The chaos engineering features allow controlled failure injection:

### Available Modes
- **timeout:** Simulate 10-second timeouts
- **500:** Simulate HTTP 500 errors
- **jitter:** Add 1-6 second random delays

### Usage
```bash
# Inject chaos
curl -X POST http://localhost:3000/api/admin/chaos/tool \
  -H "Content-Type: application/json" \
  -d '{"tool": "serpapi", "mode": "timeout", "pct": 30}'

# Clear chaos
curl -X DELETE http://localhost:3000/api/admin/chaos/tool/serpapi

# Check chaos state
curl http://localhost:3000/api/admin/chaos
```

## Metrics & Monitoring

### Grafana Dashboard
Import `dashboards/gateway.json` into Grafana for comprehensive monitoring:

- **Performance:** Latency distribution, request rates
- **Reliability:** Error rates, circuit breaker status
- **Security:** Policy denials, security events
- **Resources:** CPU, memory, event loop lag

### Key Metrics
- `gateway_requests_total` - Request count by tool/action
- `gateway_request_duration_seconds` - Latency histogram
- `gateway_errors_total` - Error count by type
- `gateway_circuit_breaker_state` - Breaker status
- `gateway_cache_hits_total` - Cache performance
- `gateway_policy_denials_total` - Policy enforcement

## Environment Variables

Configure the test environment:

```bash
export GATEWAY_URL=http://localhost:3000
export SCRAPER_AGENT_ID=your-scraper-agent-id
export ENRICHER_AGENT_ID=your-enricher-agent-id
export ENGAGER_AGENT_ID=your-engager-agent-id
```

## Reports & Output

### Generated Files
- `reports/test-summary-{timestamp}.json` - Test results summary
- `reports/{scenario}-{timestamp}.json` - Individual scenario reports
- `reports/metrics-{timestamp}.txt` - Metrics snapshots
- `reports/chaos-state-{timestamp}.json` - Chaos state snapshots

### Report Structure
```json
{
  "timestamp": "2025-08-11T02:30:00.000Z",
  "gatewayUrl": "http://localhost:3000",
  "agentIds": {
    "scraper": "agent-id-1",
    "enricher": "agent-id-2",
    "engager": "agent-id-3"
  },
  "results": [
    {
      "scenario": "baseline-ramp",
      "success": true,
      "duration": 600,
      "reportFile": "reports/baseline-ramp-1234567890.json"
    }
  ],
  "metrics": {
    "metricsFile": "reports/metrics-1234567890.txt",
    "chaosFile": "reports/chaos-state-1234567890.json"
  }
}
```

## Acceptance Criteria

### Performance Targets
- **Latency:** p50≤15ms, p95≤35ms, p99≤60ms
- **Success Rate:** ≥99.5% on happy-path
- **Throughput:** Sustained RPS without breaker flapping

### Reliability Targets
- **Circuit Breaker:** Fast-fail <200ms when open
- **Retry Success:** >70% of retryable errors resolved
- **Memory:** No leaks during 2h soak test

### Security Targets
- **Policy Enforcement:** 100% denial rate for unauthorized actions
- **Security Events:** 0 provenance mismatches (except intentional)
- **Token Management:** Proper rotation and revocation

## Troubleshooting

### Common Issues

1. **Gateway not responding**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Artillery not found**
   ```bash
   npm install -g artillery
   ```

3. **Permission denied**
   ```bash
   chmod +x run-tests.js
   ```

4. **Agent creation failed**
   - Check Gateway logs
   - Verify required fields (name, created_by, role)

### Debug Mode
```bash
# Enable verbose logging
DEBUG=* npm test

# Run single scenario with debug
artillery run artillery.yml --phase baseline-ramp --debug
```

## Contributing

To add new test scenarios:

1. Add scenario to `artillery.yml`
2. Update `run-tests.js` if needed
3. Add corresponding functions to `processor.js`
4. Update this README

## License

MIT License - see LICENSE file for details.

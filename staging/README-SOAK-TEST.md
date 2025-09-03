# 🚀 4Runr Gateway 24-Hour Soak Test

A comprehensive 24-hour load test for the 4Runr Gateway that exercises all tools, rotates credentials, and captures metrics for whitepaper analysis.

## 📋 Overview

The soak test runs for 24 hours with:
- **Steady Load**: 10 RPS sustained traffic
- **Tool Coverage**: All tools (serpapi, http_fetch, openai, gmail_send)
- **Credential Rotation**: Every 15 minutes
- **Policy Testing**: Regular policy denial probes
- **Mid-Run Changes**: Credential rotation, policy updates, chaos mode
- **Metrics Capture**: Hourly Prometheus snapshots
- **Artifact Collection**: Complete test data for analysis

## 🛠️ Prerequisites

### System Requirements
- **Node.js**: 18+ with `node-fetch` support
- **curl**: For health checks
- **jq**: For JSON parsing (optional but recommended)
- **Docker**: For database snapshots (optional)

### Gateway Setup
- **Staging Environment**: Deployed and healthy
- **TLS Certificate**: Valid SSL certificate
- **API Keys**: Configured in secrets file
- **Policies**: Baseline policies seeded

### Environment Configuration
Ensure your staging environment has:
```bash
UPSTREAM_MODE=mock     # start with mock; can switch to live
FF_POLICY=on
FF_CHAOS=off          # we want stability data
```

## 🚀 Quick Start

### 1. Verify Gateway Health
```bash
# Check if Gateway is ready
curl -fsS https://gateway-staging.yourdomain.com/ready | jq .
```

### 2. Run the Soak Test
```bash
# From staging directory
chmod +x scripts/run-soak-test.sh
./scripts/run-soak-test.sh
```

### 3. Monitor Progress
The test will run for 24 hours with automatic mid-run changes:
- **H+8**: Credential rotation
- **H+12**: Chaos mode (30 minutes)
- **H+16**: Policy update

### 4. Collect Artifacts
```bash
# After test completion
./scripts/collect-artifacts.sh
```

## 📊 Test Configuration

### Load Profile
- **Request Rate**: 10 RPS (configurable via `SOAK_RPS`)
- **Duration**: 24 hours (configurable via `SOAK_HOURS`)
- **Total Requests**: ~864,000 requests

### Traffic Distribution
- **60% Scraper**: serpapi search operations
- **30% Enricher**: http_fetch + openai chat (chained)
- **10% Engager**: gmail_send operations

### Token Rotation
- **Frequency**: Every 15 minutes
- **Scope**: All agent tokens
- **Duration**: 15-20 minutes per token

### Policy Testing
- **Frequency**: Every minute
- **Test**: Scraper attempting gmail_send (should be denied)
- **Expected**: 403 policy denials

## 🔧 Manual Execution

### Run Soak Test Only
```bash
# Direct execution
SOAK_RPS=10 SOAK_HOURS=24 GATEWAY_URL=https://gateway-staging.yourdomain.com node scripts/soak-24h.js
```

### Execute Mid-Run Changes
```bash
# Credential rotation
node scripts/mid-run-changes.js rotate-credentials

# Policy update
node scripts/mid-run-changes.js update-policy

# Chaos mode toggle
node scripts/mid-run-changes.js chaos-on
node scripts/mid-run-changes.js chaos-off

# Health check
node scripts/mid-run-changes.js health-check
```

### Collect Artifacts
```bash
# Collect and package all artifacts
./scripts/collect-artifacts.sh
```

## 📁 Generated Artifacts

### Core Files
- **`soak-summary.json`**: Final test summary with statistics
- **`soak-events.log`**: Complete event timeline
- **`soak-h*.prom`**: Hourly metrics snapshots (24 files)
- **`soak-final.prom`**: Final metrics snapshot

### Analysis Files
- **`metrics-analysis.txt`**: Key metrics extraction
- **`manifest.txt`**: Artifact inventory
- **`database-snapshot.sql.gz`**: PostgreSQL dump (if available)

### Reports
- **`soak-test-report-*.md`**: Comprehensive test report
- **`soak-artifacts-*.tar.gz`**: Complete artifact archive

## 📈 Expected Metrics

### Success Criteria
- **Success Rate**: ≥ 97% (mock mode, chaos mostly off)
- **Policy Denials**: Non-zero (scope + quota changes)
- **Circuit Breakers**: Engage during chaos, recover after
- **Token Rotation**: No error spikes during rotation

### Key Metrics Captured
```
gateway_requests_total{tool,action,code}
gateway_request_duration_ms_bucket
gateway_cache_hits_total
gateway_retries_total
gateway_breaker_fastfail_total
gateway_policy_denials_total{kind}
gateway_token_validations_total
gateway_token_expirations_total
```

## 🔍 Analysis & Reporting

### Quick Analysis
```bash
# Check final results
jq '.success_rate, .totals.total, .denial_rate' reports/soak-summary.json

# Review key events
grep -E "(TOKENS_ROTATED|POLICY_UPDATED|CHAOS_MODE)" reports/soak-events.log

# Count metrics snapshots
ls reports/soak-*.prom | wc -l
```

### Metrics Analysis
```bash
# Extract request counts by tool
grep "gateway_requests_total" reports/soak-final.prom

# Check policy denials
grep "gateway_policy_denials_total" reports/soak-final.prom

# Analyze circuit breaker activity
grep "gateway_breaker_fastfail_total" reports/soak-final.prom
```

### Generate Charts
Use the Prometheus metrics snapshots to create charts showing:
- Request success rate over time
- Policy denial patterns
- Circuit breaker activity during chaos
- Token rotation impact
- Tool usage distribution

## 🚨 Troubleshooting

### Common Issues

#### Gateway Not Responding
```bash
# Check health
curl -v https://gateway-staging.yourdomain.com/health

# Check logs
docker compose logs gateway

# Restart if needed
docker compose restart gateway
```

#### Token Generation Failing
```bash
# Check database connection
docker compose exec db pg_isready -U gateway

# Check token generation logs
docker compose logs gateway | grep "token"
```

#### High Failure Rate
```bash
# Check resource usage
docker stats

# Increase timeouts if needed
# Update HTTP_TIMEOUT_MS in .env

# Check circuit breaker settings
# Review breaker configuration
```

#### Policy Denials Too High
```bash
# Check policy configuration
# Review seeded policies

# Verify agent roles and permissions
# Check token generation parameters
```

### Performance Tuning

#### If System Overloaded
```bash
# Reduce RPS
export SOAK_RPS=5

# Increase timeouts
export HTTP_TIMEOUT_MS=10000

# Add resource limits
# Update docker-compose.yml resource constraints
```

#### If Database Slow
```bash
# Check database performance
docker compose exec db psql -U gateway -c "SELECT * FROM pg_stat_activity;"

# Optimize queries
# Review Prisma query patterns

# Add database indexes
# Run database migrations
```

## 📋 Acceptance Criteria

### ✅ Test Completion
- [ ] Soak test runs for full 24 hours
- [ ] No manual intervention required
- [ ] All mid-run changes execute successfully
- [ ] Artifacts collected and archived

### ✅ Success Metrics
- [ ] Success rate ≥ 97%
- [ ] Non-zero policy denials recorded
- [ ] Circuit breakers engage during chaos
- [ ] Token rotation doesn't cause outages

### ✅ Data Quality
- [ ] 24 hourly metrics snapshots
- [ ] Complete event timeline
- [ ] Database snapshot (if available)
- [ ] All key metrics present

### ✅ Whitepaper Ready
- [ ] Artifact archive created
- [ ] Metrics analysis generated
- [ ] Final report produced
- [ ] Data ready for chart generation

## 🔄 Maintenance

### Regular Testing
- **Frequency**: Weekly soak tests
- **Duration**: 24 hours minimum
- **Environment**: Staging only
- **Documentation**: Update results

### Artifact Management
- **Retention**: Keep last 4 weeks
- **Storage**: Compressed archives
- **Backup**: Include in regular backups
- **Cleanup**: Remove old artifacts

### Continuous Improvement
- **Analysis**: Review trends weekly
- **Tuning**: Adjust based on results
- **Documentation**: Update procedures
- **Automation**: Improve scripts

## 📞 Support

### Getting Help
1. Check the troubleshooting section above
2. Review Gateway logs: `docker compose logs gateway`
3. Verify configuration files
4. Test connectivity manually

### Escalation
- **System Issues**: Check staging environment health
- **Test Failures**: Review error logs and metrics
- **Data Quality**: Verify artifact collection
- **Performance**: Analyze resource usage

---

**Status**: ✅ **Ready for Production**  
**Last Updated**: December 2024  
**Version**: 1.0.0

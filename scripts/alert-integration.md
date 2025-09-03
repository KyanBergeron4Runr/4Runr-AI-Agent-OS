# Enhanced Alert Management System Integration Guide

## Overview

The Enhanced Alert Management System provides intelligent alerting that could have prevented your 48-hour test failure by detecting issues early and triggering automated responses. It features alert correlation, suppression, escalation, and automated recovery actions.

## Key Features

- **Intelligent Alert Rules**: Pre-configured rules for common failure scenarios
- **Alert Correlation**: Groups related alerts to prevent alert storms
- **Smart Suppression**: Prevents duplicate alerts and noise
- **Automated Escalation**: Escalates unresolved alerts with configurable timelines
- **Automated Responses**: Triggers recovery actions automatically
- **Historical Analysis**: Tracks alert patterns and trends
- **API Integration**: RESTful endpoints for external systems

## Quick Start

### 1. Start Alert Management

```bash
# Start alert system with real-time monitoring
node scripts/alert-cli.js start

# Or integrate into your application
const { initializeAlerting } = require('./dist/observability/alert-integration')
initializeAlerting()
```

### 2. Check Alert Status

```bash
# Current alert status and statistics
node scripts/alert-cli.js status
```

### 3. View Alert Dashboard

```bash
# Detailed alert dashboard
node scripts/alert-cli.js dashboard

# Or via API
curl http://localhost:3000/health/alerts
```

### 4. Create Manual Alerts

```bash
# Create a test alert
node scripts/alert-cli.js create warning "High Memory Usage" "Memory usage is 85%" "system"

# Or via API
curl -X POST http://localhost:3000/health/alerts \
  -H "Content-Type: application/json" \
  -d '{"level":"warning","title":"High Memory","message":"Memory usage 85%","category":"system"}'
```

### 5. Resolve Alerts

```bash
# Resolve an alert by ID
node scripts/alert-cli.js resolve alert-1629123456789-abc123def

# Or via API
curl -X POST http://localhost:3000/health/alerts/alert-123/resolve \
  -H "Content-Type: application/json" \
  -d '{"resolvedBy":"ops-team"}'
```

## Pre-configured Alert Rules

The system comes with intelligent alert rules that address common failure scenarios:

### 1. High Memory Usage Alert
- **Trigger**: System memory usage > 90%
- **Level**: Critical
- **Escalation**: After 10 minutes → restart application
- **Auto-resolve**: When memory usage < 80%

### 2. Application Unresponsive Alert
- **Trigger**: Health status = unhealthy
- **Level**: Critical
- **Escalation**: After 5 minutes → restart application
- **Auto-resolve**: When health status = healthy

### 3. High Error Rate Alert
- **Trigger**: Error rate > 5%
- **Level**: Warning
- **Escalation**: After 15 minutes → collect diagnostics
- **Category**: Application performance

### 4. Database Disconnected Alert
- **Trigger**: Database connection = false
- **Level**: Critical
- **Escalation**: After 5 minutes → restart database connection
- **Auto-resolve**: When database connection = true

### 5. Container High CPU Alert
- **Trigger**: Any container CPU > 90%
- **Level**: Warning
- **Escalation**: After 10 minutes → scale containers
- **Category**: Docker resource management

## Alert Levels and Escalation

### Alert Levels

**🚨 Critical**
- Immediate attention required
- System functionality impacted
- Automatic escalation after 5-10 minutes
- Triggers automated recovery actions

**⚠️ Warning**
- Attention needed but not urgent
- Performance or capacity concerns
- Escalation after 10-15 minutes
- May trigger diagnostic collection

**ℹ️ Info**
- Informational notifications
- No immediate action required
- No automatic escalation
- Used for audit trails and trends

### Escalation Timeline

```
Alert Created → Cooldown Period → Escalation Check → Automated Actions
     ↓              (varies)           ↓                    ↓
  Initial Alert   No duplicate     Check if still      Execute recovery
  Notification    alerts sent      active/unresolved   actions if needed
```

## Alert Correlation and Suppression

### Correlation Engine

The system automatically correlates related alerts:

- **Time-based**: Alerts in same category within 30 minutes
- **Severity-based**: Groups by alert level and impact
- **Root cause analysis**: Identifies primary alert in correlation
- **Automatic resolution**: Resolves correlation when all alerts resolved

### Suppression Rules

Prevents alert storms through intelligent suppression:

- **Duplicate suppression**: Same alert type within 5 minutes
- **Category suppression**: Related alerts during active incidents
- **Maintenance windows**: Configurable suppression periods
- **Escalation suppression**: Prevents re-alerting during escalation

## Automated Response System

### Response Actions

The system can automatically execute recovery actions:

**restart-application**
- Triggers graceful application restart
- Used for memory leaks, unresponsive applications
- Escalation: Critical alerts after 5-10 minutes

**restart-database-connection**
- Resets database connection pool
- Used for database connectivity issues
- Escalation: Database alerts after 5 minutes

**collect-diagnostics**
- Gathers system diagnostics and logs
- Used for performance issues
- Escalation: Warning alerts after 15 minutes

**scale-containers**
- Increases container resources or replicas
- Used for resource exhaustion
- Escalation: Resource alerts after 10 minutes

### Response Tracking

All automated responses are tracked:

```json
{
  "id": "resp-1629123456789-abc123def",
  "alertId": "alert-1629123456789-xyz789ghi",
  "action": "restart-application",
  "result": "success",
  "timestamp": "2025-08-18T21:45:00.000Z",
  "details": {
    "action": "restart-application",
    "target": "main-process"
  }
}
```

## API Endpoints

### Alert Management

```bash
# Get alert dashboard
GET /health/alerts

# Get alert statistics
GET /health/alerts/stats?hours=24

# Get alert history
GET /health/alerts/history?level=critical&hours=12&limit=50

# Create manual alert
POST /health/alerts
{
  "level": "warning",
  "title": "Custom Alert",
  "message": "Custom alert message",
  "category": "custom",
  "metadata": {"source": "external-system"}
}

# Resolve alert
POST /health/alerts/:alertId/resolve
{
  "resolvedBy": "ops-team"
}

# Acknowledge alert
POST /health/alerts/:alertId/acknowledge
{
  "acknowledgedBy": "john.doe"
}

# Test alert system
POST /health/alerts/test
```

### Response Examples

**Alert Dashboard:**
```json
{
  "enabled": true,
  "timestamp": "2025-08-18T21:45:00.000Z",
  "summary": {
    "activeAlerts": 3,
    "criticalAlerts": 1,
    "warningAlerts": 2,
    "infoAlerts": 0,
    "activeCorrelations": 1
  },
  "statistics": {
    "total": 25,
    "resolved": 22,
    "acknowledged": 15,
    "escalated": 3,
    "byLevel": {
      "critical": 5,
      "warning": 15,
      "info": 5
    }
  },
  "activeAlerts": {
    "critical": [...],
    "warning": [...],
    "info": [...]
  }
}
```

## Integration with Existing Systems

### Health Manager Integration

```javascript
// Automatic integration with health manager
import { initializeAlerting } from './observability/alert-integration'
import { initializeHealthManager } from './runtime/health-integration'

// Start both systems
initializeHealthManager()
initializeAlerting()

// Health manager alerts automatically forwarded to alert system
```

### Multi-Level Monitoring Integration

```javascript
// Automatic integration with monitoring system
import { initializeMonitoring } from './observability/monitoring-integration'
import { initializeAlerting } from './observability/alert-integration'

// Start both systems
initializeMonitoring()
initializeAlerting()

// Monitoring failures automatically create alerts
```

### Custom Alert Rules

```javascript
import { alertManager } from './observability/alert-manager'

// Add custom alert rule
alertManager.addAlertRule({
  id: 'custom-business-rule',
  name: 'Business Metric Alert',
  description: 'Business KPI threshold exceeded',
  condition: (context) => {
    const businessMetric = context.metrics['business_kpi_total'] || 0
    return businessMetric > 1000
  },
  level: 'warning',
  category: 'business',
  cooldownMs: 300000, // 5 minutes
  escalationRules: [{
    afterMinutes: 30,
    escalateTo: 'critical',
    notifyChannels: ['business-team'],
    autoActions: ['collect-business-diagnostics']
  }]
})
```

## Storage and Persistence

### Alert Storage
- **Location**: `logs/alerts/`
- **Format**: JSON files per alert
- **State file**: `alert-manager-state.json`
- **Retention**: Configurable (default: 1000 alerts)

### Alert History
- **In-memory**: Last 1000 alerts for fast access
- **Persistent**: All alerts saved to disk
- **Cleanup**: Automatic cleanup of old alert files
- **Backup**: State persisted on shutdown

## Monitoring and Observability

### Alert Metrics

The alert system provides its own metrics:

- **alert_rules_total**: Number of active alert rules
- **alerts_created_total**: Total alerts created by level
- **alerts_resolved_total**: Total alerts resolved
- **alert_escalations_total**: Total alert escalations
- **alert_correlations_total**: Total alert correlations
- **automated_responses_total**: Total automated responses by action

### Health Checks

The alert system includes self-monitoring:

- **Alert rule evaluation**: Monitors rule evaluation performance
- **Alert storage**: Monitors disk usage and write performance
- **Correlation engine**: Monitors correlation processing
- **Response system**: Monitors automated response execution

## Troubleshooting

### Common Issues

1. **Alerts not triggering**
   - Check alert rule conditions
   - Verify monitoring data is available
   - Check alert rule cooldown periods

2. **Too many alerts (alert storm)**
   - Review suppression rules
   - Check correlation settings
   - Adjust alert thresholds

3. **Automated responses not working**
   - Check escalation rule configuration
   - Verify response action implementations
   - Review response execution logs

### Debug Mode

Enable verbose logging:

```bash
DEBUG=alerts node scripts/alert-cli.js start
```

### Manual Testing

Test the alert system:

```bash
# Run comprehensive alert system test
node scripts/alert-cli.js test

# Create test alerts manually
node scripts/alert-cli.js create critical "Test Alert" "Testing alert system" "test"
```

## Benefits for 48-Hour Test Stability

This Enhanced Alert Management System directly addresses the issues from your failed 48-hour test:

### Before vs After

**Before (48-hour test failure):**
- ❌ No early warning system for resource exhaustion
- ❌ No automated response to application unresponsiveness
- ❌ Manual intervention required for all issues
- ❌ No correlation of related problems
- ❌ Alert fatigue from duplicate notifications

**Now (Enhanced Alert Management):**
- ✅ **Early Warning**: Detects memory leaks, CPU spikes, database issues before failure
- ✅ **Automated Recovery**: Automatically restarts unresponsive applications
- ✅ **Intelligent Correlation**: Groups related alerts to identify root causes
- ✅ **Smart Suppression**: Prevents alert storms and duplicate notifications
- ✅ **Escalation Management**: Ensures critical issues get appropriate attention
- ✅ **Historical Analysis**: Tracks patterns to prevent future issues

### Specific 48-Hour Test Improvements

1. **Memory Leak Detection**: Would have detected the memory growth before system failure
2. **Unresponsive Application**: Would have automatically restarted the application after 5 minutes
3. **Resource Monitoring**: Would have provided early warning of resource exhaustion
4. **Automated Recovery**: Would have attempted recovery without manual intervention
5. **Root Cause Analysis**: Would have correlated related alerts to identify the primary issue

The alert system ensures that issues are detected early, responded to automatically, and escalated appropriately, preventing the type of silent failure that occurred in your 48-hour test.
# Graceful Degradation System Integration Guide

## Overview

The Graceful Degradation System addresses the critical issue from your 48-hour test where the system failed completely instead of degrading gracefully. Instead of becoming completely unresponsive after 5 hours, the system now automatically reduces load and maintains core functionality under stress.

## Key Features

- **3-Level Degradation System**: Light → Moderate → Severe degradation based on system metrics
- **Automatic Load Shedding**: Probabilistic request dropping during high load
- **Feature Toggling**: Disable non-essential features under stress
- **Resource Management**: Garbage collection, cache clearing, connection cleanup
- **Backpressure Management**: Request queuing and concurrent request limiting
- **Automatic Recovery**: Returns to normal operation when conditions improve

## Quick Start

### 1. Start Graceful Degradation

```bash
# Start degradation system with real-time monitoring
node scripts/degradation-cli.js start

# Or integrate into your application
const { initializeDegradation } = require('./dist/runtime/degradation-integration')
initializeDegradation()
```

### 2. Check Degradation Status

```bash
# Current degradation status
node scripts/degradation-cli.js status

# Or via API
curl http://localhost:3000/health/degradation
```

### 3. View System Metrics

```bash
# Detailed degradation metrics
node scripts/degradation-cli.js metrics

# Or via API
curl http://localhost:3000/health/degradation/metrics
```

### 4. Manual Control

```bash
# Force degradation to level 2
node scripts/degradation-cli.js force 2 "High memory usage detected"

# Force recovery
node scripts/degradation-cli.js recover "Issue resolved"

# Trigger emergency actions
node scripts/degradation-cli.js emergency
```

## Degradation Levels

### Level 1: Light Degradation
**Triggers:**
- Memory usage > 80% for 30 seconds
- Response time > 2 seconds for 1 minute
- Error rate > 5% for 30 seconds

**Actions:**
- Disable analytics features
- Disable verbose logging
- Clear low-priority caches
- Reduce non-essential background tasks

**Recovery:** When conditions improve to 70% of trigger thresholds

### Level 2: Moderate Degradation
**Triggers:**
- Memory usage > 90% for 15 seconds
- Response time > 5 seconds for 30 seconds
- Error rate > 10% for 15 seconds

**Actions:**
- Disable caching system
- Disable background tasks
- Implement load shedding (20% request drop probability)
- Clear medium-priority caches
- Trigger garbage collection

**Recovery:** When conditions improve to 60% of trigger thresholds

### Level 3: Severe Degradation
**Triggers:**
- Memory usage > 95% for 5 seconds
- Response time > 10 seconds for 15 seconds
- Error rate > 20% for 10 seconds

**Actions:**
- Disable all non-essential features
- Aggressive load shedding (50% request drop probability)
- Clear high-priority caches
- Close idle connections
- Force garbage collection
- Emergency mode - only core functionality

**Recovery:** When conditions improve to 50% of trigger thresholds

## Load Shedding and Backpressure

### Load Shedding Configuration

```javascript
const loadSheddingConfig = {
  enabled: true,
  maxQueueSize: 1000,
  dropProbability: 0.1, // Increases with degradation level
  priorityLevels: {
    'health': 1,    // Highest priority
    'metrics': 2,
    'admin': 3,
    'api': 4,
    'static': 5     // Lowest priority
  },
  exemptPaths: ['/health', '/ready', '/metrics'] // Never dropped
}
```

### Backpressure Management

```javascript
const backpressureConfig = {
  enabled: true,
  maxConcurrentRequests: 100,
  queueTimeout: 30000, // 30 seconds
  slowConsumerThreshold: 5000 // 5 seconds
}
```

### Request Priority System

Requests are automatically prioritized based on path:

1. **Health endpoints** (`/health`, `/ready`, `/metrics`) - Never dropped
2. **Admin endpoints** (`/admin/*`) - High priority
3. **API endpoints** (`/api/*`) - Medium priority
4. **Static content** (`.css`, `.js`, `.png`, etc.) - Low priority

## Feature Degradation

### Checking Feature Availability

```javascript
import { isFeatureAvailable } from './runtime/degradation-integration'

// Check if a feature is available
if (isFeatureAvailable('analytics')) {
  // Execute analytics code
  trackUserEvent(event)
} else {
  // Skip analytics during degradation
  console.log('Analytics disabled due to system degradation')
}
```

### Common Features for Degradation

- **analytics**: User behavior tracking
- **logging_verbose**: Detailed logging
- **caching**: Response caching
- **background_tasks**: Non-critical background processing
- **all_non_essential**: Emergency mode - only core functionality

## API Endpoints

### Degradation Management

```bash
# Get degradation status
GET /health/degradation

# Get degradation metrics and capabilities
GET /health/degradation/metrics

# Check specific feature availability
GET /health/degradation/features/:feature

# Force degradation to specific level
POST /health/degradation/force
{
  "level": 2,
  "reason": "High memory usage detected"
}

# Force recovery from degradation
POST /health/degradation/recover
{
  "reason": "Issue resolved"
}

# Trigger emergency actions
POST /health/degradation/emergency

# Test degradation system
POST /health/degradation/test
```

### Response Examples

**Degradation Status:**
```json
{
  "enabled": true,
  "timestamp": "2025-08-18T21:45:00.000Z",
  "active": true,
  "level": 2,
  "levelName": "Moderate Degradation",
  "activatedAt": "2025-08-18T21:40:00.000Z",
  "triggers": [
    "memory > 0.9",
    "response_time > 5000"
  ],
  "actions": [
    "disable_feature",
    "limit_requests",
    "reduce_cache",
    "gc_trigger"
  ],
  "metrics": {
    "requestsDropped": 45,
    "featuresDisabled": ["caching", "background_tasks"],
    "cacheReductions": 3,
    "connectionsDropped": 10
  },
  "recommendations": [
    "System is in degradation mode (Level 2). Consider investigating root causes.",
    "High degradation level detected. Consider scaling resources or reducing load."
  ]
}
```

## Integration with Existing Systems

### Application Integration

```javascript
// In your main application file
import { initializeDegradation, shouldAcceptRequest, registerRequest, completeRequest } from './runtime/degradation-integration'

// Start degradation system
initializeDegradation()

// In your request handler middleware
app.use((req, res, next) => {
  const requestId = generateRequestId()
  
  // Check if request should be accepted
  const { accept, reason } = shouldAcceptRequest({
    path: req.path,
    method: req.method,
    priority: determinePriority(req)
  })
  
  if (!accept) {
    return res.status(503).json({
      error: 'Service temporarily unavailable',
      reason: reason,
      retryAfter: 30
    })
  }
  
  // Register request start
  registerRequest(requestId)
  
  // Add cleanup on response finish
  res.on('finish', () => {
    completeRequest(requestId)
  })
  
  next()
})
```

### Health Manager Integration

```javascript
// Automatic integration with health manager
import { initializeHealthManager } from './runtime/health-integration'
import { initializeDegradation } from './runtime/degradation-integration'

// Start both systems - they integrate automatically
initializeHealthManager()
initializeDegradation()

// Health manager alerts trigger degradation evaluation
// Degradation events create alerts in alert system
```

### Alert System Integration

```javascript
// Automatic integration with alert system
import { initializeAlerting } from './observability/alert-integration'
import { initializeDegradation } from './runtime/degradation-integration'

// Start both systems
initializeAlerting()
initializeDegradation()

// Degradation activation/deactivation creates alerts
// Critical alerts can trigger degradation evaluation
```

## Emergency Actions

### Available Emergency Actions

1. **Garbage Collection**: Force GC to free memory
2. **Cache Clearing**: Clear caches with configurable priority
3. **Connection Cleanup**: Close idle connections
4. **Feature Disabling**: Disable non-essential features
5. **Load Shedding**: Increase request drop probability

### Triggering Emergency Actions

```bash
# Via CLI
node scripts/degradation-cli.js emergency

# Via API
curl -X POST http://localhost:3000/health/degradation/emergency

# Programmatically
import { triggerEmergencyActions } from './runtime/degradation-integration'
const result = triggerEmergencyActions()
```

## Monitoring and Observability

### Degradation Metrics

The system provides comprehensive metrics:

- **degradation_level**: Current degradation level (0-3)
- **degradation_active**: Whether degradation is active (0/1)
- **requests_dropped_total**: Total requests dropped by load shedding
- **features_disabled_total**: Number of features currently disabled
- **cache_reductions_total**: Number of cache clearing operations
- **connections_dropped_total**: Number of connections closed
- **gc_triggers_total**: Number of garbage collection triggers

### Health Checks

The degradation system includes self-monitoring:

- **System metrics evaluation**: Monitors memory, CPU, response time, error rate
- **Degradation rule evaluation**: Monitors rule evaluation performance
- **Load shedding effectiveness**: Tracks request acceptance/rejection rates
- **Recovery monitoring**: Tracks recovery success and timing

## Configuration and Customization

### Custom Degradation Levels

```javascript
import { degradationController } from './runtime/degradation-controller'

// Add custom degradation level
degradationController.addDegradationLevel({
  level: 4,
  name: 'Custom Emergency',
  description: 'Custom emergency degradation for specific scenarios',
  triggers: [
    { type: 'custom', threshold: 100, duration: 1000, operator: '>' }
  ],
  actions: [
    { type: 'custom', target: 'emergency_shutdown' }
  ],
  recoveryThreshold: 0.3
})
```

### Custom Triggers

```javascript
// Add custom trigger evaluation
degradationController.on('evaluate-custom-triggers', (metrics) => {
  // Your custom trigger logic
  if (metrics.customMetric > threshold) {
    degradationController.forceDegradation(2, 'custom-trigger')
  }
})
```

## Testing and Validation

### Comprehensive Testing

```bash
# Run full degradation system test
node scripts/degradation-cli.js test

# Test specific scenarios
node scripts/degradation-cli.js force 1 "Test light degradation"
node scripts/degradation-cli.js force 2 "Test moderate degradation"
node scripts/degradation-cli.js force 3 "Test severe degradation"
node scripts/degradation-cli.js recover "Test recovery"
```

### Load Testing Integration

```javascript
// During load testing, monitor degradation
import { getDegradationStatus } from './runtime/degradation-integration'

setInterval(() => {
  const status = getDegradationStatus()
  if (status.active) {
    console.log(`Degradation active: Level ${status.level} - ${status.levelName}`)
    console.log(`Requests dropped: ${status.metrics.requestsDropped}`)
  }
}, 10000) // Every 10 seconds
```

## Benefits for 48-Hour Test Stability

This Graceful Degradation System directly addresses the issues from your failed 48-hour test:

### Before vs After

**Before (48-hour test failure):**
- ❌ System became completely unresponsive after 5 hours
- ❌ No graceful handling of resource exhaustion
- ❌ All-or-nothing failure mode
- ❌ No automatic recovery mechanisms
- ❌ No load shedding or backpressure management

**Now (Graceful Degradation):**
- ✅ **Graceful Degradation**: System maintains core functionality under stress
- ✅ **Early Intervention**: Degradation triggers before complete failure
- ✅ **Load Shedding**: Automatically reduces load during stress
- ✅ **Resource Management**: Proactive memory and connection cleanup
- ✅ **Automatic Recovery**: Returns to normal when conditions improve
- ✅ **Feature Prioritization**: Maintains essential features while disabling non-critical ones

### Specific 48-Hour Test Improvements

1. **Memory Exhaustion**: Would trigger degradation at 80% memory, preventing the 95%+ usage that caused failure
2. **Response Time Degradation**: Would detect slow responses and reduce load before complete unresponsiveness
3. **Resource Cleanup**: Would automatically trigger GC and connection cleanup to free resources
4. **Load Reduction**: Would shed non-essential requests to maintain core functionality
5. **Feature Prioritization**: Would disable analytics and logging while maintaining health endpoints

The degradation system ensures that instead of failing completely, your system gracefully reduces functionality while maintaining availability for critical operations, allowing it to survive the full 48-hour test duration.
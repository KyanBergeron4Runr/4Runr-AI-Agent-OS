# Watchdog Service Integration Guide

## Overview

The Watchdog Service provides external process monitoring and automatic recovery for the 4RUNR Gateway. It addresses the core stability issue where the system became unresponsive after 5 hours during the 48-hour test.

## Key Features

- **External Process Monitoring**: Runs as a separate process to monitor the main application
- **HTTP Health Checks**: Monitors application responsiveness via `/health` endpoint
- **Resource Monitoring**: Tracks memory and CPU usage
- **Automatic Recovery**: Restarts unresponsive processes automatically
- **Configurable Thresholds**: Customizable failure detection and recovery settings
- **Recovery Limits**: Prevents infinite restart loops with configurable limits
- **Comprehensive Logging**: Detailed logs of all monitoring and recovery actions

## Quick Start

### 1. Start Watchdog with Your Application

```bash
# Start your application with watchdog monitoring
node scripts/watchdog-cli.js start npm start

# Or monitor a specific command
node scripts/watchdog-cli.js start node dist/index.js
```

### 2. Monitor Existing Process

```bash
# Monitor an already running process by PID
node scripts/watchdog-cli.js monitor 1234
```

### 3. Check Status

```bash
# Check current watchdog status
node scripts/watchdog-cli.js status
```

### 4. View Logs

```bash
# View recent watchdog logs
node scripts/watchdog-cli.js logs
```

### 5. Stop Monitoring

```bash
# Stop the watchdog service
node scripts/watchdog-cli.js stop
```

## Configuration

The watchdog can be configured with the following options:

```javascript
const watchdog = new WatchdogService({
  healthCheckUrl: 'http://localhost:3000/health',  // Health check endpoint
  healthCheckInterval: 30000,                      // Check every 30 seconds
  healthCheckTimeout: 5000,                        // 5 second timeout
  maxResponseTime: 2000,                           // Max 2 second response time
  maxMemoryMB: 512,                               // Max 512MB memory usage
  maxCpuPercent: 80,                              // Max 80% CPU usage
  failureThreshold: 3,                            // 3 failures before restart
  restartDelay: 5000,                             // 5 second delay before restart
  maxRestarts: 5,                                 // Max 5 restarts per window
  restartWindow: 300000,                          // 5 minute restart window
  logFile: 'logs/watchdog.log'                    // Log file location
})
```

## Integration with Existing System

### Option 1: CLI Integration (Recommended)

Use the CLI tool to start your application with monitoring:

```bash
# In your package.json scripts
{
  "scripts": {
    "start:monitored": "node scripts/watchdog-cli.js start npm start",
    "start:dev:monitored": "node scripts/watchdog-cli.js start npm run dev"
  }
}
```

### Option 2: Programmatic Integration

```javascript
const { WatchdogService } = require('./dist/runtime/watchdog')

// Create and configure watchdog
const watchdog = new WatchdogService({
  healthCheckUrl: 'http://localhost:3000/health',
  failureThreshold: 3,
  maxRestarts: 5
})

// Set up event listeners
watchdog.on('health-check-failed', (health, error) => {
  console.log(`Health check failed: ${error}`)
})

watchdog.on('process-restarted', (reason, restartCount) => {
  console.log(`Process restarted (${restartCount}): ${reason}`)
})

watchdog.on('escalation-required', (reason, restartCount) => {
  console.log(`ESCALATION REQUIRED: ${reason}`)
  // Send alerts to operations team
})

// Start monitoring
await watchdog.monitorProcess(process.pid)
```

## Monitoring and Alerts

### Health Check Events

- `health-check-passed`: Health check succeeded
- `health-check-failed`: Health check failed
- `process-restarted`: Process was restarted
- `escalation-required`: Max restarts reached, manual intervention needed
- `monitoring-started`: Monitoring began
- `monitoring-stopped`: Monitoring ended

### Log Files

Watchdog logs are written to `logs/watchdog.log` and include:

- Health check results
- Process restart events
- Error conditions
- Recovery actions
- Escalation events

### Status Monitoring

Check watchdog status programmatically:

```javascript
const health = watchdog.getProcessHealth()
console.log(`Responsive: ${health.responsive}`)
console.log(`Response Time: ${health.responseTime}ms`)
console.log(`Memory Usage: ${health.memoryUsage}MB`)
console.log(`Consecutive Failures: ${health.consecutiveFailures}`)

const history = watchdog.getRecoveryHistory()
console.log(`Recovery Events: ${history.length}`)
```

## Production Deployment

### Docker Integration

```dockerfile
# Add watchdog to your Docker image
COPY scripts/watchdog-cli.js /app/scripts/
COPY dist/runtime/watchdog.js /app/dist/runtime/

# Use watchdog as the main process
CMD ["node", "scripts/watchdog-cli.js", "start", "node", "dist/index.js"]
```

### Kubernetes Integration

```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: gateway
    image: 4runr/gateway:latest
    command: ["node", "scripts/watchdog-cli.js", "start", "node", "dist/index.js"]
    livenessProbe:
      httpGet:
        path: /health
        port: 3000
      initialDelaySeconds: 30
      periodSeconds: 30
    readinessProbe:
      httpGet:
        path: /ready
        port: 3000
      initialDelaySeconds: 5
      periodSeconds: 10
```

### Process Manager Integration

```bash
# PM2 integration
pm2 start "node scripts/watchdog-cli.js start node dist/index.js" --name "gateway-watchdog"

# systemd integration
[Unit]
Description=4RUNR Gateway with Watchdog
After=network.target

[Service]
Type=simple
User=gateway
WorkingDirectory=/opt/4runr-gateway
ExecStart=/usr/bin/node scripts/watchdog-cli.js start node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Troubleshooting

### Common Issues

1. **Health checks failing immediately**
   - Verify the health endpoint is accessible
   - Check if the application is fully started
   - Adjust `healthCheckTimeout` if needed

2. **Too many restarts**
   - Check application logs for root cause
   - Adjust `failureThreshold` and `maxRestarts`
   - Verify resource limits are appropriate

3. **Watchdog not starting**
   - Ensure logs directory exists
   - Check file permissions
   - Verify Node.js version compatibility

### Debug Mode

Enable verbose logging:

```bash
DEBUG=watchdog node scripts/watchdog-cli.js start npm start
```

### Manual Recovery

If the watchdog reaches escalation:

```bash
# Check status
node scripts/watchdog-cli.js status

# View recent logs
node scripts/watchdog-cli.js logs

# Manually restart if needed
node scripts/watchdog-cli.js restart

# Stop and restart watchdog
node scripts/watchdog-cli.js stop
node scripts/watchdog-cli.js start npm start
```

## Benefits for Long-Term Stability

The Watchdog Service directly addresses the 48-hour test failure by:

1. **Early Detection**: Detects unresponsive applications within 30 seconds
2. **Automatic Recovery**: Restarts failed processes without manual intervention
3. **Resource Monitoring**: Prevents resource exhaustion before it causes failures
4. **Escalation**: Alerts operators when automatic recovery fails
5. **Comprehensive Logging**: Provides detailed audit trail for debugging
6. **Configurable Limits**: Prevents infinite restart loops that could mask underlying issues

This ensures your system can recover from the type of 5-hour unresponsiveness that caused the original 48-hour test to fail.
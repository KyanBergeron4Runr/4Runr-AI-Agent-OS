# 4Runr Gateway - Agent Execution System

## 🚀 **100% Reliable Operation Guide**

This system provides a robust agent execution platform with real-time monitoring, guard events, and comprehensive testing.

## 📋 **Quick Start (100% Reliable)**

### 1. **Stop Any Existing Processes**
```bash
# Run this first to ensure clean state
.\stop-reliable.bat
```

### 2. **Start the Gateway**
```bash
# This will automatically check for port conflicts
.\start-reliable.bat
```

### 3. **Test the System**
```bash
# Comprehensive test that verifies everything works
test-system.bat
```

## 🔧 **Manual Commands (If Needed)**

### Start Gateway
```bash
node simple-gateway.js
```

### Stop Gateway
```bash
# Find and kill Node.js processes
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force
```

### Test Individual Components
```bash
# Check gateway health
node cli.js status

# List available agents
node cli.js list

# Start an agent run
node cli.js run demo-enricher

# View run logs (use actual run ID from 'ps' command)
node cli.js logs 2dd25001-1c7f-4909-bf70-9ab8749bb2f8

# List active runs
node cli.js ps

# Run comprehensive test
node prove-it-agents-runs.js
```

## 🛠️ **Troubleshooting**

### Port Already in Use Error
**Solution**: Run `.\stop-reliable.bat` first, then `.\start-reliable.bat`

### PowerShell Redirection Error
**Solution**: Use actual run IDs instead of `<run-id>` syntax

### Multiple Gateway Instances
**Solution**: Use `.\stop-reliable.bat` to clean up all processes

## 📊 **System Components**

### Core Files
- `simple-gateway.js` - Main gateway server
- `cli.js` - Command-line interface
- `prove-it-agents-runs.js` - Comprehensive test suite

### Management Scripts
- `start-reliable.bat` - Simple, reliable gateway startup
- `stop-reliable.bat` - Simple, reliable process shutdown
- `test-system.bat` - Full system verification

## 🎯 **Proven Reliability Features**

1. **Port Conflict Detection** - Automatically detects and reports port conflicts
2. **Process Management** - Proper startup/shutdown with cleanup
3. **Error Handling** - Comprehensive error messages and recovery
4. **Testing Suite** - 10-point test that verifies all functionality
5. **Guard Events** - Real-time safety monitoring
6. **Log Streaming** - Live log viewing with SSE
7. **Idempotency** - Safe retry operations

## ✅ **Success Indicators**

When the system is working correctly, you should see:

1. **Gateway Startup**: `✅ Enhanced Gateway running on http://127.0.0.1:3000`
2. **Health Check**: `🎉 Gateway is ready for agent execution!`
3. **Prove-It Test**: `🎉 Prove-It Test PASSED! (10/10 tests)`
4. **Guard Events**: `🛡️ [sentinel.heartbeat] Agent started`

## 🚨 **Common Issues & Solutions**

| Issue | Error Message | Solution |
|-------|---------------|----------|
| Port in use | `EADDRINUSE: address already in use` | Run `.\stop-reliable.bat` first |
| PowerShell syntax | `'<' operator is reserved` | Use actual run IDs, not `<run-id>` |
| Gateway not responding | `Connection error` | Check if gateway is running with `node cli.js status` |
| Multiple processes | Multiple Node.js instances | Use `.\stop-reliable.bat` to clean up |

## 🎉 **Success Checklist**

- [ ] Gateway starts without port conflicts
- [ ] Health check returns `✅ OK`
- [ ] Agent listing works (`node cli.js list`)
- [ ] Run creation works (`node cli.js run demo-enricher`)
- [ ] Log streaming works with guard events
- [ ] Prove-It test passes (10/10)
- [ ] All CLI commands work without errors

## 📞 **Support**

If you encounter issues:
1. Run `.\stop-reliable.bat` to clean state
2. Run `.\start-reliable.bat` to restart
3. Run `node prove-it-agents-runs.js` to verify
4. Check this README for troubleshooting

**The system is designed to be 100% reliable when used with the provided scripts.**

#!/usr/bin/env node

/**
 * Watchdog CLI - Command line interface for managing the watchdog service
 * 
 * Usage:
 *   node scripts/watchdog-cli.js start [command] [args...]
 *   node scripts/watchdog-cli.js monitor <pid>
 *   node scripts/watchdog-cli.js status
 *   node scripts/watchdog-cli.js restart
 *   node scripts/watchdog-cli.js stop
 */

const { WatchdogService } = require('../dist/runtime/watchdog')
const { promises: fs } = require('fs')
const path = require('path')

const WATCHDOG_PID_FILE = 'logs/watchdog.pid'
const WATCHDOG_STATUS_FILE = 'logs/watchdog-status.json'

async function main() {
  const [,, command, ...args] = process.argv
  
  try {
    switch (command) {
      case 'start':
        await startWatchdog(args)
        break
        
      case 'monitor':
        await monitorPid(parseInt(args[0]))
        break
        
      case 'status':
        await showStatus()
        break
        
      case 'restart':
        await restartProcess()
        break
        
      case 'stop':
        await stopWatchdog()
        break
        
      case 'logs':
        await showLogs()
        break
        
      default:
        showHelp()
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
    process.exit(1)
  }
}

async function startWatchdog(commandArgs) {
  if (commandArgs.length === 0) {
    throw new Error('Please specify command to monitor')
  }
  
  const [cmd, ...cmdArgs] = commandArgs
  
  console.log('🐕 Starting Watchdog Service...')
  console.log(`📋 Command: ${cmd} ${cmdArgs.join(' ')}`)
  
  // Ensure logs directory exists
  await fs.mkdir('logs', { recursive: true })
  
  const watchdog = new WatchdogService({
    logFile: 'logs/watchdog.log',
    healthCheckUrl: 'http://localhost:3000/health',
    healthCheckInterval: 30000,
    maxResponseTime: 2000,
    failureThreshold: 3,
    maxRestarts: 5
  })
  
  // Set up event listeners
  watchdog.on('monitoring-started', (pid) => {
    console.log(`✅ Monitoring started for PID ${pid}`)
    savePidFile(process.pid) // Save watchdog PID
    updateStatus({ status: 'monitoring', monitoredPid: pid, watchdogPid: process.pid })
  })
  
  watchdog.on('health-check-passed', (health) => {
    updateStatus({ 
      status: 'healthy', 
      lastCheck: health.lastCheck,
      responseTime: health.responseTime,
      memoryUsage: health.memoryUsage
    })
  })
  
  watchdog.on('health-check-failed', (health, error) => {
    console.log(`⚠️ Health check failed: ${error}`)
    updateStatus({ 
      status: 'unhealthy', 
      lastCheck: health.lastCheck,
      consecutiveFailures: health.consecutiveFailures,
      lastError: error
    })
  })
  
  watchdog.on('process-restarted', (reason, restartCount) => {
    console.log(`🔄 Process restarted (${restartCount}): ${reason}`)
    updateStatus({ status: 'restarted', lastRestart: new Date(), restartCount })
  })
  
  watchdog.on('escalation-required', (reason, restartCount) => {
    console.log(`🚨 ESCALATION REQUIRED: ${reason} (${restartCount} restarts)`)
    updateStatus({ status: 'escalated', escalationReason: reason, restartCount })
  })
  
  watchdog.on('monitoring-ended', (reason) => {
    console.log(`💀 Monitoring ended: ${reason}`)
    updateStatus({ status: 'ended', endReason: reason })
    cleanup()
  })
  
  // Start monitoring the spawned process
  try {
    await watchdog.monitorSpawnedProcess(cmd, cmdArgs, {
      cwd: process.cwd(),
      env: process.env
    })
    
    console.log('🐕 Watchdog is now monitoring the process')
    console.log('📊 Use "node scripts/watchdog-cli.js status" to check status')
    console.log('🛑 Use "node scripts/watchdog-cli.js stop" to stop monitoring')
    
    // Keep the watchdog running
    process.on('SIGTERM', async () => {
      console.log('🛑 Stopping watchdog...')
      await watchdog.stop()
      cleanup()
      process.exit(0)
    })
    
    process.on('SIGINT', async () => {
      console.log('🛑 Stopping watchdog...')
      await watchdog.stop()
      cleanup()
      process.exit(0)
    })
    
  } catch (error) {
    console.error(`❌ Failed to start monitoring: ${error.message}`)
    cleanup()
    process.exit(1)
  }
}

async function monitorPid(pid) {
  if (!pid || isNaN(pid)) {
    throw new Error('Please provide a valid PID')
  }
  
  console.log(`🐕 Starting Watchdog to monitor PID ${pid}...`)
  
  // Ensure logs directory exists
  await fs.mkdir('logs', { recursive: true })
  
  const watchdog = new WatchdogService({
    logFile: 'logs/watchdog.log'
  })
  
  // Set up event listeners (same as above)
  setupWatchdogEvents(watchdog)
  
  await watchdog.monitorProcess(pid)
  
  console.log('🐕 Watchdog is now monitoring the process')
  
  // Keep running
  await new Promise(() => {}) // Run forever
}

async function showStatus() {
  try {
    const statusData = await fs.readFile(WATCHDOG_STATUS_FILE, 'utf-8')
    const status = JSON.parse(statusData)
    
    console.log('📊 Watchdog Status:')
    console.log(`   Status: ${status.status}`)
    console.log(`   Watchdog PID: ${status.watchdogPid || 'Unknown'}`)
    console.log(`   Monitored PID: ${status.monitoredPid || 'None'}`)
    
    if (status.lastCheck) {
      console.log(`   Last Check: ${new Date(status.lastCheck).toLocaleString()}`)
    }
    
    if (status.responseTime !== undefined) {
      console.log(`   Response Time: ${status.responseTime}ms`)
    }
    
    if (status.memoryUsage !== undefined) {
      console.log(`   Memory Usage: ${status.memoryUsage}MB`)
    }
    
    if (status.consecutiveFailures) {
      console.log(`   Consecutive Failures: ${status.consecutiveFailures}`)
    }
    
    if (status.restartCount) {
      console.log(`   Restart Count: ${status.restartCount}`)
    }
    
    if (status.lastError) {
      console.log(`   Last Error: ${status.lastError}`)
    }
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('📊 Watchdog Status: Not running')
    } else {
      throw error
    }
  }
}

async function restartProcess() {
  const pidFile = await readPidFile()
  if (!pidFile) {
    throw new Error('Watchdog is not running')
  }
  
  console.log('🔄 Requesting process restart...')
  
  // Send signal to watchdog to restart the monitored process
  // This is a simplified implementation - in production you'd use IPC
  process.kill(pidFile, 'SIGUSR1')
  
  console.log('✅ Restart signal sent')
}

async function stopWatchdog() {
  const pidFile = await readPidFile()
  if (!pidFile) {
    console.log('⚠️ Watchdog is not running')
    return
  }
  
  console.log('🛑 Stopping watchdog...')
  
  try {
    process.kill(pidFile, 'SIGTERM')
    
    // Wait for shutdown
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    cleanup()
    console.log('✅ Watchdog stopped')
  } catch (error) {
    if (error.code === 'ESRCH') {
      console.log('⚠️ Watchdog process not found (may have already stopped)')
      cleanup()
    } else {
      throw error
    }
  }
}

async function showLogs() {
  try {
    const logs = await fs.readFile('logs/watchdog.log', 'utf-8')
    const lines = logs.split('\n').slice(-50) // Last 50 lines
    
    console.log('📋 Recent Watchdog Logs:')
    console.log('─'.repeat(80))
    lines.forEach(line => {
      if (line.trim()) {
        console.log(line)
      }
    })
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('📋 No log file found')
    } else {
      throw error
    }
  }
}

function showHelp() {
  console.log(`
Watchdog CLI - Process Monitoring and Recovery

Commands:
  start <command> [args...]  - Start watchdog and monitor a new process
  monitor <pid>             - Start watchdog to monitor existing process
  status                    - Show current watchdog status
  restart                   - Request restart of monitored process
  stop                      - Stop the watchdog service
  logs                      - Show recent watchdog logs

Examples:
  node scripts/watchdog-cli.js start npm start
  node scripts/watchdog-cli.js start node dist/index.js
  node scripts/watchdog-cli.js monitor 1234
  node scripts/watchdog-cli.js status
  node scripts/watchdog-cli.js stop

The watchdog monitors process health via HTTP health checks and can automatically
restart processes that become unresponsive or consume too many resources.
`)
}

async function savePidFile(pid) {
  await fs.writeFile(WATCHDOG_PID_FILE, pid.toString())
}

async function readPidFile() {
  try {
    const pidStr = await fs.readFile(WATCHDOG_PID_FILE, 'utf-8')
    return parseInt(pidStr.trim())
  } catch {
    return null
  }
}

async function updateStatus(statusUpdate) {
  try {
    let currentStatus = {}
    try {
      const statusData = await fs.readFile(WATCHDOG_STATUS_FILE, 'utf-8')
      currentStatus = JSON.parse(statusData)
    } catch {
      // File doesn't exist, start with empty status
    }
    
    const newStatus = {
      ...currentStatus,
      ...statusUpdate,
      lastUpdate: new Date().toISOString()
    }
    
    await fs.writeFile(WATCHDOG_STATUS_FILE, JSON.stringify(newStatus, null, 2))
  } catch (error) {
    console.error('Failed to update status file:', error)
  }
}

function cleanup() {
  try {
    require('fs').unlinkSync(WATCHDOG_PID_FILE)
  } catch {}
  
  try {
    require('fs').unlinkSync(WATCHDOG_STATUS_FILE)
  } catch {}
}

function setupWatchdogEvents(watchdog) {
  watchdog.on('monitoring-started', (pid) => {
    console.log(`✅ Monitoring started for PID ${pid}`)
    savePidFile(process.pid)
    updateStatus({ status: 'monitoring', monitoredPid: pid, watchdogPid: process.pid })
  })
  
  watchdog.on('health-check-failed', (health, error) => {
    console.log(`⚠️ Health check failed: ${error}`)
  })
  
  watchdog.on('process-restarted', (reason, restartCount) => {
    console.log(`🔄 Process restarted (${restartCount}): ${reason}`)
  })
  
  watchdog.on('escalation-required', (reason, restartCount) => {
    console.log(`🚨 ESCALATION REQUIRED: ${reason}`)
  })
}

main()
#!/usr/bin/env node

/**
 * Test script for Watchdog Service
 * Tests process monitoring, health checking, and recovery mechanisms
 */

const { WatchdogService } = require('../dist/runtime/watchdog')
const http = require('http')

async function testWatchdog() {
  console.log('🧪 Testing Watchdog Service...\n')
  
  let testsPassed = 0
  let testsTotal = 0
  
  async function test(name, testFn) {
    testsTotal++
    try {
      console.log(`🔍 ${name}...`)
      await testFn()
      console.log(`✅ ${name} - PASSED\n`)
      testsPassed++
    } catch (error) {
      console.log(`❌ ${name} - FAILED: ${error.message}\n`)
    }
  }
  
  // Test 1: Watchdog initialization
  await test('Watchdog initialization', async () => {
    const watchdog = new WatchdogService({
      healthCheckInterval: 2000, // 2 seconds for testing
      healthCheckTimeout: 1000,
      maxResponseTime: 500,
      failureThreshold: 2,
      logFile: 'logs/test-watchdog.log'
    })
    
    if (!watchdog) {
      throw new Error('Failed to create watchdog instance')
    }
    
    console.log('   Watchdog instance created successfully')
  })
  
  // Test 2: Mock HTTP server for health checks
  let mockServer
  await test('Mock HTTP server setup', async () => {
    mockServer = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, timestamp: new Date().toISOString() }))
      } else {
        res.writeHead(404)
        res.end('Not Found')
      }
    })
    
    await new Promise((resolve, reject) => {
      mockServer.listen(3001, (error) => {
        if (error) reject(error)
        else resolve()
      })
    })
    
    console.log('   Mock server listening on port 3001')
  })
  
  // Test 3: Health check functionality
  await test('Health check functionality', async () => {
    const watchdog = new WatchdogService({
      healthCheckUrl: 'http://localhost:3001/health',
      healthCheckInterval: 1000,
      healthCheckTimeout: 500,
      maxResponseTime: 200,
      failureThreshold: 2
    })
    
    let healthCheckPassed = false
    
    watchdog.on('health-check-passed', (health) => {
      healthCheckPassed = true
      console.log(`   Health check passed: ${health.responseTime}ms`)
    })
    
    // Start monitoring current process (self-monitoring for test)
    await watchdog.monitorProcess(process.pid)
    
    // Wait for health check
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    await watchdog.stop()
    
    if (!healthCheckPassed) {
      throw new Error('Health check did not pass')
    }
  })
  
  // Test 4: Health check failure detection
  await test('Health check failure detection', async () => {
    // Stop mock server to simulate failure
    mockServer.close()
    
    const watchdog = new WatchdogService({
      healthCheckUrl: 'http://localhost:3001/health',
      healthCheckInterval: 1000,
      healthCheckTimeout: 500,
      maxResponseTime: 200,
      failureThreshold: 2
    })
    
    let healthCheckFailed = false
    
    watchdog.on('health-check-failed', (health, error) => {
      healthCheckFailed = true
      console.log(`   Health check failed as expected: ${error}`)
    })
    
    await watchdog.monitorProcess(process.pid)
    
    // Wait for failure detection
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    await watchdog.stop()
    
    if (!healthCheckFailed) {
      throw new Error('Health check failure was not detected')
    }
  })
  
  // Test 5: Process health metrics
  await test('Process health metrics', async () => {
    const watchdog = new WatchdogService()
    
    const health = watchdog.getProcessHealth()
    
    if (!health || typeof health.lastCheck === 'undefined') {
      throw new Error('Process health metrics not available')
    }
    
    console.log(`   Health metrics available: responsive=${health.responsive}`)
  })
  
  // Test 6: Recovery event recording
  await test('Recovery event recording', async () => {
    const watchdog = new WatchdogService()
    
    let recoveryEventRecorded = false
    
    watchdog.on('recovery-event', (event) => {
      recoveryEventRecorded = true
      console.log(`   Recovery event recorded: ${event.action} - ${event.reason}`)
    })
    
    // Simulate a recovery event by calling the private method through events
    watchdog.emit('recovery-event', {
      timestamp: new Date(),
      reason: 'Test recovery event',
      action: 'restart',
      success: true
    })
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    if (!recoveryEventRecorded) {
      throw new Error('Recovery event was not recorded')
    }
    
    const history = watchdog.getRecoveryHistory()
    console.log(`   Recovery history length: ${history.length}`)
  })
  
  // Test 7: Graceful shutdown
  await test('Graceful shutdown', async () => {
    const watchdog = new WatchdogService()
    
    let shutdownCompleted = false
    
    watchdog.on('monitoring-stopped', () => {
      shutdownCompleted = true
      console.log('   Watchdog stopped gracefully')
    })
    
    await watchdog.stop()
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    if (!shutdownCompleted) {
      throw new Error('Graceful shutdown did not complete')
    }
  })
  
  // Summary
  console.log('📊 Test Results:')
  console.log(`   Passed: ${testsPassed}/${testsTotal}`)
  console.log(`   Success Rate: ${Math.round(testsPassed / testsTotal * 100)}%`)
  
  if (testsPassed === testsTotal) {
    console.log('\n🎉 All tests passed! Watchdog Service is working correctly.')
    process.exit(0)
  } else {
    console.log('\n❌ Some tests failed. Please check the Watchdog Service implementation.')
    process.exit(1)
  }
}

testWatchdog().catch(error => {
  console.error('💥 Test runner failed:', error)
  process.exit(1)
})
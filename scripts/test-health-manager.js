#!/usr/bin/env node

/**
 * Test script for Health Manager functionality
 * Tests health checks, resource monitoring, and alert generation
 */

const { HealthManager } = require('../dist/runtime/health-manager')

async function testHealthManager() {
  console.log('🧪 Testing Health Manager...\n')
  
  const healthManager = new HealthManager()
  let testsPassed = 0
  let testsTotal = 0
  
  function test(name, testFn) {
    testsTotal++
    return new Promise(async (resolve) => {
      try {
        console.log(`🔍 ${name}...`)
        await testFn()
        console.log(`✅ ${name} - PASSED\n`)
        testsPassed++
        resolve()
      } catch (error) {
        console.log(`❌ ${name} - FAILED: ${error.message}\n`)
        resolve()
      }
    })
  }
  
  // Test 1: Health Manager initialization
  await test('Health Manager initialization', async () => {
    healthManager.start()
    
    // Wait a moment for initialization
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const status = await healthManager.getHealthStatus()
    if (!status) {
      throw new Error('Health status not available')
    }
    
    console.log(`   Overall health: ${status.overall}`)
    console.log(`   Active checks: ${Object.keys(status.checks).length}`)
    console.log(`   Active alerts: ${status.alerts.length}`)
  })
  
  // Test 2: Resource metrics collection
  await test('Resource metrics collection', async () => {
    const metrics = await healthManager.getResourceMetrics()
    
    if (!metrics.memory || !metrics.cpu) {
      throw new Error('Missing resource metrics')
    }
    
    console.log(`   Memory usage: ${(metrics.memory.heapUsed / 1024 / 1024).toFixed(1)}MB`)
    console.log(`   CPU usage: ${metrics.cpu.usage.toFixed(1)}%`)
    console.log(`   Uptime: ${Math.round(metrics.uptime / 1000)}s`)
  })
  
  // Test 3: Custom health check registration
  await test('Custom health check registration', async () => {
    let checkExecuted = false
    
    healthManager.registerHealthCheck({
      name: 'test-check',
      check: async () => {
        checkExecuted = true
        return {
          healthy: true,
          message: 'Test check OK',
          duration: 10
        }
      },
      interval: 1000,
      timeout: 500,
      retries: 1,
      successThreshold: 1,
      failureThreshold: 2
    })
    
    // Wait for check to execute
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    if (!checkExecuted) {
      throw new Error('Custom health check was not executed')
    }
    
    const status = await healthManager.getHealthStatus()
    if (!status.checks['test-check']) {
      throw new Error('Custom health check result not found')
    }
    
    console.log(`   Test check result: ${status.checks['test-check'].message}`)
  })
  
  // Test 4: Alert generation
  await test('Alert generation', async () => {
    let alertGenerated = false
    
    healthManager.on('alert-created', (alert) => {
      alertGenerated = true
      console.log(`   Alert created: ${alert.message}`)
    })
    
    // Register a failing health check to trigger an alert
    healthManager.registerHealthCheck({
      name: 'failing-check',
      check: async () => ({
        healthy: false,
        message: 'Intentional failure for testing',
        duration: 5
      }),
      interval: 500,
      timeout: 100,
      retries: 0,
      successThreshold: 1,
      failureThreshold: 1
    })
    
    // Wait for alert
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    if (!alertGenerated) {
      throw new Error('Alert was not generated for failing check')
    }
  })
  
  // Test 5: Resource leak detection
  await test('Resource leak detection', async () => {
    // Simulate some resource history
    for (let i = 0; i < 15; i++) {
      await healthManager.getResourceMetrics()
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    const leaks = healthManager.detectResourceLeaks()
    console.log(`   Leak detection completed (${leaks.length} potential leaks found)`)
    
    // This test passes if leak detection runs without error
  })
  
  // Cleanup
  healthManager.stop()
  
  // Summary
  console.log('📊 Test Results:')
  console.log(`   Passed: ${testsPassed}/${testsTotal}`)
  console.log(`   Success Rate: ${Math.round(testsPassed / testsTotal * 100)}%`)
  
  if (testsPassed === testsTotal) {
    console.log('\n🎉 All tests passed! Health Manager is working correctly.')
    process.exit(0)
  } else {
    console.log('\n❌ Some tests failed. Please check the Health Manager implementation.')
    process.exit(1)
  }
}

testHealthManager().catch(error => {
  console.error('💥 Test runner failed:', error)
  process.exit(1)
})
#!/usr/bin/env node

/**
 * Graceful Degradation CLI
 * Command line interface for managing the graceful degradation system
 * 
 * Usage:
 *   node scripts/degradation-cli.js start
 *   node scripts/degradation-cli.js status
 *   node scripts/degradation-cli.js metrics
 *   node scripts/degradation-cli.js force <level> [reason]
 *   node scripts/degradation-cli.js recover [reason]
 *   node scripts/degradation-cli.js emergency
 *   node scripts/degradation-cli.js test
 */

const { initializeDegradation, getDegradationStatus, getDegradationMetrics, forceDegradation, forceRecovery, triggerEmergencyActions, testDegradationSystem } = require('../dist/runtime/degradation-integration')

async function main() {
  const [,, command, ...args] = process.argv
  
  try {
    switch (command) {
      case 'start':
        await startDegradation()
        break
        
      case 'status':
        await showStatus()
        break
        
      case 'metrics':
        await showMetrics()
        break
        
      case 'force':
        await forceDegradationLevel(args[0], args[1])
        break
        
      case 'recover':
        await recoverFromDegradation(args[0])
        break
        
      case 'emergency':
        await triggerEmergency()
        break
        
      case 'test':
        await testSystem()
        break
        
      default:
        showHelp()
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
    process.exit(1)
  }
}

async function startDegradation() {
  console.log('🛡️ Starting Graceful Degradation Controller...')
  
  initializeDegradation()
  
  console.log('✅ Graceful Degradation Controller started')
  console.log('🛡️ Degradation features:')
  console.log('   - Automatic load shedding based on system metrics')
  console.log('   - 3-level degradation system (Light → Moderate → Severe)')
  console.log('   - Feature toggling for non-essential functionality')
  console.log('   - Backpressure management and request queuing')
  console.log('   - Emergency actions (GC, cache clearing, connection cleanup)')
  console.log('')
  console.log('🌐 Degradation endpoints available:')
  console.log('   - GET /health/degradation (status)')
  console.log('   - GET /health/degradation/metrics (metrics)')
  console.log('   - GET /health/degradation/features/:feature (feature check)')
  console.log('   - POST /health/degradation/force (force degradation)')
  console.log('   - POST /health/degradation/recover (force recovery)')
  console.log('   - POST /health/degradation/emergency (emergency actions)')
  console.log('')
  console.log('📋 Use "node scripts/degradation-cli.js status" to check status')
  
  // Keep running to show real-time degradation status
  console.log('🛡️ Real-time degradation monitoring (Ctrl+C to stop):')
  
  setInterval(async () => {
    try {
      const status = getDegradationStatus()
      if (status.enabled) {
        const timestamp = new Date().toLocaleTimeString()
        if (status.active) {
          console.log(`[${timestamp}] 🛡️ DEGRADATION ACTIVE - Level ${status.level}: ${status.levelName}`)
          if (status.metrics.requestsDropped > 0) {
            console.log(`   Requests dropped: ${status.metrics.requestsDropped}`)
          }
          if (status.metrics.featuresDisabled.length > 0) {
            console.log(`   Features disabled: ${status.metrics.featuresDisabled.join(', ')}`)
          }
        } else {
          console.log(`[${timestamp}] ✅ System operating normally - No degradation active`)
        }
      }
    } catch (error) {
      console.log(`[${new Date().toLocaleTimeString()}] Error getting degradation status: ${error.message}`)
    }
  }, 30000) // Every 30 seconds
}

async function showStatus() {
  console.log('🛡️ Graceful Degradation Status\n')
  
  const status = getDegradationStatus()
  
  if (!status.enabled) {
    console.log('❌ Graceful Degradation is not running')
    console.log('   Use "node scripts/degradation-cli.js start" to start degradation controller')
    return
  }
  
  console.log(`System Status: ${status.active ? '🛡️ DEGRADED' : '✅ Normal Operation'}`)
  console.log(`Last Update: ${new Date(status.timestamp).toLocaleString()}`)
  console.log('')
  
  if (status.active) {
    console.log('🛡️ Degradation Details:')
    console.log(`   Level: ${status.level} - ${status.levelName}`)
    console.log(`   Activated: ${new Date(status.activatedAt).toLocaleString()}`)
    console.log(`   Duration: ${getDuration(status.activatedAt)}`)
    console.log('')
    
    if (status.triggers.length > 0) {
      console.log('⚡ Active Triggers:')
      status.triggers.forEach(trigger => {
        console.log(`   - ${trigger}`)
      })
      console.log('')
    }
    
    if (status.actions.length > 0) {
      console.log('🔧 Active Actions:')
      status.actions.forEach(action => {
        console.log(`   - ${action}`)
      })
      console.log('')
    }
    
    console.log('📊 Degradation Metrics:')
    console.log(`   Requests Dropped: ${status.metrics.requestsDropped}`)
    console.log(`   Features Disabled: ${status.metrics.featuresDisabled.length}`)
    if (status.metrics.featuresDisabled.length > 0) {
      console.log(`      ${status.metrics.featuresDisabled.join(', ')}`)
    }
    console.log(`   Cache Reductions: ${status.metrics.cacheReductions}`)
    console.log(`   Connections Dropped: ${status.metrics.connectionsDropped}`)
    console.log('')
    
    if (status.recommendations && status.recommendations.length > 0) {
      console.log('💡 Recommendations:')
      status.recommendations.forEach(rec => {
        console.log(`   - ${rec}`)
      })
    }
  } else {
    console.log('✅ System is operating normally')
    console.log('   - All features enabled')
    console.log('   - No load shedding active')
    console.log('   - Normal request processing')
  }
}

async function showMetrics() {
  console.log('🛡️ Graceful Degradation Metrics\n')
  
  const metrics = getDegradationMetrics()
  
  if (!metrics.enabled) {
    console.log('❌ Graceful Degradation is not running')
    return
  }
  
  console.log(`Metrics Generated: ${new Date(metrics.timestamp).toLocaleString()}`)
  console.log('')
  
  // Current status
  const status = metrics.currentStatus
  console.log('📊 Current Status:')
  console.log(`   Active: ${status.active ? 'Yes' : 'No'}`)
  console.log(`   Level: ${status.level} - ${status.levelName}`)
  if (status.active) {
    console.log(`   Duration: ${getDuration(status.activatedAt)}`)
  }
  console.log('')
  
  // Capabilities
  console.log('🔧 System Capabilities:')
  Object.entries(metrics.capabilities).forEach(([capability, enabled]) => {
    const icon = enabled ? '✅' : '❌'
    const name = capability.replace(/([A-Z])/g, ' $1').toLowerCase()
    console.log(`   ${icon} ${name.charAt(0).toUpperCase() + name.slice(1)}`)
  })
  console.log('')
  
  // Degradation levels
  console.log('📈 Degradation Levels:')
  metrics.degradationLevels.forEach(level => {
    const icon = status.level === level.level ? '🛡️' : '📊'
    console.log(`   ${icon} Level ${level.level}: ${level.name}`)
    console.log(`      ${level.description}`)
    console.log(`      Triggers: ${level.triggers.join(', ')}`)
    console.log('')
  })
  
  // Performance metrics
  if (status.active) {
    console.log('📊 Performance Impact:')
    console.log(`   Requests Dropped: ${status.metrics.requestsDropped}`)
    console.log(`   Features Disabled: ${status.metrics.featuresDisabled.length}`)
    console.log(`   Cache Reductions: ${status.metrics.cacheReductions}`)
    console.log(`   Connections Dropped: ${status.metrics.connectionsDropped}`)
  }
}

async function forceDegradationLevel(level, reason) {
  if (!level) {
    console.error('❌ Usage: force <level> [reason]')
    console.error('   Levels: 1 (Light), 2 (Moderate), 3 (Severe)')
    console.error('   Example: force 2 "High memory usage detected"')
    return
  }
  
  const levelNum = parseInt(level)
  if (isNaN(levelNum) || levelNum < 1 || levelNum > 3) {
    console.error('❌ Invalid level. Must be 1, 2, or 3')
    return
  }
  
  const degradationReason = reason || 'manual-cli'
  
  console.log(`🛡️ Forcing degradation to level ${levelNum}...`)
  console.log(`   Reason: ${degradationReason}`)
  
  forceDegradation(levelNum, degradationReason)
  
  // Wait a moment and show status
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  const status = getDegradationStatus()
  if (status.active && status.level === levelNum) {
    console.log(`✅ Degradation activated successfully`)
    console.log(`   Level: ${status.level} - ${status.levelName}`)
    console.log(`   Actions: ${status.actions.join(', ')}`)
  } else {
    console.log(`❌ Failed to activate degradation level ${levelNum}`)
  }
}

async function recoverFromDegradation(reason) {
  const recoveryReason = reason || 'manual-cli'
  
  console.log(`🛡️ Forcing recovery from degradation...`)
  console.log(`   Reason: ${recoveryReason}`)
  
  forceRecovery(recoveryReason)
  
  // Wait a moment and show status
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  const status = getDegradationStatus()
  if (!status.active) {
    console.log(`✅ Recovery completed successfully`)
    console.log(`   System restored to normal operation`)
  } else {
    console.log(`⚠️ System still in degradation mode`)
    console.log(`   Current level: ${status.level} - ${status.levelName}`)
  }
}

async function triggerEmergency() {
  console.log('🚨 Triggering emergency degradation actions...')
  
  const result = triggerEmergencyActions()
  
  if (result.success) {
    console.log('✅ Emergency actions completed successfully')
    console.log(`   Actions executed: ${result.actions.join(', ')}`)
    console.log(`   Timestamp: ${new Date(result.timestamp).toLocaleString()}`)
    
    // Show updated status
    await new Promise(resolve => setTimeout(resolve, 1000))
    const status = getDegradationStatus()
    console.log('')
    console.log('📊 Updated System Status:')
    console.log(`   Degradation Active: ${status.active ? 'Yes' : 'No'}`)
    if (status.active) {
      console.log(`   Level: ${status.level} - ${status.levelName}`)
    }
  } else {
    console.log('❌ Emergency actions failed')
  }
}

async function testSystem() {
  console.log('🧪 Testing Graceful Degradation System...')
  
  const result = await testDegradationSystem()
  
  console.log(`\n📊 Test Results: ${result.summary.passed}/${result.summary.total} tests passed (${result.summary.successRate}%)`)
  console.log('')
  
  result.tests.forEach(test => {
    const icon = test.success ? '✅' : '❌'
    console.log(`${icon} ${test.name}: ${test.details}`)
  })
  
  if (result.success) {
    console.log('\n🎉 All tests passed! Graceful degradation system is working correctly.')
  } else {
    console.log('\n⚠️ Some tests failed. Please check the degradation system configuration.')
  }
}

function getDuration(startTime) {
  if (!startTime) return 'Unknown'
  
  const now = new Date()
  const start = new Date(startTime)
  const diffMs = now - start
  
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else {
    return `${minutes}m`
  }
}

function showHelp() {
  console.log(`
Graceful Degradation CLI

Commands:
  start                    - Start degradation system with real-time monitoring
  status                   - Show current degradation status
  metrics                  - Show detailed degradation metrics and capabilities
  force <level> [reason]   - Force degradation to specific level (1-3)
  recover [reason]         - Force recovery from degradation
  emergency                - Trigger emergency degradation actions
  test                     - Test degradation system functionality

Examples:
  node scripts/degradation-cli.js start
  node scripts/degradation-cli.js status
  node scripts/degradation-cli.js force 2 "High memory usage"
  node scripts/degradation-cli.js recover "Issue resolved"
  node scripts/degradation-cli.js emergency

Degradation Levels:
  1 - Light Degradation    - Reduce non-essential features, clear low-priority caches
  2 - Moderate Degradation - Load shedding, significant cache reduction, GC trigger
  3 - Severe Degradation   - Emergency mode, only core functionality available

The graceful degradation system provides:
- Automatic degradation based on system metrics (memory, CPU, response time, error rate)
- Load shedding and backpressure management
- Feature toggling for non-essential functionality
- Emergency actions (garbage collection, cache clearing, connection cleanup)
- Automatic recovery when conditions improve
`)
}

main()
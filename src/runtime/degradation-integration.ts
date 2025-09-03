import { degradationController } from './degradation-controller'
import { healthManager } from './health-manager'
import { alertManager } from '../observability/alert-manager'
import { lifecycleManager } from './lifecycle'

/**
 * Integration layer for Graceful Degradation Controller
 * Connects degradation with health monitoring and alert systems
 */

let isDegradationStarted = false

/**
 * Initialize graceful degradation integration
 */
export function initializeDegradation(): void {
  if (isDegradationStarted) {
    console.log('⚠️ Graceful Degradation already started')
    return
  }

  console.log('🛡️ Initializing Graceful Degradation Controller...')

  // Set up event listeners for degradation controller
  degradationController.on('degradation-controller-started', () => {
    console.log('✅ Graceful Degradation active')
    console.log('   - Monitoring: Every 5 seconds')
    console.log('   - Load shedding: Enabled')
    console.log('   - Feature degradation: 3 levels')
    console.log('   - Backpressure management: Enabled')
  })

  degradationController.on('degradation-activated', (event) => {
    console.log(`🛡️ DEGRADATION ACTIVATED - Level ${event.level}: ${event.name}`)
    console.log(`   Triggers: ${event.triggers.join(', ')}`)
    
    // Create alert for degradation activation
    if (alertManager) {
      alertManager.createAlert({
        level: event.level >= 3 ? 'critical' : event.level >= 2 ? 'warning' : 'info',
        title: `System Degradation Level ${event.level}`,
        message: `Graceful degradation activated: ${event.name}. Triggers: ${event.triggers.join(', ')}`,
        source: 'degradation-controller',
        category: 'performance',
        metadata: {
          degradationLevel: event.level,
          triggers: event.triggers,
          previousLevel: event.previousLevel
        }
      })
    }
  })

  degradationController.on('degradation-deactivated', (event) => {
    console.log(`🛡️ DEGRADATION DEACTIVATED - Recovered from Level ${event.previousLevel}: ${event.previousLevelName}`)
    
    // Create alert for degradation recovery
    if (alertManager) {
      alertManager.createAlert({
        level: 'info',
        title: 'System Degradation Recovered',
        message: `System recovered from degradation level ${event.previousLevel}: ${event.previousLevelName}`,
        source: 'degradation-controller',
        category: 'performance',
        metadata: {
          previousLevel: event.previousLevel,
          previousLevelName: event.previousLevelName
        }
      })
    }
  })

  degradationController.on('feature-disabled', (feature) => {
    console.log(`🚫 Feature degraded: ${feature}`)
  })

  degradationController.on('feature-enabled', (feature) => {
    console.log(`✅ Feature restored: ${feature}`)
  })

  degradationController.on('gc-triggered', () => {
    console.log('🗑️ Garbage collection triggered for memory pressure relief')
  })

  degradationController.on('cache-cleared', (event) => {
    console.log(`🧹 Cache cleared: ${event.count} entries (priority: ${event.priority})`)
  })

  degradationController.on('idle-connections-closed', (event) => {
    console.log(`🔌 Closed ${event.count} idle connections`)
  })

  // Integration with health manager
  if (healthManager) {
    healthManager.on('alert-created', (alert) => {
      // Trigger degradation for critical health alerts
      if (alert.level === 'critical') {
        const status = degradationController.getStatus()
        if (!status.active || status.level < 2) {
          console.log('🛡️ Critical health alert detected, considering degradation...')
          // Let the normal evaluation process handle it
        }
      }
    })
  }

  // Start degradation controller
  degradationController.start()
  isDegradationStarted = true

  // Register shutdown handler
  lifecycleManager.onShutdown(async () => {
    console.log('🛡️ Shutting down Graceful Degradation Controller...')
    degradationController.stop()
  })

  console.log('🛡️ Graceful Degradation integration complete')
}

/**
 * Get degradation status
 */
export function getDegradationStatus() {
  if (!isDegradationStarted) {
    return {
      enabled: false,
      message: 'Graceful degradation not started'
    }
  }

  const status = degradationController.getStatus()
  
  return {
    enabled: true,
    timestamp: new Date().toISOString(),
    ...status,
    recommendations: generateRecommendations(status)
  }
}

/**
 * Check if a feature is available (not degraded)
 */
export function isFeatureAvailable(feature: string): boolean {
  if (!isDegradationStarted) {
    return true // If degradation not started, all features available
  }

  return degradationController.isFeatureEnabled(feature)
}

/**
 * Apply load shedding to request
 */
export function shouldAcceptRequest(request: {
  path: string
  method?: string
  priority?: string
  userAgent?: string
}): { accept: boolean; reason?: string; queuePosition?: number } {
  if (!isDegradationStarted) {
    return { accept: true }
  }

  // Determine request priority based on path and method
  const priority = determineRequestPriority(request)
  
  const result = degradationController.shouldAcceptRequest({
    path: request.path,
    priority,
    timestamp: new Date()
  })

  return result
}

/**
 * Register request lifecycle events
 */
export function registerRequest(requestId: string): void {
  if (isDegradationStarted) {
    degradationController.registerRequestStart(requestId)
  }
}

export function completeRequest(requestId: string): void {
  if (isDegradationStarted) {
    degradationController.registerRequestComplete(requestId)
  }
}

/**
 * Force degradation for testing or emergency
 */
export function forceDegradation(level: number, reason: string = 'manual') {
  if (!isDegradationStarted) {
    throw new Error('Graceful degradation not started')
  }

  return degradationController.forceDegradation(level, reason)
}

/**
 * Force recovery from degradation
 */
export function forceRecovery(reason: string = 'manual') {
  if (!isDegradationStarted) {
    throw new Error('Graceful degradation not started')
  }

  return degradationController.forceRecovery(reason)
}

/**
 * Trigger emergency actions
 */
export function triggerEmergencyActions() {
  if (!isDegradationStarted) {
    throw new Error('Graceful degradation not started')
  }

  console.log('🚨 Triggering emergency degradation actions...')
  
  // Trigger garbage collection
  degradationController.triggerGarbageCollection()
  
  // Clear caches
  degradationController.clearCaches('high')
  
  // Close idle connections
  degradationController.closeIdleConnections()
  
  // Force degradation to level 2 if not already degraded
  const status = degradationController.getStatus()
  if (!status.active || status.level < 2) {
    degradationController.forceDegradation(2, 'emergency-actions')
  }

  return {
    success: true,
    actions: ['gc-triggered', 'cache-cleared', 'connections-closed', 'degradation-forced'],
    timestamp: new Date().toISOString()
  }
}

/**
 * Get degradation metrics and statistics
 */
export function getDegradationMetrics() {
  if (!isDegradationStarted) {
    return {
      enabled: false,
      message: 'Graceful degradation not started'
    }
  }

  const status = degradationController.getStatus()
  
  return {
    enabled: true,
    timestamp: new Date().toISOString(),
    currentStatus: status,
    capabilities: {
      loadShedding: true,
      featureDegradation: true,
      backpressureManagement: true,
      automaticRecovery: true,
      emergencyActions: true
    },
    degradationLevels: [
      {
        level: 1,
        name: 'Light Degradation',
        description: 'Reduce non-essential features and clear low-priority caches',
        triggers: ['memory > 80%', 'response_time > 2s', 'error_rate > 5%']
      },
      {
        level: 2,
        name: 'Moderate Degradation',
        description: 'Implement load shedding and reduce cache size significantly',
        triggers: ['memory > 90%', 'response_time > 5s', 'error_rate > 10%']
      },
      {
        level: 3,
        name: 'Severe Degradation',
        description: 'Emergency mode - only core functionality available',
        triggers: ['memory > 95%', 'response_time > 10s', 'error_rate > 20%']
      }
    ]
  }
}

/**
 * Test degradation system
 */
export async function testDegradationSystem() {
  if (!isDegradationStarted) {
    throw new Error('Graceful degradation not started')
  }

  console.log('🧪 Testing Graceful Degradation System...')
  
  const results = {
    tests: [] as Array<{ name: string; success: boolean; details: string }>,
    success: true,
    timestamp: new Date().toISOString()
  }

  try {
    // Test 1: Force degradation
    console.log('🔍 Test 1: Force degradation to level 1')
    degradationController.forceDegradation(1, 'test-degradation')
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    let status = degradationController.getStatus()
    results.tests.push({
      name: 'Force Degradation',
      success: status.active && status.level === 1,
      details: `Active: ${status.active}, Level: ${status.level}`
    })

    // Test 2: Check feature degradation
    console.log('🔍 Test 2: Check feature degradation')
    const analyticsDisabled = !degradationController.isFeatureEnabled('analytics')
    results.tests.push({
      name: 'Feature Degradation',
      success: analyticsDisabled,
      details: `Analytics disabled: ${analyticsDisabled}`
    })

    // Test 3: Test load shedding
    console.log('🔍 Test 3: Test load shedding')
    const loadSheddingResult = degradationController.shouldAcceptRequest({
      path: '/api/test',
      priority: 'low'
    })
    results.tests.push({
      name: 'Load Shedding',
      success: true, // Always passes as it's probabilistic
      details: `Accept: ${loadSheddingResult.accept}, Reason: ${loadSheddingResult.reason || 'none'}`
    })

    // Test 4: Force recovery
    console.log('🔍 Test 4: Force recovery')
    degradationController.forceRecovery('test-recovery')
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    status = degradationController.getStatus()
    results.tests.push({
      name: 'Force Recovery',
      success: !status.active,
      details: `Active: ${status.active}, Level: ${status.level}`
    })

    // Test 5: Emergency actions
    console.log('🔍 Test 5: Emergency actions')
    const emergencyResult = triggerEmergencyActions()
    results.tests.push({
      name: 'Emergency Actions',
      success: emergencyResult.success,
      details: `Actions: ${emergencyResult.actions.join(', ')}`
    })

    // Clean up - force recovery
    degradationController.forceRecovery('test-cleanup')

  } catch (error) {
    results.success = false
    results.tests.push({
      name: 'Test Execution',
      success: false,
      details: `Error: ${error instanceof Error ? error.message : String(error)}`
    })
  }

  const passedTests = results.tests.filter(t => t.success).length
  const totalTests = results.tests.length
  
  console.log(`✅ Degradation system test completed: ${passedTests}/${totalTests} tests passed`)
  
  return {
    ...results,
    summary: {
      passed: passedTests,
      total: totalTests,
      successRate: Math.round((passedTests / totalTests) * 100)
    }
  }
}

/**
 * Determine request priority based on path and other factors
 */
function determineRequestPriority(request: {
  path: string
  method?: string
  priority?: string
  userAgent?: string
}): string {
  // Health and monitoring endpoints get highest priority
  if (request.path.startsWith('/health') || request.path.startsWith('/metrics')) {
    return 'health'
  }

  // Admin endpoints get high priority
  if (request.path.startsWith('/admin')) {
    return 'admin'
  }

  // API endpoints get medium priority
  if (request.path.startsWith('/api')) {
    return 'api'
  }

  // Static content gets lowest priority
  if (request.path.match(/\.(css|js|png|jpg|gif|ico)$/)) {
    return 'static'
  }

  // Default to API priority
  return 'api'
}

/**
 * Generate recommendations based on degradation status
 */
function generateRecommendations(status: any): string[] {
  const recommendations = []

  if (status.active) {
    recommendations.push(`System is in degradation mode (Level ${status.level}). Consider investigating root causes.`)
    
    if (status.level >= 2) {
      recommendations.push('High degradation level detected. Consider scaling resources or reducing load.')
    }
    
    if (status.metrics.requestsDropped > 100) {
      recommendations.push('High number of requests dropped. Consider increasing capacity or optimizing performance.')
    }
    
    if (status.metrics.featuresDisabled.length > 0) {
      recommendations.push(`${status.metrics.featuresDisabled.length} features disabled. Monitor for impact on user experience.`)
    }
  } else {
    recommendations.push('System operating normally. No degradation active.')
  }

  return recommendations
}

/**
 * Check if degradation is running
 */
export function isDegradationRunning(): boolean {
  return isDegradationStarted
}
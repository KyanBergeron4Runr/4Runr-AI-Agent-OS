import { healthManager } from './health-manager'
import { lifecycleManager } from './lifecycle'

/**
 * Integration layer for Health Manager with existing system
 * Provides seamless integration without disrupting current functionality
 */

let isHealthManagerStarted = false

/**
 * Initialize health manager integration
 */
export function initializeHealthManager(): void {
  if (isHealthManagerStarted) {
    console.log('⚠️ Health Manager already started')
    return
  }

  console.log('🏥 Initializing Enhanced Health Manager...')

  // Set up event listeners for health manager
  healthManager.on('started', () => {
    console.log('✅ Health Manager monitoring active')
  })

  healthManager.on('alert-created', (alert) => {
    console.log(`🚨 Health Alert [${alert.level.toUpperCase()}]: ${alert.message}`)
    
    // For critical alerts, consider triggering recovery actions
    if (alert.level === 'critical') {
      console.log('🔧 Critical alert detected - consider implementing recovery actions')
    }
  })

  healthManager.on('alert-resolved', (alert) => {
    console.log(`✅ Health Alert Resolved: ${alert.message}`)
  })

  healthManager.on('shutdown-requested', (reason) => {
    console.log(`🚨 Health Manager requesting shutdown: ${reason}`)
    // Trigger graceful shutdown through lifecycle manager
    process.kill(process.pid, 'SIGTERM')
  })

  healthManager.on('restart-requested', (reason) => {
    console.log(`🚨 Health Manager requesting restart: ${reason}`)
    // In production, this could trigger a container restart
    process.exit(1)
  })

  healthManager.on('resource-metrics', (metrics) => {
    // Log resource metrics periodically (every 5 minutes)
    if (Date.now() % 300000 < 60000) { // Roughly every 5 minutes
      console.log(`📊 Resource Usage - Memory: ${(metrics.memory.heapUsed / 1024 / 1024).toFixed(1)}MB, CPU: ${metrics.cpu.usage.toFixed(1)}%`)
    }
  })

  // Start the health manager
  healthManager.start()
  isHealthManagerStarted = true

  // Register shutdown handler
  lifecycleManager.onShutdown(async () => {
    console.log('🏥 Shutting down Health Manager...')
    healthManager.stop()
  })

  console.log('🏥 Health Manager integration complete')
}

/**
 * Get enhanced health status (combines existing + new health manager)
 */
export async function getEnhancedHealthStatus() {
  const basicHealth = lifecycleManager.getHealthStatus()
  
  if (!isHealthManagerStarted) {
    return {
      ...basicHealth,
      enhanced: false,
      message: 'Enhanced health monitoring not started'
    }
  }

  try {
    const enhancedHealth = await healthManager.getHealthStatus()
    
    return {
      ...basicHealth,
      enhanced: true,
      healthManager: {
        overall: enhancedHealth.overall,
        lastHealthy: enhancedHealth.lastHealthy,
        activeAlerts: enhancedHealth.alerts.length,
        checksCount: Object.keys(enhancedHealth.checks).length,
        resources: enhancedHealth.resources
      }
    }
  } catch (error) {
    return {
      ...basicHealth,
      enhanced: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Add a custom health check to the health manager
 */
export function addHealthCheck(name: string, checkFn: () => Promise<boolean>, options: {
  interval?: number
  timeout?: number
  retries?: number
} = {}) {
  if (!isHealthManagerStarted) {
    console.warn('⚠️ Health Manager not started - cannot add health check')
    return
  }

  healthManager.registerHealthCheck({
    name,
    check: async () => {
      const start = Date.now()
      try {
        const result = await checkFn()
        return {
          healthy: result,
          message: result ? 'OK' : 'Check failed',
          duration: Date.now() - start
        }
      } catch (error) {
        return {
          healthy: false,
          message: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - start
        }
      }
    },
    interval: options.interval || 60000,
    timeout: options.timeout || 5000,
    retries: options.retries || 2,
    successThreshold: 1,
    failureThreshold: 3
  })

  console.log(`📋 Added custom health check: ${name}`)
}

/**
 * Check if health manager is running
 */
export function isHealthManagerRunning(): boolean {
  return isHealthManagerStarted
}
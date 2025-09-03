import { recoveryController } from './recovery-controller'
import { healthManager } from './health-manager'
import { alertManager } from '../observability/alert-manager'
import { lifecycleManager } from './lifecycle'
import { degradationController } from './degradation-controller'

/**
 * Integration layer for Recovery Controller
 * Connects recovery system with health monitoring, alerts, and lifecycle management
 */

let isRecoveryIntegrationStarted = false

/**
 * Initialize recovery controller integration
 */
export function initializeRecoveryIntegration(): void {
  if (isRecoveryIntegrationStarted) {
    console.log('⚠️ Recovery Integration already started')
    return
  }

  console.log('🔧 Initializing Recovery Controller Integration...')

  // Set up event listeners for recovery controller
  recoveryController.on('recovery-controller-started', () => {
    console.log('✅ Recovery Controller monitoring active')
  })

  recoveryController.on('recovery-success', (attempt) => {
    console.log(`✅ Recovery successful: ${attempt.strategyId}`)
    
    // Create success alert
    alertManager.createAlert({
      level: 'info',
      title: 'Recovery Successful',
      message: `Recovery strategy '${attempt.strategyId}' completed successfully`,
      source: 'recovery-controller',
      category: 'recovery',
      metadata: { 
        attemptId: attempt.id,
        strategyId: attempt.strategyId,
        duration: attempt.endTime ? attempt.endTime.getTime() - attempt.startTime.getTime() : 0
      }
    })
  })

  recoveryController.on('recovery-failed', (attempt) => {
    console.log(`❌ Recovery failed: ${attempt.strategyId} - ${attempt.error}`)
    
    // Create failure alert
    alertManager.createAlert({
      level: 'warning',
      title: 'Recovery Failed',
      message: `Recovery strategy '${attempt.strategyId}' failed: ${attempt.error}`,
      source: 'recovery-controller',
      category: 'recovery',
      metadata: { 
        attemptId: attempt.id,
        strategyId: attempt.strategyId,
        error: attempt.error
      }
    })
  })

  recoveryController.on('escalation-required', (reason, attempts) => {
    console.log(`🚨 Recovery escalation required: ${reason}`)
    
    // Create critical alert for escalation
    alertManager.createAlert({
      level: 'critical',
      title: 'Recovery Escalation Required',
      message: `All recovery strategies failed: ${reason}`,
      source: 'recovery-controller',
      category: 'escalation',
      metadata: { 
        reason,
        attemptCount: attempts.length,
        failedStrategies: attempts.map(a => a.strategyId)
      }
    })
    
    // Trigger emergency degradation
    if (degradationController) {
      if (degradationController.enableEmergencyMode) {
        degradationController.enableEmergencyMode('recovery-escalation')
      } else {
        console.warn('DegradationController does not support enableEmergencyMode')
      }
    }
  })

  // Integration with health manager
  if (healthManager) {
    healthManager.on('alert-created', async (alert) => {
      // Trigger recovery for critical health alerts
      if (alert.level === 'critical') {
        console.log(`🔧 Health alert triggered recovery: ${alert.message}`)
        
        try {
          // Determine recovery strategy based on alert type
          let strategyId = 'soft-recovery' // default
          
          if (alert.message.includes('memory') || alert.message.includes('Memory')) {
            strategyId = 'soft-recovery'
          } else if (alert.message.includes('response') || alert.message.includes('timeout')) {
            strategyId = 'medium-recovery'
          } else if (alert.message.includes('unhealthy') || alert.message.includes('unresponsive')) {
            strategyId = 'hard-recovery'
          }
          
          await recoveryController.executeRecovery(
            strategyId, 
            `health-alert: ${alert.message}`,
            { healthAlert: alert }
          )
        } catch (error) {
          console.error(`❌ Failed to execute recovery for health alert: ${error}`)
          
          // Try escalated recovery if single strategy fails
          try {
            await recoveryController.executeEscalatedRecovery(
              `health-alert-escalation: ${alert.message}`,
              { healthAlert: alert }
            )
          } catch (escalationError) {
            console.error(`❌ Escalated recovery also failed: ${escalationError}`)
          }
        }
      }
    })

    healthManager.on('shutdown-requested', async (reason) => {
      console.log(`🔧 Health manager shutdown triggered recovery: ${reason}`)
      
      try {
        // Try hard recovery before shutdown
        await recoveryController.executeRecovery(
          'hard-recovery',
          `shutdown-prevention: ${reason}`,
          { shutdownReason: reason }
        )
      } catch (error) {
        console.log(`❌ Recovery failed, proceeding with shutdown: ${error}`)
      }
    })

    healthManager.on('restart-requested', async (reason) => {
      console.log(`🔧 Health manager restart triggered recovery: ${reason}`)
      
      try {
        // Execute service restart recovery
        await recoveryController.executeRecovery(
          'hard-recovery',
          `restart-request: ${reason}`,
          { restartReason: reason }
        )
      } catch (error) {
        console.error(`❌ Recovery restart failed: ${error}`)
      }
    })
  }

  // Integration with alert manager
  alertManager.on('alert-created', async (alert) => {
    // Trigger recovery for system-level critical alerts
    if (alert.level === 'critical' && alert.category === 'system') {
      console.log(`🔧 System alert triggered recovery: ${alert.title}`)
      
      try {
        await recoveryController.executeRecovery(
          'medium-recovery',
          `system-alert: ${alert.title}`,
          { systemAlert: alert }
        )
      } catch (error) {
        console.error(`❌ Failed to execute recovery for system alert: ${error}`)
      }
    }
  })

  // Start the recovery controller
  recoveryController.start()
  isRecoveryIntegrationStarted = true

  // Register shutdown handler
  lifecycleManager.onShutdown(async () => {
    console.log('🔧 Shutting down Recovery Controller...')
    await recoveryController.stop()
  })

  console.log('🔧 Recovery Controller integration complete')
}

/**
 * Manually trigger recovery
 */
export async function triggerRecovery(strategyId: string, reason: string, context?: Record<string, any>) {
  // Auto-initialize if not started
  if (!isRecoveryIntegrationStarted) {
    initializeRecoveryIntegration()
  }
  
  return await recoveryController.executeRecovery(strategyId, reason, context)
}

/**
 * Manually trigger escalated recovery
 */
export async function triggerEscalatedRecovery(reason: string, context?: Record<string, any>) {
  // Auto-initialize if not started
  if (!isRecoveryIntegrationStarted) {
    initializeRecoveryIntegration()
  }
  
  return await recoveryController.executeEscalatedRecovery(reason, context)
}

/**
 * Get recovery status and statistics
 */
export function getRecoveryStatus() {
  // Auto-initialize if not started
  if (!isRecoveryIntegrationStarted) {
    initializeRecoveryIntegration()
  }

  const stats = recoveryController.getRecoveryStatistics()
  const activeAttempts = recoveryController.getActiveAttempts()
  
  return {
    enabled: true,
    statistics: stats,
    activeAttempts: activeAttempts.length,
    recentHistory: recoveryController.getRecoveryHistory(10)
  }
}

/**
 * Add custom recovery strategy
 */
export function addCustomRecoveryStrategy(strategy: any) {
  return recoveryController.addRecoveryStrategy(strategy)
}

/**
 * Get available recovery strategies
 */
export function getRecoveryStrategies() {
  // Access private strategies through public interface if available
  // For now, return the default strategy names
  return [
    'soft-recovery',
    'medium-recovery', 
    'hard-recovery',
    'emergency-recovery'
  ]
}
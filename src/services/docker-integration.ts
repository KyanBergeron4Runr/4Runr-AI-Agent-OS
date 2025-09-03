import { dockerContainerManager } from './docker-container-manager'
import { dockerRecoveryManager } from './docker-recovery-manager'
import { alertManager } from '../observability/alert-manager'
import { lifecycleManager } from '../runtime/lifecycle'
import { healthManager } from '../runtime/health-manager'

/**
 * Integration layer for Docker Container Management
 * Connects Docker services with the existing monitoring and alerting infrastructure
 */

let isDockerIntegrationStarted = false

/**
 * Initialize Docker container management integration
 */
export function initializeDockerIntegration(): void {
  if (isDockerIntegrationStarted) {
    console.log('⚠️ Docker Integration already started')
    return
  }

  console.log('🐳 Initializing Docker Container Management Integration...')

  // Set up container manager event listeners
  dockerContainerManager.on('manager-started', () => {
    console.log('✅ Docker Container Manager active')
  })

  dockerContainerManager.on('containers-discovered', (containers) => {
    console.log(`📦 Discovered ${containers.length} Docker containers`)
    
    // Create info alert for container discovery
    alertManager.createAlert({
      level: 'info',
      title: 'Container Discovery Complete',
      message: `Discovered ${containers.length} Docker containers`,
      source: 'docker-manager',
      category: 'container',
      metadata: { containerCount: containers.length }
    })
  })

  dockerContainerManager.on('health-check-failed', (healthCheck) => {
    console.log(`🚨 Container health check failed: ${healthCheck.containerName}`)
    
    // Create warning alert for health check failures
    alertManager.createAlert({
      level: 'warning',
      title: 'Container Health Check Failed',
      message: `Container ${healthCheck.containerName} health check failed (${healthCheck.failingStreak} consecutive failures)`,
      source: 'docker-manager',
      category: 'container',
      metadata: { 
        containerId: healthCheck.containerId,
        containerName: healthCheck.containerName,
        failingStreak: healthCheck.failingStreak,
        status: healthCheck.status
      }
    })
  })

  dockerContainerManager.on('container-failed', (container, attempts) => {
    console.log(`🚨 Container completely failed: ${container.name}`)
    
    // Create critical alert for container failures
    alertManager.createAlert({
      level: 'critical',
      title: 'Container Failed',
      message: `Container ${container.name} has failed after ${attempts} restart attempts`,
      source: 'docker-manager',
      category: 'container',
      metadata: { 
        containerId: container.id,
        containerName: container.name,
        restartAttempts: attempts,
        status: container.status
      }
    })
  })

  dockerContainerManager.on('container-restarted', (container, attempts) => {
    console.log(`✅ Container successfully restarted: ${container.name}`)
    
    // Create info alert for successful restarts
    alertManager.createAlert({
      level: 'info',
      title: 'Container Restarted',
      message: `Container ${container.name} successfully restarted after ${attempts} attempts`,
      source: 'docker-manager',
      category: 'container',
      metadata: { 
        containerId: container.id,
        containerName: container.name,
        restartAttempts: attempts
      }
    })
  })

  dockerContainerManager.on('stats-collected', (stats) => {
    // Check for resource alerts
    if (stats.memoryPercent > 90) {
      alertManager.createAlert({
        level: 'warning',
        title: 'High Container Memory Usage',
        message: `Container ${stats.containerName} memory usage: ${stats.memoryPercent.toFixed(1)}%`,
        source: 'docker-manager',
        category: 'resource',
        metadata: { 
          containerId: stats.containerId,
          containerName: stats.containerName,
          memoryPercent: stats.memoryPercent,
          memoryUsage: stats.memoryUsage,
          memoryLimit: stats.memoryLimit
        }
      })
    }

    if (stats.cpuPercent > 95) {
      alertManager.createAlert({
        level: 'warning',
        title: 'High Container CPU Usage',
        message: `Container ${stats.containerName} CPU usage: ${stats.cpuPercent.toFixed(1)}%`,
        source: 'docker-manager',
        category: 'resource',
        metadata: { 
          containerId: stats.containerId,
          containerName: stats.containerName,
          cpuPercent: stats.cpuPercent
        }
      })
    }
  })

  // Set up recovery manager event listeners
  dockerRecoveryManager.on('recovery-manager-started', () => {
    console.log('✅ Docker Recovery Manager active')
  })

  dockerRecoveryManager.on('recovery-started', (attempt) => {
    console.log(`🔧 Container recovery started: ${attempt.containerName}`)
    
    alertManager.createAlert({
      level: 'info',
      title: 'Container Recovery Started',
      message: `Recovery started for container ${attempt.containerName} using strategy: ${attempt.strategyId}`,
      source: 'docker-recovery',
      category: 'recovery',
      metadata: { 
        attemptId: attempt.id,
        containerId: attempt.containerId,
        containerName: attempt.containerName,
        strategyId: attempt.strategyId
      }
    })
  })

  dockerRecoveryManager.on('recovery-success', (attempt) => {
    console.log(`✅ Container recovery successful: ${attempt.containerName}`)
    
    alertManager.createAlert({
      level: 'info',
      title: 'Container Recovery Successful',
      message: `Container ${attempt.containerName} recovered successfully`,
      source: 'docker-recovery',
      category: 'recovery',
      metadata: { 
        attemptId: attempt.id,
        containerId: attempt.containerId,
        containerName: attempt.containerName,
        strategyId: attempt.strategyId,
        duration: attempt.endTime ? attempt.endTime.getTime() - attempt.startTime.getTime() : 0
      }
    })
  })

  dockerRecoveryManager.on('recovery-failed', (attempt) => {
    console.log(`❌ Container recovery failed: ${attempt.containerName}`)
    
    alertManager.createAlert({
      level: 'warning',
      title: 'Container Recovery Failed',
      message: `Recovery failed for container ${attempt.containerName}: ${attempt.error}`,
      source: 'docker-recovery',
      category: 'recovery',
      metadata: { 
        attemptId: attempt.id,
        containerId: attempt.containerId,
        containerName: attempt.containerName,
        strategyId: attempt.strategyId,
        error: attempt.error
      }
    })
  })

  dockerRecoveryManager.on('recovery-escalation-needed', (container, error) => {
    console.log(`🚨 Container recovery escalation needed: ${container.name}`)
    
    alertManager.createAlert({
      level: 'critical',
      title: 'Container Recovery Escalation Required',
      message: `Container ${container.name} requires manual intervention: ${error}`,
      source: 'docker-recovery',
      category: 'escalation',
      metadata: { 
        containerId: container.id,
        containerName: container.name,
        error: error instanceof Error ? error.message : String(error)
      }
    })
  })

  dockerRecoveryManager.on('operator-notification', (notification) => {
    console.log(`📢 Operator notification for container: ${notification.containerId}`)
    
    alertManager.createAlert({
      level: 'critical',
      title: 'Operator Intervention Required',
      message: `Manual intervention required for container recovery`,
      source: 'docker-recovery',
      category: 'operator',
      metadata: notification
    })
  })

  dockerRecoveryManager.on('logs-collected', (containerId, logs) => {
    console.log(`📋 Collected ${logs.length} log entries for container: ${containerId}`)
  })

  // Integration with health manager
  if (healthManager) {
    healthManager.registerHealthCheck('docker-containers', async () => {
      const status = dockerContainerManager.getManagerStatus()
      
      return {
        ok: status.isMonitoring && status.unhealthyContainers === 0,
        details: {
          monitoring: status.isMonitoring,
          totalContainers: status.containerCount,
          runningContainers: status.runningContainers,
          healthyContainers: status.healthyContainers,
          unhealthyContainers: status.unhealthyContainers,
          restartAttempts: status.restartAttempts
        }
      }
    })

    healthManager.registerHealthCheck('docker-recovery', async () => {
      const stats = dockerRecoveryManager.getRecoveryStatistics(1) // Last hour
      
      return {
        ok: stats.successRate >= 80 || stats.totalAttempts === 0,
        details: {
          totalAttempts: stats.totalAttempts,
          successRate: stats.successRate,
          averageRecoveryTime: stats.averageRecoveryTime,
          recentFailures: stats.failedAttempts
        }
      }
    })
  }

  // Start Docker services
  dockerContainerManager.start()
  dockerRecoveryManager.start()
  
  isDockerIntegrationStarted = true

  // Register shutdown handler
  lifecycleManager.onShutdown(async () => {
    console.log('🐳 Shutting down Docker Container Management...')
    await dockerRecoveryManager.stop()
    await dockerContainerManager.stop()
  })

  console.log('🐳 Docker Container Management integration complete')
}

/**
 * Get Docker container status
 */
export function getDockerContainerStatus() {
  if (!isDockerIntegrationStarted) {
    return {
      enabled: false,
      message: 'Docker integration not started'
    }
  }

  const managerStatus = dockerContainerManager.getManagerStatus()
  const recoveryStats = dockerRecoveryManager.getRecoveryStatistics()
  
  return {
    enabled: true,
    containerManager: managerStatus,
    recoveryManager: {
      totalAttempts: recoveryStats.totalAttempts,
      successRate: recoveryStats.successRate,
      averageRecoveryTime: recoveryStats.averageRecoveryTime
    },
    containers: dockerContainerManager.getAllContainers().map(container => ({
      id: container.id,
      name: container.name,
      status: container.status,
      health: container.health,
      uptime: container.uptime,
      restartCount: container.restartCount
    }))
  }
}

/**
 * Get container logs
 */
export async function getContainerLogs(containerId: string, lines: number = 100) {
  if (!isDockerIntegrationStarted) {
    throw new Error('Docker integration not started')
  }
  
  return await dockerRecoveryManager.collectContainerLogs(containerId)
}

/**
 * Trigger manual container recovery
 */
export async function triggerContainerRecovery(containerId: string, strategyId?: string) {
  if (!isDockerIntegrationStarted) {
    throw new Error('Docker integration not started')
  }
  
  return await dockerRecoveryManager.executeRecovery(containerId, strategyId)
}

/**
 * Get container performance metrics
 */
export async function getContainerPerformance(containerId: string) {
  if (!isDockerIntegrationStarted) {
    throw new Error('Docker integration not started')
  }
  
  return await dockerRecoveryManager.monitorContainerPerformance(containerId)
}
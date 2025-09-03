import { alertManager, AlertContext } from './alert-manager'
import { healthManager } from '../runtime/health-manager'
import { multiLevelMonitor } from './multi-level-monitor'
import { lifecycleManager } from '../runtime/lifecycle'

/**
 * Integration layer for Alert Management System
 * Connects alerts with health manager and multi-level monitoring
 */

let isAlertingStarted = false
let contextUpdateTimer: NodeJS.Timeout | null = null

/**
 * Initialize alert management integration
 */
export function initializeAlerting(): void {
  if (isAlertingStarted) {
    console.log('⚠️ Alert Management already started')
    return
  }

  console.log('🚨 Initializing Enhanced Alert Management System...')

  // Set up event listeners for alert manager
  alertManager.on('alert-manager-started', () => {
    console.log('✅ Alert Management active')
    console.log('   - Alert evaluation: Every 30 seconds')
    console.log('   - Correlation detection: Automatic')
    console.log('   - Automated responses: Enabled')
    console.log('   - Alert suppression: Intelligent')
  })

  alertManager.on('alert-created', (alert) => {
    const icon = getAlertIcon(alert.level)
    console.log(`${icon} ALERT [${alert.level.toUpperCase()}]: ${alert.title}`)
    if (alert.level === 'critical') {
      console.log(`   🚨 CRITICAL ALERT: ${alert.message}`)
    }
  })

  alertManager.on('alert-resolved', (alert) => {
    console.log(`✅ Alert resolved: ${alert.title} (resolved by: ${alert.resolvedBy})`)
  })

  alertManager.on('alert-escalated', (alert, escalationRule) => {
    console.log(`⬆️ Alert escalated to ${escalationRule.escalateTo}: ${alert.title}`)
    if (escalationRule.autoActions?.length) {
      console.log(`   🤖 Triggering automated actions: ${escalationRule.autoActions.join(', ')}`)
    }
  })

  alertManager.on('correlation-resolved', (correlation) => {
    console.log(`🔗 Alert correlation resolved: ${correlation.description}`)
  })

  alertManager.on('automated-response', (response) => {
    const status = response.result === 'success' ? '✅' : response.result === 'failure' ? '❌' : '⏳'
    console.log(`${status} Automated response: ${response.action} - ${response.result}`)
  })

  // Set up integration with health manager
  if (healthManager) {
    healthManager.on('alert-created', (alert) => {
      // Forward health manager alerts to alert manager
      alertManager.createAlert({
        level: alert.level === 'critical' ? 'critical' : 'warning',
        title: 'Health Manager Alert',
        message: alert.message,
        source: 'health-manager',
        category: 'health',
        metadata: { originalAlert: alert }
      })
    })

    healthManager.on('shutdown-requested', (reason) => {
      // Create critical alert for shutdown requests
      alertManager.createAlert({
        level: 'critical',
        title: 'System Shutdown Requested',
        message: `Health manager requesting shutdown: ${reason}`,
        source: 'health-manager',
        category: 'system',
        metadata: { shutdownReason: reason }
      })
    })
  }

  // Set up integration with multi-level monitor
  if (multiLevelMonitor) {
    multiLevelMonitor.on('collection-failed', (level, error) => {
      alertManager.createAlert({
        level: 'warning',
        title: `${level} Monitoring Failed`,
        message: `Failed to collect ${level} metrics: ${error?.message}`,
        source: 'multi-level-monitor',
        category: 'monitoring',
        metadata: { level, error: error?.message }
      })
    })
  }

  // Start alert manager
  alertManager.start()
  
  // Start context updates
  startContextUpdates()
  
  isAlertingStarted = true

  // Register shutdown handler
  lifecycleManager.onShutdown(async () => {
    console.log('🚨 Shutting down Alert Management...')
    if (contextUpdateTimer) {
      clearInterval(contextUpdateTimer)
    }
    await alertManager.stop()
  })

  console.log('🚨 Alert Management integration complete')
}

/**
 * Create a manual alert
 */
export async function createManualAlert(options: {
  level: 'info' | 'warning' | 'critical'
  title: string
  message: string
  category: string
  metadata?: Record<string, any>
}) {
  if (!isAlertingStarted) {
    throw new Error('Alert management not started')
  }

  return await alertManager.createAlert({
    level: options.level,
    title: options.title,
    message: options.message,
    source: 'manual',
    category: options.category,
    metadata: options.metadata
  })
}

/**
 * Get alert dashboard data
 */
export async function getAlertDashboard() {
  if (!isAlertingStarted) {
    return {
      enabled: false,
      message: 'Alert management not started'
    }
  }

  const activeAlerts = alertManager.getActiveAlerts()
  const stats = alertManager.getAlertStatistics(24)
  const correlations = alertManager.getCorrelations()

  // Group active alerts by level
  const alertsByLevel = {
    critical: activeAlerts.filter(a => a.level === 'critical'),
    warning: activeAlerts.filter(a => a.level === 'warning'),
    info: activeAlerts.filter(a => a.level === 'info')
  }

  // Get recent alert history
  const recentAlerts = alertManager.getAlertHistory({ limit: 10 })

  return {
    enabled: true,
    timestamp: new Date().toISOString(),
    summary: {
      activeAlerts: activeAlerts.length,
      criticalAlerts: alertsByLevel.critical.length,
      warningAlerts: alertsByLevel.warning.length,
      infoAlerts: alertsByLevel.info.length,
      activeCorrelations: correlations.filter(c => !c.endTime).length
    },
    statistics: stats,
    activeAlerts: {
      critical: alertsByLevel.critical.map(formatAlertForDashboard),
      warning: alertsByLevel.warning.map(formatAlertForDashboard),
      info: alertsByLevel.info.map(formatAlertForDashboard)
    },
    recentAlerts: recentAlerts.map(formatAlertForDashboard),
    correlations: correlations.map(formatCorrelationForDashboard)
  }
}

/**
 * Get alert statistics
 */
export async function getAlertStatistics(hours: number = 24) {
  if (!isAlertingStarted) {
    return {
      enabled: false,
      message: 'Alert management not started'
    }
  }

  const stats = alertManager.getAlertStatistics(hours)
  const activeAlerts = alertManager.getActiveAlerts()

  return {
    enabled: true,
    period: `${hours} hours`,
    timestamp: new Date().toISOString(),
    ...stats,
    currentlyActive: {
      total: activeAlerts.length,
      critical: activeAlerts.filter(a => a.level === 'critical').length,
      warning: activeAlerts.filter(a => a.level === 'warning').length,
      info: activeAlerts.filter(a => a.level === 'info').length
    }
  }
}

/**
 * Resolve an alert
 */
export async function resolveAlert(alertId: string, resolvedBy: string = 'user') {
  if (!isAlertingStarted) {
    throw new Error('Alert management not started')
  }

  return await alertManager.resolveAlert(alertId, resolvedBy)
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: string, acknowledgedBy: string) {
  if (!isAlertingStarted) {
    throw new Error('Alert management not started')
  }

  return await alertManager.acknowledgeAlert(alertId, acknowledgedBy)
}

/**
 * Get alert history
 */
export async function getAlertHistory(options: {
  limit?: number
  level?: 'info' | 'warning' | 'critical'
  category?: string
  hours?: number
} = {}) {
  if (!isAlertingStarted) {
    throw new Error('Alert management not started')
  }

  const { hours = 24, ...otherOptions } = options
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)

  return alertManager.getAlertHistory({
    ...otherOptions,
    startTime
  }).map(formatAlertForDashboard)
}

/**
 * Test alert system
 */
export async function testAlertSystem() {
  if (!isAlertingStarted) {
    throw new Error('Alert management not started')
  }

  console.log('🧪 Testing Alert System...')

  // Create test alerts
  const testAlerts = [
    {
      level: 'info' as const,
      title: 'Test Info Alert',
      message: 'This is a test info alert',
      category: 'test'
    },
    {
      level: 'warning' as const,
      title: 'Test Warning Alert',
      message: 'This is a test warning alert',
      category: 'test'
    },
    {
      level: 'critical' as const,
      title: 'Test Critical Alert',
      message: 'This is a test critical alert',
      category: 'test'
    }
  ]

  const createdAlerts = []
  for (const alertData of testAlerts) {
    const alert = await createManualAlert(alertData)
    createdAlerts.push(alert)
  }

  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Resolve test alerts
  for (const alert of createdAlerts) {
    await resolveAlert(alert.id, 'test-system')
  }

  console.log('✅ Alert system test completed')
  
  return {
    success: true,
    alertsCreated: createdAlerts.length,
    alertsResolved: createdAlerts.length
  }
}

/**
 * Start context updates for alert evaluation
 */
function startContextUpdates(): void {
  contextUpdateTimer = setInterval(async () => {
    if (!isAlertingStarted) return

    try {
      // Gather context from various sources
      const context = await gatherAlertContext()
      
      // Evaluate alerts with current context
      await alertManager.evaluateAlerts(context)
    } catch (error) {
      console.error('Error updating alert context:', error)
    }
  }, 30000) // Every 30 seconds
}

/**
 * Gather alert context from monitoring systems
 */
async function gatherAlertContext(): Promise<AlertContext> {
  const context: AlertContext = {
    metrics: {},
    healthStatus: {},
    systemMetrics: {},
    dockerMetrics: {},
    infrastructureMetrics: {},
    recentAlerts: alertManager.getAlertHistory({ limit: 10 }),
    timestamp: new Date()
  }

  try {
    // Get health status from health manager
    if (healthManager) {
      context.healthStatus = await healthManager.getHealthStatus()
    }
  } catch (error) {
    console.warn('Failed to get health status for alert context:', error)
  }

  try {
    // Get recent monitoring data
    if (multiLevelMonitor) {
      const [systemData, dockerData, infraData] = await Promise.all([
        multiLevelMonitor.getRecentData('system', 1),
        multiLevelMonitor.getRecentData('docker', 1),
        multiLevelMonitor.getRecentData('infrastructure', 1)
      ])

      if (systemData[0]?.success) {
        context.systemMetrics = systemData[0].data
      }

      if (dockerData[0]?.success) {
        context.dockerMetrics = dockerData[0].data
      }

      if (infraData[0]?.success) {
        context.infrastructureMetrics = infraData[0].data
      }
    }
  } catch (error) {
    console.warn('Failed to get monitoring data for alert context:', error)
  }

  return context
}

/**
 * Format alert for dashboard display
 */
function formatAlertForDashboard(alert: any) {
  return {
    id: alert.id,
    level: alert.level,
    title: alert.title,
    message: alert.message,
    source: alert.source,
    category: alert.category,
    timestamp: alert.timestamp,
    resolved: alert.resolved,
    resolvedAt: alert.resolvedAt,
    resolvedBy: alert.resolvedBy,
    acknowledgedBy: alert.acknowledgedBy,
    acknowledgedAt: alert.acknowledgedAt,
    escalationLevel: alert.escalationLevel,
    correlationId: alert.correlationId
  }
}

/**
 * Format correlation for dashboard display
 */
function formatCorrelationForDashboard(correlation: any) {
  return {
    id: correlation.id,
    alertCount: correlation.alerts.length,
    category: correlation.category,
    severity: correlation.severity,
    startTime: correlation.startTime,
    endTime: correlation.endTime,
    description: correlation.description,
    resolved: !!correlation.endTime
  }
}

/**
 * Get alert icon for display
 */
function getAlertIcon(level: string): string {
  switch (level) {
    case 'critical': return '🚨'
    case 'warning': return '⚠️'
    case 'info': return 'ℹ️'
    default: return '📢'
  }
}

/**
 * Check if alerting is running
 */
export function isAlertingRunning(): boolean {
  return isAlertingStarted
}
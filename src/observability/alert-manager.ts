import { EventEmitter } from 'events'
import { promises as fs } from 'fs'
import { join } from 'path'

export interface Alert {
  id: string
  level: 'info' | 'warning' | 'critical'
  title: string
  message: string
  source: string
  category: string
  timestamp: Date
  resolved: boolean
  resolvedAt?: Date
  resolvedBy?: string
  metadata?: Record<string, any>
  correlationId?: string
  suppressUntil?: Date
  escalationLevel: number
  escalatedAt?: Date[]
  acknowledgedBy?: string
  acknowledgedAt?: Date
}

export interface AlertRule {
  id: string
  name: string
  description: string
  condition: (context: AlertContext) => boolean
  level: Alert['level']
  category: string
  cooldownMs: number
  escalationRules?: EscalationRule[]
  autoResolve?: boolean
  autoResolveCondition?: (context: AlertContext) => boolean
  suppressionRules?: SuppressionRule[]
}

export interface EscalationRule {
  afterMinutes: number
  escalateTo: Alert['level']
  notifyChannels: string[]
  autoActions?: string[]
}

export interface SuppressionRule {
  condition: (alert: Alert, existingAlerts: Alert[]) => boolean
  durationMs: number
  reason: string
}

export interface AlertContext {
  metrics: Record<string, any>
  healthStatus: any
  systemMetrics: any
  dockerMetrics: any
  infrastructureMetrics: any
  recentAlerts: Alert[]
  timestamp: Date
}

export interface AlertCorrelation {
  id: string
  alerts: Alert[]
  rootCause?: Alert
  category: string
  severity: Alert['level']
  startTime: Date
  endTime?: Date
  description: string
}

export interface AlertResponse {
  id: string
  alertId: string
  action: string
  result: 'success' | 'failure' | 'pending'
  timestamp: Date
  details?: any
  error?: string
}

/**
 * Enhanced Alert Management System
 * Provides intelligent alerting with correlation, suppression, and automated responses
 */
export class AlertManager extends EventEmitter {
  private alerts: Map<string, Alert> = new Map()
  private alertRules: Map<string, AlertRule> = new Map()
  private correlations: Map<string, AlertCorrelation> = new Map()
  private responses: Map<string, AlertResponse> = new Map()
  private alertHistory: Alert[] = []
  private isRunning: boolean = false
  private evaluationTimer: NodeJS.Timeout | null = null
  private storageDir: string
  private maxHistorySize: number = 1000
  private evaluationInterval: number = 30000 // 30 seconds

  constructor(options: {
    storageDir?: string
    maxHistorySize?: number
    evaluationInterval?: number
  } = {}) {
    super()
    
    this.storageDir = options.storageDir || 'logs/alerts'
    this.maxHistorySize = options.maxHistorySize || 1000
    this.evaluationInterval = options.evaluationInterval || 30000
    
    this.setupDefaultRules()
  }

  /**
   * Start alert management
   */
  async start(): Promise<void> {
    if (this.isRunning) return

    console.log('🚨 Starting Enhanced Alert Management System...')
    
    // Ensure storage directory exists
    await fs.mkdir(this.storageDir, { recursive: true })
    
    // Load existing alerts and rules
    await this.loadPersistedData()
    
    this.isRunning = true
    
    // Start alert evaluation loop
    this.startAlertEvaluation()
    
    console.log('✅ Enhanced Alert Management System started')
    this.emit('alert-manager-started')
  }

  /**
   * Stop alert management
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return

    this.isRunning = false
    
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer)
      this.evaluationTimer = null
    }
    
    // Persist current state
    await this.persistData()
    
    console.log('🛑 Enhanced Alert Management System stopped')
    this.emit('alert-manager-stopped')
  }

  /**
   * Create a new alert
   */
  async createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'resolved' | 'escalationLevel'>): Promise<Alert> {
    const alert: Alert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      resolved: false,
      escalationLevel: 0,
      ...alertData
    }

    // Check for suppression
    if (await this.shouldSuppressAlert(alert)) {
      console.log(`🔇 Alert suppressed: ${alert.title}`)
      return alert
    }

    // Check for correlation
    const correlationId = await this.findCorrelation(alert)
    if (correlationId) {
      alert.correlationId = correlationId
    }

    // Store alert
    this.alerts.set(alert.id, alert)
    this.alertHistory.push(alert)
    
    // Trim history if needed
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory.shift()
    }

    // Persist alert
    await this.persistAlert(alert)

    console.log(`🚨 Alert created [${alert.level.toUpperCase()}]: ${alert.title}`)
    this.emit('alert-created', alert)

    // Trigger automated responses
    await this.triggerAutomatedResponses(alert)

    return alert
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy: string = 'system'): Promise<boolean> {
    const alert = this.alerts.get(alertId)
    if (!alert || alert.resolved) {
      return false
    }

    alert.resolved = true
    alert.resolvedAt = new Date()
    alert.resolvedBy = resolvedBy

    // Update correlation if exists
    if (alert.correlationId) {
      await this.updateCorrelation(alert.correlationId)
    }

    await this.persistAlert(alert)

    console.log(`✅ Alert resolved: ${alert.title}`)
    this.emit('alert-resolved', alert)

    return true
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    const alert = this.alerts.get(alertId)
    if (!alert || alert.resolved) {
      return false
    }

    alert.acknowledgedBy = acknowledgedBy
    alert.acknowledgedAt = new Date()

    await this.persistAlert(alert)

    console.log(`👍 Alert acknowledged by ${acknowledgedBy}: ${alert.title}`)
    this.emit('alert-acknowledged', alert)

    return true
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule)
    console.log(`📋 Alert rule added: ${rule.name}`)
    this.emit('rule-added', rule)
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId)
    if (removed) {
      console.log(`🗑️ Alert rule removed: ${ruleId}`)
      this.emit('rule-removed', ruleId)
    }
    return removed
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(level?: Alert['level']): Alert[] {
    const activeAlerts = Array.from(this.alerts.values()).filter(alert => !alert.resolved)
    
    if (level) {
      return activeAlerts.filter(alert => alert.level === level)
    }
    
    return activeAlerts
  }

  /**
   * Get alert history
   */
  getAlertHistory(options: {
    limit?: number
    level?: Alert['level']
    category?: string
    startTime?: Date
    endTime?: Date
  } = {}): Alert[] {
    let filtered = [...this.alertHistory]

    if (options.level) {
      filtered = filtered.filter(alert => alert.level === options.level)
    }

    if (options.category) {
      filtered = filtered.filter(alert => alert.category === options.category)
    }

    if (options.startTime) {
      filtered = filtered.filter(alert => alert.timestamp >= options.startTime!)
    }

    if (options.endTime) {
      filtered = filtered.filter(alert => alert.timestamp <= options.endTime!)
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    if (options.limit) {
      filtered = filtered.slice(0, options.limit)
    }

    return filtered
  }

  /**
   * Get alert correlations
   */
  getCorrelations(): AlertCorrelation[] {
    return Array.from(this.correlations.values())
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics(hours: number = 24): {
    total: number
    byLevel: Record<Alert['level'], number>
    byCategory: Record<string, number>
    resolved: number
    acknowledged: number
    escalated: number
    suppressed: number
  } {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)
    const recentAlerts = this.alertHistory.filter(alert => alert.timestamp >= since)

    const stats = {
      total: recentAlerts.length,
      byLevel: { info: 0, warning: 0, critical: 0 } as Record<Alert['level'], number>,
      byCategory: {} as Record<string, number>,
      resolved: 0,
      acknowledged: 0,
      escalated: 0,
      suppressed: 0
    }

    for (const alert of recentAlerts) {
      stats.byLevel[alert.level]++
      stats.byCategory[alert.category] = (stats.byCategory[alert.category] || 0) + 1
      
      if (alert.resolved) stats.resolved++
      if (alert.acknowledgedBy) stats.acknowledged++
      if (alert.escalationLevel > 0) stats.escalated++
      if (alert.suppressUntil) stats.suppressed++
    }

    return stats
  }

  /**
   * Evaluate alert rules against current context
   */
  async evaluateAlerts(context: AlertContext): Promise<void> {
    for (const rule of this.alertRules.values()) {
      try {
        // Check if rule condition is met
        if (rule.condition(context)) {
          // Check cooldown
          if (await this.isInCooldown(rule)) {
            continue
          }

          // Create alert
          await this.createAlert({
            level: rule.level,
            title: rule.name,
            message: rule.description,
            source: 'alert-rule',
            category: rule.category,
            metadata: {
              ruleId: rule.id,
              context: this.sanitizeContext(context)
            }
          })

          // Set cooldown
          await this.setCooldown(rule)
        } else if (rule.autoResolve && rule.autoResolveCondition) {
          // Check for auto-resolution
          if (rule.autoResolveCondition(context)) {
            await this.autoResolveRuleAlerts(rule.id)
          }
        }
      } catch (error) {
        console.error(`Error evaluating alert rule ${rule.id}:`, error)
      }
    }
  }

  /**
   * Setup default alert rules
   */
  private setupDefaultRules(): void {
    // High memory usage alert
    this.addAlertRule({
      id: 'high-memory-usage',
      name: 'High Memory Usage',
      description: 'System memory usage is critically high',
      condition: (context) => {
        const memUsage = context.systemMetrics?.memory?.used || 0
        const memTotal = context.systemMetrics?.memory?.total || 1
        return (memUsage / memTotal) > 0.9
      },
      level: 'critical',
      category: 'system',
      cooldownMs: 300000, // 5 minutes
      escalationRules: [{
        afterMinutes: 10,
        escalateTo: 'critical',
        notifyChannels: ['ops-team'],
        autoActions: ['restart-application']
      }],
      autoResolve: true,
      autoResolveCondition: (context) => {
        const memUsage = context.systemMetrics?.memory?.used || 0
        const memTotal = context.systemMetrics?.memory?.total || 1
        return (memUsage / memTotal) < 0.8
      }
    })

    // Application unresponsive alert
    this.addAlertRule({
      id: 'application-unresponsive',
      name: 'Application Unresponsive',
      description: 'Application is not responding to health checks',
      condition: (context) => {
        return context.healthStatus?.overall === 'unhealthy'
      },
      level: 'critical',
      category: 'application',
      cooldownMs: 60000, // 1 minute
      escalationRules: [{
        afterMinutes: 5,
        escalateTo: 'critical',
        notifyChannels: ['dev-team', 'ops-team'],
        autoActions: ['restart-application']
      }],
      autoResolve: true,
      autoResolveCondition: (context) => {
        return context.healthStatus?.overall === 'healthy'
      }
    })

    // High error rate alert
    this.addAlertRule({
      id: 'high-error-rate',
      name: 'High Error Rate',
      description: 'Application error rate is above threshold',
      condition: (context) => {
        const errorCount = context.metrics?.['gateway_requests_total{code="500"}'] || 0
        const totalCount = context.metrics?.['gateway_requests_total'] || 1
        return (errorCount / totalCount) > 0.05 // 5% error rate
      },
      level: 'warning',
      category: 'application',
      cooldownMs: 180000, // 3 minutes
      escalationRules: [{
        afterMinutes: 15,
        escalateTo: 'critical',
        notifyChannels: ['dev-team'],
        autoActions: ['collect-diagnostics']
      }]
    })

    // Database connectivity alert
    this.addAlertRule({
      id: 'database-disconnected',
      name: 'Database Disconnected',
      description: 'Database connection is not available',
      condition: (context) => {
        return context.infrastructureMetrics?.database?.connected === false
      },
      level: 'critical',
      category: 'infrastructure',
      cooldownMs: 120000, // 2 minutes
      escalationRules: [{
        afterMinutes: 5,
        escalateTo: 'critical',
        notifyChannels: ['ops-team', 'dba-team'],
        autoActions: ['restart-database-connection']
      }],
      autoResolve: true,
      autoResolveCondition: (context) => {
        return context.infrastructureMetrics?.database?.connected === true
      }
    })

    // Docker container issues alert
    this.addAlertRule({
      id: 'container-high-cpu',
      name: 'Container High CPU Usage',
      description: 'Docker container CPU usage is critically high',
      condition: (context) => {
        const containers = context.dockerMetrics?.containers || []
        return containers.some((container: any) => container.cpu > 90)
      },
      level: 'warning',
      category: 'docker',
      cooldownMs: 300000, // 5 minutes
      escalationRules: [{
        afterMinutes: 10,
        escalateTo: 'critical',
        notifyChannels: ['ops-team'],
        autoActions: ['scale-containers']
      }]
    })
  }

  /**
   * Check if alert should be suppressed
   */
  private async shouldSuppressAlert(alert: Alert): Promise<boolean> {
    // Check for existing similar alerts
    const similarAlerts = this.getActiveAlerts().filter(existing => 
      existing.category === alert.category &&
      existing.level === alert.level &&
      existing.title === alert.title
    )

    if (similarAlerts.length > 0) {
      // Suppress if we have a similar alert in the last 5 minutes
      const recentSimilar = similarAlerts.find(existing => 
        Date.now() - existing.timestamp.getTime() < 300000
      )
      
      if (recentSimilar) {
        return true
      }
    }

    // Check suppression rules
    const rule = this.alertRules.get(alert.metadata?.ruleId)
    if (rule?.suppressionRules) {
      for (const suppressionRule of rule.suppressionRules) {
        if (suppressionRule.condition(alert, Array.from(this.alerts.values()))) {
          alert.suppressUntil = new Date(Date.now() + suppressionRule.durationMs)
          return true
        }
      }
    }

    return false
  }

  /**
   * Find correlation for alert
   */
  private async findCorrelation(alert: Alert): Promise<string | undefined> {
    // Look for existing correlations in the same category
    for (const correlation of this.correlations.values()) {
      if (correlation.category === alert.category && !correlation.endTime) {
        // Add to existing correlation if within time window (30 minutes)
        const timeDiff = alert.timestamp.getTime() - correlation.startTime.getTime()
        if (timeDiff < 1800000) { // 30 minutes
          correlation.alerts.push(alert)
          
          // Update severity if this alert is more severe
          if (this.getAlertSeverityLevel(alert.level) > this.getAlertSeverityLevel(correlation.severity)) {
            correlation.severity = alert.level
          }
          
          return correlation.id
        }
      }
    }

    // Create new correlation if this is a critical alert
    if (alert.level === 'critical') {
      const correlationId = this.generateCorrelationId()
      const correlation: AlertCorrelation = {
        id: correlationId,
        alerts: [alert],
        category: alert.category,
        severity: alert.level,
        startTime: alert.timestamp,
        description: `Correlation for ${alert.category} issues starting with: ${alert.title}`
      }
      
      this.correlations.set(correlationId, correlation)
      return correlationId
    }

    return undefined
  }

  /**
   * Update correlation when alert is resolved
   */
  private async updateCorrelation(correlationId: string): Promise<void> {
    const correlation = this.correlations.get(correlationId)
    if (!correlation) return

    // Check if all alerts in correlation are resolved
    const allResolved = correlation.alerts.every(alert => alert.resolved)
    
    if (allResolved && !correlation.endTime) {
      correlation.endTime = new Date()
      console.log(`🔗 Correlation resolved: ${correlation.description}`)
      this.emit('correlation-resolved', correlation)
    }
  }

  /**
   * Trigger automated responses for alert
   */
  private async triggerAutomatedResponses(alert: Alert): Promise<void> {
    const rule = this.alertRules.get(alert.metadata?.ruleId)
    if (!rule?.escalationRules) return

    // Schedule escalation if configured
    for (const escalationRule of rule.escalationRules) {
      setTimeout(async () => {
        // Check if alert is still active
        const currentAlert = this.alerts.get(alert.id)
        if (!currentAlert || currentAlert.resolved) return

        // Escalate alert
        await this.escalateAlert(alert.id, escalationRule)
      }, escalationRule.afterMinutes * 60 * 1000)
    }
  }

  /**
   * Escalate an alert
   */
  private async escalateAlert(alertId: string, escalationRule: EscalationRule): Promise<void> {
    const alert = this.alerts.get(alertId)
    if (!alert || alert.resolved) return

    alert.escalationLevel++
    alert.level = escalationRule.escalateTo
    
    if (!alert.escalatedAt) {
      alert.escalatedAt = []
    }
    alert.escalatedAt.push(new Date())

    await this.persistAlert(alert)

    console.log(`⬆️ Alert escalated to ${escalationRule.escalateTo}: ${alert.title}`)
    this.emit('alert-escalated', alert, escalationRule)

    // Execute auto actions
    if (escalationRule.autoActions) {
      for (const action of escalationRule.autoActions) {
        await this.executeAutomatedAction(alert, action)
      }
    }
  }

  /**
   * Execute automated action
   */
  private async executeAutomatedAction(alert: Alert, action: string): Promise<void> {
    const response: AlertResponse = {
      id: this.generateResponseId(),
      alertId: alert.id,
      action,
      result: 'pending',
      timestamp: new Date()
    }

    try {
      console.log(`🤖 Executing automated action: ${action} for alert: ${alert.title}`)
      
      // Simulate automated actions (in production, implement actual actions)
      switch (action) {
        case 'restart-application':
          // Trigger application restart
          response.details = { action: 'restart-application', target: 'main-process' }
          break
          
        case 'restart-database-connection':
          // Restart database connection
          response.details = { action: 'restart-database-connection' }
          break
          
        case 'collect-diagnostics':
          // Collect diagnostic information
          response.details = { action: 'collect-diagnostics', timestamp: new Date() }
          break
          
        case 'scale-containers':
          // Scale container resources
          response.details = { action: 'scale-containers', replicas: 2 }
          break
          
        default:
          throw new Error(`Unknown automated action: ${action}`)
      }
      
      response.result = 'success'
      console.log(`✅ Automated action completed: ${action}`)
      
    } catch (error) {
      response.result = 'failure'
      response.error = error instanceof Error ? error.message : String(error)
      console.log(`❌ Automated action failed: ${action} - ${response.error}`)
    }

    this.responses.set(response.id, response)
    this.emit('automated-response', response)
  }

  /**
   * Start alert evaluation loop
   */
  private startAlertEvaluation(): void {
    this.evaluationTimer = setInterval(async () => {
      if (!this.isRunning) return

      try {
        // Get current context (this would be populated by the monitoring system)
        const context: AlertContext = {
          metrics: {},
          healthStatus: {},
          systemMetrics: {},
          dockerMetrics: {},
          infrastructureMetrics: {},
          recentAlerts: this.getAlertHistory({ limit: 10 }),
          timestamp: new Date()
        }

        await this.evaluateAlerts(context)
      } catch (error) {
        console.error('Error during alert evaluation:', error)
      }
    }, this.evaluationInterval)
  }

  /**
   * Utility methods
   */
  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private generateCorrelationId(): string {
    return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private generateResponseId(): string {
    return `resp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private getAlertSeverityLevel(level: Alert['level']): number {
    switch (level) {
      case 'info': return 1
      case 'warning': return 2
      case 'critical': return 3
      default: return 0
    }
  }

  private sanitizeContext(context: AlertContext): any {
    // Remove sensitive data and limit size
    return {
      timestamp: context.timestamp,
      metricsCount: Object.keys(context.metrics).length,
      healthStatus: context.healthStatus?.overall,
      recentAlertsCount: context.recentAlerts.length
    }
  }

  private async isInCooldown(rule: AlertRule): Promise<boolean> {
    // Check if rule has been triggered recently
    const recentAlerts = this.getAlertHistory({ 
      limit: 10,
      category: rule.category
    }).filter(alert => alert.metadata?.ruleId === rule.id)

    if (recentAlerts.length === 0) return false

    const lastAlert = recentAlerts[0]
    const timeSinceLastAlert = Date.now() - lastAlert.timestamp.getTime()
    
    return timeSinceLastAlert < rule.cooldownMs
  }

  private async setCooldown(rule: AlertRule): Promise<void> {
    // Cooldown is implicitly handled by isInCooldown check
    // In a more sophisticated implementation, you might store cooldown state
  }

  private async autoResolveRuleAlerts(ruleId: string): Promise<void> {
    const activeAlerts = this.getActiveAlerts().filter(alert => 
      alert.metadata?.ruleId === ruleId
    )

    for (const alert of activeAlerts) {
      await this.resolveAlert(alert.id, 'auto-resolve')
    }
  }

  private async persistAlert(alert: Alert): Promise<void> {
    try {
      const filename = `alert-${alert.id}.json`
      const filepath = join(this.storageDir, filename)
      await fs.writeFile(filepath, JSON.stringify(alert, null, 2))
    } catch (error) {
      console.error('Failed to persist alert:', error)
    }
  }

  private async persistData(): Promise<void> {
    try {
      // Persist current state
      const state = {
        alerts: Array.from(this.alerts.values()),
        correlations: Array.from(this.correlations.values()),
        responses: Array.from(this.responses.values()),
        timestamp: new Date()
      }
      
      const filepath = join(this.storageDir, 'alert-manager-state.json')
      await fs.writeFile(filepath, JSON.stringify(state, null, 2))
    } catch (error) {
      console.error('Failed to persist alert manager state:', error)
    }
  }

  private async loadPersistedData(): Promise<void> {
    try {
      const filepath = join(this.storageDir, 'alert-manager-state.json')
      const content = await fs.readFile(filepath, 'utf-8')
      const state = JSON.parse(content)
      
      // Restore alerts
      for (const alert of state.alerts || []) {
        this.alerts.set(alert.id, alert)
        this.alertHistory.push(alert)
      }
      
      // Restore correlations
      for (const correlation of state.correlations || []) {
        this.correlations.set(correlation.id, correlation)
      }
      
      // Restore responses
      for (const response of state.responses || []) {
        this.responses.set(response.id, response)
      }
      
      console.log(`📂 Loaded ${this.alerts.size} alerts, ${this.correlations.size} correlations`)
    } catch (error) {
      // File doesn't exist or is corrupted, start fresh
      console.log('📂 Starting with fresh alert state')
    }
  }
}

// Export singleton instance
export const alertManager = new AlertManager()
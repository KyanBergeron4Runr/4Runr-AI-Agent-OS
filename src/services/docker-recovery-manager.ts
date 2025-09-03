import { EventEmitter } from 'events'
import { dockerContainerManager, ContainerInfo, ContainerHealthCheck } from './docker-container-manager'
import { executeCommand } from '../utils/cross-platform-executor'
import { promises as fs } from 'fs'
import { join } from 'path'

export interface ContainerRecoveryStrategy {
  id: string
  name: string
  description: string
  priority: number
  conditions: RecoveryCondition[]
  actions: RecoveryAction[]
  timeout: number
  retries: number
}

export interface RecoveryCondition {
  type: 'health_status' | 'restart_count' | 'memory_usage' | 'cpu_usage' | 'uptime' | 'custom'
  operator: '>' | '<' | '>=' | '<=' | '==' | '!='
  threshold: number | string
  duration?: number
}

export interface RecoveryAction {
  type: 'restart_container' | 'stop_container' | 'recreate_container' | 'scale_service' | 'collect_logs' | 'notify_operator'
  target?: string
  parameters?: Record<string, any>
  timeout?: number
}

export interface RecoveryAttempt {
  id: string
  containerId: string
  containerName: string
  strategyId: string
  startTime: Date
  endTime?: Date
  status: 'running' | 'success' | 'failed' | 'timeout'
  actions: RecoveryActionResult[]
  logs: string[]
  error?: string
}

export interface RecoveryActionResult {
  action: RecoveryAction
  startTime: Date
  endTime?: Date
  status: 'running' | 'success' | 'failed' | 'timeout'
  result?: any
  error?: string
}

export interface ContainerLogEntry {
  containerId: string
  containerName: string
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  source: string
}

export interface RecoveryConfig {
  logCollectionEnabled: boolean
  logRetentionDays: number
  maxLogSizeMB: number
  recoveryTimeout: number
  maxConcurrentRecoveries: number
  notificationThreshold: number
  logDirectory: string
}

/**
 * Docker Container Recovery Manager
 * Provides automatic container recovery, log collection, and performance monitoring
 */
export class DockerRecoveryManager extends EventEmitter {
  private config: RecoveryConfig
  private strategies: Map<string, ContainerRecoveryStrategy> = new Map()
  private activeRecoveries: Map<string, RecoveryAttempt> = new Map()
  private recoveryHistory: RecoveryAttempt[] = []
  private containerLogs: Map<string, ContainerLogEntry[]> = new Map()
  private isRunning: boolean = false
  private logCollectionInterval?: NodeJS.Timeout

  constructor(config: Partial<RecoveryConfig> = {}) {
    super()
    
    this.config = {
      logCollectionEnabled: true,
      logRetentionDays: 7,
      maxLogSizeMB: 100,
      recoveryTimeout: 300000,      // 5 minutes
      maxConcurrentRecoveries: 3,
      notificationThreshold: 5,     // Notify after 5 failed recoveries
      logDirectory: 'logs/containers',
      ...config
    }
    
    this.setupDefaultStrategies()
    console.log('🔧 Docker Recovery Manager initialized')
  }

  /**
   * Start recovery manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Docker Recovery Manager already running')
      return
    }

    console.log('🔧 Starting Docker Recovery Manager...')
    
    try {
      // Ensure log directory exists
      await fs.mkdir(this.config.logDirectory, { recursive: true })
      
      // Set up container manager event listeners
      this.setupContainerManagerListeners()
      
      // Start log collection if enabled
      if (this.config.logCollectionEnabled) {
        await this.startLogCollection()
      }
      
      this.isRunning = true
      
      console.log('✅ Docker Recovery Manager started')
      this.emit('recovery-manager-started')
      
    } catch (error) {
      console.error('❌ Failed to start Docker Recovery Manager:', error)
      throw error
    }
  }

  /**
   * Stop recovery manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return

    console.log('🛑 Stopping Docker Recovery Manager...')
    
    // Stop log collection
    if (this.logCollectionInterval) {
      clearInterval(this.logCollectionInterval)
      this.logCollectionInterval = undefined
    }
    
    // Cancel active recoveries
    for (const recovery of this.activeRecoveries.values()) {
      if (recovery.status === 'running') {
        recovery.status = 'failed'
        recovery.endTime = new Date()
        recovery.error = 'Recovery manager stopped'
      }
    }
    
    this.isRunning = false
    
    console.log('✅ Docker Recovery Manager stopped')
    this.emit('recovery-manager-stopped')
  }

  /**
   * Execute container recovery
   */
  async executeRecovery(containerId: string, strategyId?: string): Promise<RecoveryAttempt> {
    const container = dockerContainerManager.getContainer(containerId)
    if (!container) {
      throw new Error(`Container not found: ${containerId}`)
    }

    // Check concurrent recovery limit
    if (this.activeRecoveries.size >= this.config.maxConcurrentRecoveries) {
      throw new Error('Maximum concurrent recoveries reached')
    }

    // Determine strategy
    const strategy = strategyId 
      ? this.strategies.get(strategyId)
      : await this.selectRecoveryStrategy(container)
    
    if (!strategy) {
      throw new Error(`No suitable recovery strategy found for container: ${container.name}`)
    }

    const attemptId = this.generateAttemptId()
    const attempt: RecoveryAttempt = {
      id: attemptId,
      containerId: container.id,
      containerName: container.name,
      strategyId: strategy.id,
      startTime: new Date(),
      status: 'running',
      actions: [],
      logs: []
    }

    this.activeRecoveries.set(attemptId, attempt)

    console.log(`🔧 Starting container recovery: ${container.name} using strategy: ${strategy.name}`)
    this.emit('recovery-started', attempt)

    try {
      // Collect logs before recovery
      if (this.config.logCollectionEnabled) {
        await this.collectContainerLogs(container.id, attempt)
      }

      // Execute recovery actions
      await this.executeRecoveryActions(attempt, strategy.actions)
      
      // Validate recovery success
      const success = await this.validateRecovery(attempt, container)
      
      if (success) {
        attempt.status = 'success'
        attempt.endTime = new Date()
        
        console.log(`✅ Container recovery successful: ${container.name}`)
        this.emit('recovery-success', attempt)
      } else {
        throw new Error('Recovery validation failed')
      }
      
    } catch (error) {
      attempt.status = 'failed'
      attempt.endTime = new Date()
      attempt.error = error instanceof Error ? error.message : String(error)
      
      console.log(`❌ Container recovery failed: ${container.name} - ${attempt.error}`)
      this.emit('recovery-failed', attempt)
      
    } finally {
      this.activeRecoveries.delete(attemptId)
      this.recoveryHistory.push(attempt)
      
      // Keep history manageable
      if (this.recoveryHistory.length > 1000) {
        this.recoveryHistory.shift()
      }
      
      await this.persistRecoveryAttempt(attempt)
    }

    return attempt
  }

  /**
   * Collect container logs
   */
  async collectContainerLogs(containerId: string, attempt?: RecoveryAttempt): Promise<ContainerLogEntry[]> {
    try {
      const container = dockerContainerManager.getContainer(containerId)
      if (!container) {
        throw new Error(`Container not found: ${containerId}`)
      }

      console.log(`📋 Collecting logs for container: ${container.name}`)
      
      const result = await executeCommand('docker', [
        'logs', '--tail', '100', '--timestamps', containerId
      ], {
        timeout: 30000
      })
      
      if (!result.success) {
        console.log(`⚠️ Failed to collect logs for ${container.name}: ${result.stderr}`)
        return []
      }
      
      const logs = this.parseContainerLogs(containerId, container.name, result.stdout)
      
      // Store logs
      if (!this.containerLogs.has(containerId)) {
        this.containerLogs.set(containerId, [])
      }
      
      const containerLogList = this.containerLogs.get(containerId)!
      containerLogList.push(...logs)
      
      // Keep only recent logs
      const maxLogs = 1000
      if (containerLogList.length > maxLogs) {
        containerLogList.splice(0, containerLogList.length - maxLogs)
      }
      
      // Add to recovery attempt if provided
      if (attempt) {
        attempt.logs.push(`Collected ${logs.length} log entries`)
      }
      
      // Persist logs to file
      await this.persistContainerLogs(containerId, logs)
      
      this.emit('logs-collected', containerId, logs)
      
      return logs
      
    } catch (error) {
      console.error(`❌ Log collection failed for ${containerId}:`, error)
      return []
    }
  }

  /**
   * Monitor container performance
   */
  async monitorContainerPerformance(containerId: string): Promise<{
    cpuTrend: 'increasing' | 'decreasing' | 'stable'
    memoryTrend: 'increasing' | 'decreasing' | 'stable'
    restartFrequency: number
    healthScore: number
  }> {
    const stats = dockerContainerManager.getContainerStats(containerId, 10)
    const health = dockerContainerManager.getContainerHealth(containerId)
    
    if (stats.length < 2) {
      return {
        cpuTrend: 'stable',
        memoryTrend: 'stable',
        restartFrequency: 0,
        healthScore: health?.status === 'healthy' ? 100 : 0
      }
    }
    
    // Analyze CPU trend
    const cpuValues = stats.map(s => s.cpuPercent)
    const cpuTrend = this.analyzeTrend(cpuValues)
    
    // Analyze memory trend
    const memoryValues = stats.map(s => s.memoryPercent)
    const memoryTrend = this.analyzeTrend(memoryValues)
    
    // Calculate restart frequency (restarts per hour)
    const container = dockerContainerManager.getContainer(containerId)
    const restartFrequency = container ? (container.restartCount / (container.uptime / (60 * 60 * 1000))) : 0
    
    // Calculate health score
    let healthScore = 100
    if (health) {
      if (health.status === 'unhealthy') healthScore -= 50
      if (health.status === 'starting') healthScore -= 25
      healthScore -= Math.min(health.failingStreak * 10, 40)
    }
    
    // Adjust for performance trends
    if (cpuTrend === 'increasing') healthScore -= 10
    if (memoryTrend === 'increasing') healthScore -= 15
    if (restartFrequency > 1) healthScore -= 20
    
    healthScore = Math.max(0, healthScore)
    
    return {
      cpuTrend,
      memoryTrend,
      restartFrequency,
      healthScore
    }
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStatistics(hours: number = 24): {
    totalAttempts: number
    successfulAttempts: number
    failedAttempts: number
    successRate: number
    averageRecoveryTime: number
    strategiesUsed: Record<string, number>
    containerFailures: Record<string, number>
  } {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)
    const recentAttempts = this.recoveryHistory.filter(attempt => attempt.startTime >= since)

    const successful = recentAttempts.filter(a => a.status === 'success')
    const failed = recentAttempts.filter(a => a.status === 'failed')

    const strategiesUsed: Record<string, number> = {}
    const containerFailures: Record<string, number> = {}

    recentAttempts.forEach(attempt => {
      strategiesUsed[attempt.strategyId] = (strategiesUsed[attempt.strategyId] || 0) + 1
      containerFailures[attempt.containerName] = (containerFailures[attempt.containerName] || 0) + 1
    })

    const recoveryTimes = successful
      .filter(a => a.endTime)
      .map(a => a.endTime!.getTime() - a.startTime.getTime())
    
    const averageRecoveryTime = recoveryTimes.length > 0 
      ? recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length
      : 0

    return {
      totalAttempts: recentAttempts.length,
      successfulAttempts: successful.length,
      failedAttempts: failed.length,
      successRate: recentAttempts.length > 0 ? (successful.length / recentAttempts.length) * 100 : 0,
      averageRecoveryTime,
      strategiesUsed,
      containerFailures
    }
  }

  /**
   * Setup default recovery strategies
   */
  private setupDefaultStrategies(): void {
    // Simple restart strategy
    this.addRecoveryStrategy({
      id: 'simple-restart',
      name: 'Simple Container Restart',
      description: 'Restart container when unhealthy',
      priority: 1,
      conditions: [
        { type: 'health_status', operator: '==', threshold: 'unhealthy' }
      ],
      actions: [
        { type: 'collect_logs', timeout: 30000 },
        { type: 'restart_container', timeout: 60000 }
      ],
      timeout: 120000,
      retries: 2
    })

    // Recreate strategy for persistent failures
    this.addRecoveryStrategy({
      id: 'recreate-container',
      name: 'Recreate Container',
      description: 'Recreate container for persistent failures',
      priority: 2,
      conditions: [
        { type: 'restart_count', operator: '>', threshold: 3 }
      ],
      actions: [
        { type: 'collect_logs', timeout: 30000 },
        { type: 'stop_container', timeout: 30000 },
        { type: 'recreate_container', timeout: 120000 }
      ],
      timeout: 180000,
      retries: 1
    })

    // High resource usage strategy
    this.addRecoveryStrategy({
      id: 'resource-pressure',
      name: 'Resource Pressure Recovery',
      description: 'Handle containers with high resource usage',
      priority: 3,
      conditions: [
        { type: 'memory_usage', operator: '>', threshold: 90 },
        { type: 'cpu_usage', operator: '>', threshold: 95 }
      ],
      actions: [
        { type: 'collect_logs', timeout: 30000 },
        { type: 'restart_container', timeout: 60000 }
      ],
      timeout: 120000,
      retries: 1
    })
  }

  /**
   * Add recovery strategy
   */
  addRecoveryStrategy(strategy: ContainerRecoveryStrategy): void {
    this.strategies.set(strategy.id, strategy)
    console.log(`📋 Added container recovery strategy: ${strategy.name}`)
    this.emit('strategy-added', strategy)
  }

  /**
   * Setup container manager event listeners
   */
  private setupContainerManagerListeners(): void {
    dockerContainerManager.on('health-check-failed', async (healthCheck: ContainerHealthCheck) => {
      if (healthCheck.failingStreak >= 3) {
        console.log(`🚨 Container ${healthCheck.containerName} has ${healthCheck.failingStreak} consecutive failures`)
        
        try {
          await this.executeRecovery(healthCheck.containerId)
        } catch (error) {
          console.error(`❌ Auto-recovery failed for ${healthCheck.containerName}:`, error)
        }
      }
    })

    dockerContainerManager.on('container-failed', async (container: ContainerInfo) => {
      console.log(`🚨 Container ${container.name} has failed completely`)
      
      try {
        await this.executeRecovery(container.id, 'recreate-container')
      } catch (error) {
        console.error(`❌ Container recreation failed for ${container.name}:`, error)
        this.emit('recovery-escalation-needed', container, error)
      }
    })
  }

  /**
   * Start log collection
   */
  private async startLogCollection(): Promise<void> {
    this.logCollectionInterval = setInterval(async () => {
      const containers = dockerContainerManager.getAllContainers()
      const runningContainers = containers.filter(c => c.status === 'running')
      
      for (const container of runningContainers) {
        try {
          await this.collectContainerLogs(container.id)
        } catch (error) {
          console.log(`⚠️ Failed to collect logs for ${container.name}:`, error)
        }
      }
    }, 300000) // Every 5 minutes
  }

  /**
   * Select appropriate recovery strategy
   */
  private async selectRecoveryStrategy(container: ContainerInfo): Promise<ContainerRecoveryStrategy | null> {
    const health = dockerContainerManager.getContainerHealth(container.id)
    const performance = await this.monitorContainerPerformance(container.id)
    
    const sortedStrategies = Array.from(this.strategies.values())
      .sort((a, b) => a.priority - b.priority)
    
    for (const strategy of sortedStrategies) {
      if (await this.evaluateConditions(strategy.conditions, container, health, performance)) {
        return strategy
      }
    }
    
    return null
  }

  /**
   * Execute recovery actions
   */
  private async executeRecoveryActions(attempt: RecoveryAttempt, actions: RecoveryAction[]): Promise<void> {
    for (const action of actions) {
      const actionResult: RecoveryActionResult = {
        action,
        startTime: new Date(),
        status: 'running'
      }
      
      attempt.actions.push(actionResult)
      
      try {
        console.log(`🔧 Executing recovery action: ${action.type}`)
        
        const result = await this.executeRecoveryAction(action, attempt.containerId)
        
        actionResult.status = 'success'
        actionResult.endTime = new Date()
        actionResult.result = result
        
        console.log(`✅ Recovery action completed: ${action.type}`)
        
      } catch (error) {
        actionResult.status = 'failed'
        actionResult.endTime = new Date()
        actionResult.error = error instanceof Error ? error.message : String(error)
        
        console.log(`❌ Recovery action failed: ${action.type} - ${actionResult.error}`)
        throw error
      }
    }
  }

  /**
   * Execute individual recovery action
   */
  private async executeRecoveryAction(action: RecoveryAction, containerId: string): Promise<any> {
    const timeout = action.timeout || 60000
    
    switch (action.type) {
      case 'restart_container':
        return await dockerContainerManager.restartContainer(containerId)
      
      case 'stop_container':
        return await dockerContainerManager.stopContainer(containerId, 10)
      
      case 'recreate_container':
        return await this.recreateContainer(containerId)
      
      case 'collect_logs':
        return await this.collectContainerLogs(containerId)
      
      case 'notify_operator':
        this.emit('operator-notification', {
          containerId,
          action,
          timestamp: new Date()
        })
        return { notified: true }
      
      default:
        throw new Error(`Unknown recovery action: ${action.type}`)
    }
  }

  /**
   * Recreate container (simplified - would need more complex logic in production)
   */
  private async recreateContainer(containerId: string): Promise<boolean> {
    try {
      // This is a simplified implementation
      // In production, you'd need to:
      // 1. Get container configuration
      // 2. Stop and remove container
      // 3. Recreate with same configuration
      
      console.log(`🔄 Recreating container: ${containerId}`)
      
      // For now, just restart the container
      return await dockerContainerManager.restartContainer(containerId)
      
    } catch (error) {
      console.error(`❌ Container recreation failed: ${error}`)
      return false
    }
  }

  /**
   * Validate recovery success
   */
  private async validateRecovery(attempt: RecoveryAttempt, container: ContainerInfo): Promise<boolean> {
    // Wait a bit for container to stabilize
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    // Check container health
    const health = await dockerContainerManager.checkContainerHealth(container)
    
    return health.status === 'healthy' || health.status === 'starting'
  }

  /**
   * Evaluate recovery conditions
   */
  private async evaluateConditions(
    conditions: RecoveryCondition[], 
    container: ContainerInfo, 
    health?: ContainerHealthCheck,
    performance?: any
  ): Promise<boolean> {
    for (const condition of conditions) {
      const value = await this.getConditionValue(condition, container, health, performance)
      if (!this.compareValues(value, condition.operator, condition.threshold)) {
        return false
      }
    }
    return true
  }

  /**
   * Get condition value
   */
  private async getConditionValue(
    condition: RecoveryCondition, 
    container: ContainerInfo, 
    health?: ContainerHealthCheck,
    performance?: any
  ): Promise<any> {
    switch (condition.type) {
      case 'health_status':
        return health?.status || 'none'
      case 'restart_count':
        return container.restartCount
      case 'memory_usage':
        const stats = dockerContainerManager.getContainerStats(container.id, 1)
        return stats.length > 0 ? stats[0].memoryPercent : 0
      case 'cpu_usage':
        const cpuStats = dockerContainerManager.getContainerStats(container.id, 1)
        return cpuStats.length > 0 ? cpuStats[0].cpuPercent : 0
      case 'uptime':
        return container.uptime
      default:
        return null
    }
  }

  /**
   * Compare values with operator
   */
  private compareValues(value: any, operator: string, threshold: any): boolean {
    switch (operator) {
      case '>': return value > threshold
      case '<': return value < threshold
      case '>=': return value >= threshold
      case '<=': return value <= threshold
      case '==': return value === threshold
      case '!=': return value !== threshold
      default: return false
    }
  }

  /**
   * Analyze trend in numeric values
   */
  private analyzeTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 3) return 'stable'
    
    let increasing = 0
    let decreasing = 0
    
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i - 1]) increasing++
      else if (values[i] < values[i - 1]) decreasing++
    }
    
    const threshold = values.length * 0.6
    
    if (increasing >= threshold) return 'increasing'
    if (decreasing >= threshold) return 'decreasing'
    return 'stable'
  }

  /**
   * Parse container logs
   */
  private parseContainerLogs(containerId: string, containerName: string, logOutput: string): ContainerLogEntry[] {
    const logs: ContainerLogEntry[] = []
    const lines = logOutput.split('\n').filter(line => line.trim())
    
    for (const line of lines) {
      try {
        // Parse Docker log format: timestamp message
        const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.+)$/)
        
        if (match) {
          const timestamp = new Date(match[1])
          const message = match[2]
          
          // Determine log level from message content
          let level: 'info' | 'warn' | 'error' | 'debug' = 'info'
          const lowerMessage = message.toLowerCase()
          
          if (lowerMessage.includes('error') || lowerMessage.includes('fail')) {
            level = 'error'
          } else if (lowerMessage.includes('warn') || lowerMessage.includes('warning')) {
            level = 'warn'
          } else if (lowerMessage.includes('debug')) {
            level = 'debug'
          }
          
          logs.push({
            containerId,
            containerName,
            timestamp,
            level,
            message,
            source: 'container'
          })
        }
      } catch (error) {
        // Skip malformed log lines
        continue
      }
    }
    
    return logs
  }

  /**
   * Persist container logs to file
   */
  private async persistContainerLogs(containerId: string, logs: ContainerLogEntry[]): Promise<void> {
    try {
      const logFile = join(this.config.logDirectory, `${containerId}.log`)
      const logLines = logs.map(log => 
        `${log.timestamp.toISOString()} [${log.level.toUpperCase()}] ${log.message}`
      ).join('\n')
      
      await fs.appendFile(logFile, logLines + '\n')
      
    } catch (error) {
      console.error('❌ Failed to persist container logs:', error)
    }
  }

  /**
   * Persist recovery attempt
   */
  private async persistRecoveryAttempt(attempt: RecoveryAttempt): Promise<void> {
    try {
      const recoveryFile = join(this.config.logDirectory, `recovery-${attempt.id}.json`)
      await fs.writeFile(recoveryFile, JSON.stringify(attempt, null, 2))
      
    } catch (error) {
      console.error('❌ Failed to persist recovery attempt:', error)
    }
  }

  /**
   * Generate attempt ID
   */
  private generateAttemptId(): string {
    return `recovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

// Export singleton instance
export const dockerRecoveryManager = new DockerRecoveryManager()
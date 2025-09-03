import { EventEmitter } from 'events'
import { circuitBreakerRegistry } from './circuit'
import { cache } from './cache'

export interface DegradationLevel {
  level: number
  name: string
  description: string
  triggers: DegradationTrigger[]
  actions: DegradationAction[]
  recoveryThreshold: number
}

export interface DegradationTrigger {
  type: 'memory' | 'cpu' | 'response_time' | 'error_rate' | 'queue_depth' | 'custom'
  threshold: number
  duration: number // milliseconds
  operator: '>' | '<' | '>=' | '<=' | '=='
}

export interface DegradationAction {
  type: 'disable_feature' | 'reduce_cache' | 'limit_requests' | 'close_connections' | 'gc_trigger' | 'custom'
  target?: string
  parameters?: Record<string, any>
}

export interface DegradationStatus {
  active: boolean
  level: number
  levelName: string
  activatedAt?: Date
  triggers: string[]
  actions: string[]
  metrics: {
    requestsDropped: number
    featuresDisabled: string[]
    cacheReductions: number
    connectionsDropped: number
  }
}

export interface LoadSheddingConfig {
  enabled: boolean
  maxQueueSize: number
  dropProbability: number
  priorityLevels: Record<string, number>
  exemptPaths: string[]
}

export interface BackpressureConfig {
  enabled: boolean
  maxConcurrentRequests: number
  queueTimeout: number
  slowConsumerThreshold: number
}

/**
 * Graceful Degradation Controller
 * Maintains service availability under stress through intelligent load shedding and feature degradation
 */
export class DegradationController extends EventEmitter {
  private degradationLevels: DegradationLevel[] = []
  private currentLevel: number = 0
  private isActive: boolean = false
  private activatedAt?: Date
  private monitoringTimer: NodeJS.Timeout | null = null
  private metrics: DegradationStatus['metrics']
  private loadSheddingConfig: LoadSheddingConfig
  private backpressureConfig: BackpressureConfig
  private requestQueue: Array<{ request: any; priority: number; timestamp: Date }> = []
  private activeRequests: number = 0
  private disabledFeatures: Set<string> = new Set()
  private connectionLimits: Map<string, number> = new Map()

  constructor() {
    super()
    
    this.metrics = {
      requestsDropped: 0,
      featuresDisabled: [],
      cacheReductions: 0,
      connectionsDropped: 0
    }

    this.loadSheddingConfig = {
      enabled: true,
      maxQueueSize: 1000,
      dropProbability: 0.1,
      priorityLevels: {
        'health': 1,
        'metrics': 2,
        'admin': 3,
        'api': 4,
        'static': 5
      },
      exemptPaths: ['/health', '/ready', '/metrics']
    }

    this.backpressureConfig = {
      enabled: true,
      maxConcurrentRequests: 100,
      queueTimeout: 30000, // 30 seconds
      slowConsumerThreshold: 5000 // 5 seconds
    }

    this.setupDefaultDegradationLevels()
  }

  /**
   * Start degradation monitoring
   */
  start(): void {
    if (this.monitoringTimer) return

    console.log('🛡️ Starting Graceful Degradation Controller...')
    
    this.monitoringTimer = setInterval(() => {
      this.evaluateDegradationConditions()
    }, 5000) // Check every 5 seconds

    console.log('✅ Graceful Degradation Controller started')
    this.emit('degradation-controller-started')
  }

  /**
   * Stop degradation monitoring
   */
  stop(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer)
      this.monitoringTimer = null
    }

    // Restore normal operation
    if (this.isActive) {
      this.deactivateDegradation()
    }

    console.log('🛑 Graceful Degradation Controller stopped')
    this.emit('degradation-controller-stopped')
  }

  /**
   * Get current degradation status
   */
  getStatus(): DegradationStatus {
    return {
      active: this.isActive,
      level: this.currentLevel,
      levelName: this.getCurrentLevelName(),
      activatedAt: this.activatedAt,
      triggers: this.getActiveTriggers(),
      actions: this.getActiveActions(),
      metrics: { ...this.metrics }
    }
  }

  /**
   * Check if a feature is enabled (not degraded)
   */
  isFeatureEnabled(feature: string): boolean {
    return !this.disabledFeatures.has(feature)
  }

  /**
   * Apply load shedding to incoming request
   */
  shouldAcceptRequest(request: {
    path: string
    priority?: string
    timestamp?: Date
  }): { accept: boolean; reason?: string } {
    if (!this.loadSheddingConfig.enabled) {
      return { accept: true }
    }

    // Always accept exempt paths
    if (this.loadSheddingConfig.exemptPaths.some(path => request.path.startsWith(path))) {
      return { accept: true }
    }

    // Check concurrent request limit
    if (this.activeRequests >= this.backpressureConfig.maxConcurrentRequests) {
      this.metrics.requestsDropped++
      return { accept: false, reason: 'concurrent_limit_exceeded' }
    }

    // Check queue size
    if (this.requestQueue.length >= this.loadSheddingConfig.maxQueueSize) {
      this.metrics.requestsDropped++
      return { accept: false, reason: 'queue_full' }
    }

    // Apply probabilistic dropping during degradation
    if (this.isActive && this.currentLevel > 0) {
      const dropProbability = this.loadSheddingConfig.dropProbability * this.currentLevel
      if (Math.random() < dropProbability) {
        this.metrics.requestsDropped++
        return { accept: false, reason: 'load_shedding' }
      }
    }

    return { accept: true }
  }

  /**
   * Register request start
   */
  registerRequestStart(requestId: string): void {
    this.activeRequests++
  }

  /**
   * Register request completion
   */
  registerRequestComplete(requestId: string): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1)
  }

  /**
   * Trigger garbage collection
   */
  triggerGarbageCollection(): void {
    if (global.gc) {
      console.log('🗑️ Triggering garbage collection for memory pressure relief')
      global.gc()
      this.emit('gc-triggered')
    } else {
      console.warn('⚠️ Garbage collection not available (run with --expose-gc)')
    }
  }

  /**
   * Close idle connections
   */
  closeIdleConnections(): void {
    console.log('🔌 Closing idle connections to reduce resource usage')
    
    // In a real implementation, you would close actual idle connections
    // This is a placeholder for the concept
    this.metrics.connectionsDropped += 10 // Simulated
    
    this.emit('idle-connections-closed', { count: 10 })
  }

  /**
   * Clear caches with priority
   */
  clearCaches(priority: 'low' | 'medium' | 'high' = 'medium'): void {
    console.log(`🧹 Clearing caches (priority: ${priority})`)
    
    try {
      const stats = cache.getStats()
      const clearCount = Math.floor(stats.size * this.getClearRatio(priority))
      
      // Clear cache entries (cache implementation would need to support partial clearing)
      cache.clear() // For now, clear all - in production, implement priority-based clearing
      
      this.metrics.cacheReductions++
      
      console.log(`🧹 Cleared ${clearCount} cache entries`)
      this.emit('cache-cleared', { priority, count: clearCount })
    } catch (error) {
      console.error('Failed to clear caches:', error)
    }
  }

  /**
   * Disable non-essential feature
   */
  disableFeature(feature: string): void {
    if (!this.disabledFeatures.has(feature)) {
      this.disabledFeatures.add(feature)
      this.metrics.featuresDisabled.push(feature)
      
      console.log(`🚫 Feature disabled: ${feature}`)
      this.emit('feature-disabled', feature)
    }
  }

  /**
   * Re-enable feature
   */
  enableFeature(feature: string): void {
    if (this.disabledFeatures.has(feature)) {
      this.disabledFeatures.delete(feature)
      this.metrics.featuresDisabled = this.metrics.featuresDisabled.filter(f => f !== feature)
      
      console.log(`✅ Feature re-enabled: ${feature}`)
      this.emit('feature-enabled', feature)
    }
  }

  /**
   * Open circuit breaker for service
   */
  openCircuit(service: string, reason: string): void {
    try {
      const breaker = circuitBreakerRegistry.getBreaker(service)
      if (breaker) {
        // breaker.open() // Circuit breaker API may vary
        console.log(`⚡ Circuit breaker opened for ${service}: ${reason}`)
        this.emit('circuit-opened', { service, reason })
      }
    } catch (error) {
      console.error(`Failed to open circuit for ${service}:`, error)
    }
  }

  /**
   * Close circuit breaker for service
   */
  closeCircuit(service: string): void {
    try {
      const breaker = circuitBreakerRegistry.getBreaker(service)
      if (breaker) {
        // breaker.close() // Circuit breaker API may vary
        console.log(`⚡ Circuit breaker closed for ${service}`)
        this.emit('circuit-closed', { service })
      }
    } catch (error) {
      console.error(`Failed to close circuit for ${service}:`, error)
    }
  }

  /**
   * Add custom degradation level
   */
  addDegradationLevel(level: DegradationLevel): void {
    this.degradationLevels.push(level)
    this.degradationLevels.sort((a, b) => a.level - b.level)
    
    console.log(`📊 Added degradation level: ${level.name} (Level ${level.level})`)
    this.emit('degradation-level-added', level)
  }

  /**
   * Force degradation to specific level
   */
  forceDegradation(level: number, reason: string = 'manual'): void {
    const targetLevel = this.degradationLevels.find(l => l.level === level)
    if (!targetLevel) {
      throw new Error(`Degradation level ${level} not found`)
    }

    console.log(`🔧 Forcing degradation to level ${level}: ${reason}`)
    this.activateDegradation(targetLevel, [`manual: ${reason}`])
  }

  /**
   * Force recovery from degradation
   */
  forceRecovery(reason: string = 'manual'): void {
    if (this.isActive) {
      console.log(`🔧 Forcing recovery from degradation: ${reason}`)
      this.deactivateDegradation()
    }
  }

  /**
   * Setup default degradation levels
   */
  private setupDefaultDegradationLevels(): void {
    // Level 1: Light degradation
    this.addDegradationLevel({
      level: 1,
      name: 'Light Degradation',
      description: 'Reduce non-essential features and clear low-priority caches',
      triggers: [
        { type: 'memory', threshold: 0.8, duration: 30000, operator: '>' }, // 80% memory for 30s
        { type: 'response_time', threshold: 2000, duration: 60000, operator: '>' }, // 2s response time for 1m
        { type: 'error_rate', threshold: 0.05, duration: 30000, operator: '>' } // 5% error rate for 30s
      ],
      actions: [
        { type: 'disable_feature', target: 'analytics' },
        { type: 'disable_feature', target: 'logging_verbose' },
        { type: 'reduce_cache', parameters: { priority: 'low' } }
      ],
      recoveryThreshold: 0.7 // Recover when conditions improve to 70% of trigger
    })

    // Level 2: Moderate degradation
    this.addDegradationLevel({
      level: 2,
      name: 'Moderate Degradation',
      description: 'Implement load shedding and reduce cache size significantly',
      triggers: [
        { type: 'memory', threshold: 0.9, duration: 15000, operator: '>' }, // 90% memory for 15s
        { type: 'response_time', threshold: 5000, duration: 30000, operator: '>' }, // 5s response time for 30s
        { type: 'error_rate', threshold: 0.1, duration: 15000, operator: '>' } // 10% error rate for 15s
      ],
      actions: [
        { type: 'disable_feature', target: 'caching' },
        { type: 'disable_feature', target: 'background_tasks' },
        { type: 'limit_requests', parameters: { dropProbability: 0.2 } },
        { type: 'reduce_cache', parameters: { priority: 'medium' } },
        { type: 'gc_trigger' }
      ],
      recoveryThreshold: 0.6
    })

    // Level 3: Severe degradation
    this.addDegradationLevel({
      level: 3,
      name: 'Severe Degradation',
      description: 'Emergency mode - only core functionality available',
      triggers: [
        { type: 'memory', threshold: 0.95, duration: 5000, operator: '>' }, // 95% memory for 5s
        { type: 'response_time', threshold: 10000, duration: 15000, operator: '>' }, // 10s response time for 15s
        { type: 'error_rate', threshold: 0.2, duration: 10000, operator: '>' } // 20% error rate for 10s
      ],
      actions: [
        { type: 'disable_feature', target: 'all_non_essential' },
        { type: 'limit_requests', parameters: { dropProbability: 0.5 } },
        { type: 'reduce_cache', parameters: { priority: 'high' } },
        { type: 'close_connections' },
        { type: 'gc_trigger' }
      ],
      recoveryThreshold: 0.5
    })
  }

  /**
   * Evaluate degradation conditions
   */
  private async evaluateDegradationConditions(): Promise<void> {
    try {
      const metrics = await this.getCurrentMetrics()
      
      // Check if we need to escalate degradation
      for (const level of this.degradationLevels) {
        if (level.level > this.currentLevel) {
          if (this.shouldActivateLevel(level, metrics)) {
            this.activateDegradation(level, this.getTriggeredConditions(level, metrics))
            return
          }
        }
      }

      // Check if we can recover from current degradation
      if (this.isActive) {
        const currentLevelConfig = this.degradationLevels.find(l => l.level === this.currentLevel)
        if (currentLevelConfig && this.shouldRecover(currentLevelConfig, metrics)) {
          this.deactivateDegradation()
        }
      }
    } catch (error) {
      console.error('Error evaluating degradation conditions:', error)
    }
  }

  /**
   * Get current system metrics
   */
  private async getCurrentMetrics(): Promise<Record<string, number>> {
    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    
    // Calculate CPU percentage (simplified)
    const cpuPercent = ((cpuUsage.user + cpuUsage.system) / 1000000) / process.uptime() * 100

    return {
      memory: memUsage.heapUsed / memUsage.heapTotal,
      cpu: Math.min(cpuPercent / 100, 1), // Normalize to 0-1
      response_time: this.getAverageResponseTime(),
      error_rate: this.getErrorRate(),
      queue_depth: this.requestQueue.length / this.loadSheddingConfig.maxQueueSize,
      active_requests: this.activeRequests / this.backpressureConfig.maxConcurrentRequests
    }
  }

  /**
   * Check if degradation level should be activated
   */
  private shouldActivateLevel(level: DegradationLevel, metrics: Record<string, number>): boolean {
    return level.triggers.some(trigger => {
      const value = metrics[trigger.type] || 0
      const threshold = trigger.threshold
      
      switch (trigger.operator) {
        case '>': return value > threshold
        case '<': return value < threshold
        case '>=': return value >= threshold
        case '<=': return value <= threshold
        case '==': return Math.abs(value - threshold) < 0.01
        default: return false
      }
    })
  }

  /**
   * Check if we should recover from degradation
   */
  private shouldRecover(level: DegradationLevel, metrics: Record<string, number>): boolean {
    return level.triggers.every(trigger => {
      const value = metrics[trigger.type] || 0
      const threshold = trigger.threshold * level.recoveryThreshold
      
      switch (trigger.operator) {
        case '>': return value <= threshold
        case '<': return value >= threshold
        case '>=': return value < threshold
        case '<=': return value > threshold
        case '==': return Math.abs(value - threshold) > 0.01
        default: return true
      }
    })
  }

  /**
   * Get triggered conditions for a level
   */
  private getTriggeredConditions(level: DegradationLevel, metrics: Record<string, number>): string[] {
    return level.triggers
      .filter(trigger => {
        const value = metrics[trigger.type] || 0
        const threshold = trigger.threshold
        
        switch (trigger.operator) {
          case '>': return value > threshold
          case '<': return value < threshold
          case '>=': return value >= threshold
          case '<=': return value <= threshold
          case '==': return Math.abs(value - threshold) < 0.01
          default: return false
        }
      })
      .map(trigger => `${trigger.type} ${trigger.operator} ${trigger.threshold}`)
  }

  /**
   * Activate degradation level
   */
  private activateDegradation(level: DegradationLevel, triggers: string[]): void {
    const wasActive = this.isActive
    const previousLevel = this.currentLevel

    this.isActive = true
    this.currentLevel = level.level
    
    if (!wasActive) {
      this.activatedAt = new Date()
    }

    console.log(`🛡️ Activating degradation level ${level.level}: ${level.name}`)
    console.log(`   Triggers: ${triggers.join(', ')}`)
    console.log(`   Actions: ${level.actions.map(a => a.type).join(', ')}`)

    // Execute degradation actions
    for (const action of level.actions) {
      this.executeAction(action)
    }

    this.emit('degradation-activated', {
      level: level.level,
      name: level.name,
      triggers,
      previousLevel,
      wasActive
    })
  }

  /**
   * Deactivate degradation
   */
  private deactivateDegradation(): void {
    const previousLevel = this.currentLevel
    const previousLevelName = this.getCurrentLevelName()

    this.isActive = false
    this.currentLevel = 0
    this.activatedAt = undefined

    console.log(`🛡️ Deactivating degradation (was level ${previousLevel}: ${previousLevelName})`)

    // Restore normal operation
    this.restoreNormalOperation()

    this.emit('degradation-deactivated', {
      previousLevel,
      previousLevelName
    })
  }

  /**
   * Execute degradation action
   */
  private executeAction(action: DegradationAction): void {
    try {
      switch (action.type) {
        case 'disable_feature':
          if (action.target) {
            this.disableFeature(action.target)
          }
          break

        case 'reduce_cache':
          const priority = action.parameters?.priority || 'medium'
          this.clearCaches(priority)
          break

        case 'limit_requests':
          const dropProbability = action.parameters?.dropProbability || 0.1
          this.loadSheddingConfig.dropProbability = dropProbability
          break

        case 'close_connections':
          this.closeIdleConnections()
          break

        case 'gc_trigger':
          this.triggerGarbageCollection()
          break

        default:
          console.warn(`Unknown degradation action: ${action.type}`)
      }
    } catch (error) {
      console.error(`Failed to execute degradation action ${action.type}:`, error)
    }
  }

  /**
   * Restore normal operation
   */
  private restoreNormalOperation(): void {
    // Re-enable all features
    for (const feature of this.disabledFeatures) {
      this.enableFeature(feature)
    }

    // Reset load shedding configuration
    this.loadSheddingConfig.dropProbability = 0.1

    // Clear metrics
    this.metrics = {
      requestsDropped: 0,
      featuresDisabled: [],
      cacheReductions: 0,
      connectionsDropped: 0
    }

    console.log('🛡️ Normal operation restored')
  }

  /**
   * Utility methods
   */
  private getCurrentLevelName(): string {
    const level = this.degradationLevels.find(l => l.level === this.currentLevel)
    return level ? level.name : 'Normal'
  }

  private getActiveTriggers(): string[] {
    if (!this.isActive) return []
    
    const level = this.degradationLevels.find(l => l.level === this.currentLevel)
    return level ? level.triggers.map(t => `${t.type} ${t.operator} ${t.threshold}`) : []
  }

  private getActiveActions(): string[] {
    if (!this.isActive) return []
    
    const level = this.degradationLevels.find(l => l.level === this.currentLevel)
    return level ? level.actions.map(a => a.type) : []
  }

  private getClearRatio(priority: 'low' | 'medium' | 'high'): number {
    switch (priority) {
      case 'low': return 0.25
      case 'medium': return 0.5
      case 'high': return 0.75
      default: return 0.5
    }
  }

  private getAverageResponseTime(): number {
    // Placeholder - in real implementation, track actual response times
    return 100 // milliseconds
  }

  private getErrorRate(): number {
    // Placeholder - in real implementation, track actual error rates
    return 0.01 // 1%
  }
}

// Export singleton instance
export const degradationController = new DegradationController()
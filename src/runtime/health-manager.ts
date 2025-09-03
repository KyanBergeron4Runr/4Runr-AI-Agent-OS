import { EventEmitter } from 'events'
import { lifecycleManager, HealthStatus, ReadinessStatus } from './lifecycle'
import { memoryDB } from '../models/memory-db'
import { cache } from './cache'
import { resourceLeakDetector, LeakDetectionResult } from './resource-leak-detector'

export interface HealthCheck {
  name: string
  check: () => Promise<HealthCheckResult>
  interval: number
  timeout: number
  retries: number
  successThreshold: number
  failureThreshold: number
}

export interface HealthCheckResult {
  healthy: boolean
  message: string
  duration: number
  metadata?: Record<string, any>
}

export interface ResourceMetrics {
  memory: {
    used: number
    total: number
    heapUsed: number
    heapTotal: number
    external: number
    rss: number
  }
  cpu: {
    usage: number
    loadAverage: number[]
  }
  connections: {
    database: number
    redis: number
    http: number
  }
  fileHandles: {
    open: number
    limit: number
  }
  uptime: number
}

export interface HealthManagerStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  lastHealthy: Date
  checks: Record<string, HealthCheckResult>
  resources: ResourceMetrics
  alerts: HealthAlert[]
}

export interface HealthAlert {
  id: string
  level: 'warning' | 'critical'
  message: string
  timestamp: Date
  resolved: boolean
}

/**
 * Enhanced Health Manager for long-term stability monitoring
 * Builds on existing lifecycle manager with advanced monitoring
 */
export class HealthManager extends EventEmitter {
  private checks: Map<string, HealthCheck> = new Map()
  private checkResults: Map<string, HealthCheckResult[]> = new Map()
  private checkTimers: Map<string, NodeJS.Timeout> = new Map()
  private alerts: Map<string, HealthAlert> = new Map()
  private lastHealthyTime: Date = new Date()
  private isRunning: boolean = false
  private resourceHistory: ResourceMetrics[] = []
  private maxHistorySize: number = 100

  constructor() {
    super()
    this.setupDefaultChecks()
    this.setupLeakDetection()
  }

  /**
   * Start health monitoring
   */
  start(): void {
    if (this.isRunning) return
    
    this.isRunning = true
    console.log('🏥 Health Manager started')
    
    // Start all registered health checks
    for (const [name, check] of this.checks) {
      this.startHealthCheck(name, check)
    }
    
    // Start resource monitoring
    this.startResourceMonitoring()
    
    // Start resource leak detection
    this.startLeakDetection()
    
    this.emit('started')
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (!this.isRunning) return
    
    this.isRunning = false
    
    // Clear all timers
    for (const timer of this.checkTimers.values()) {
      clearInterval(timer)
    }
    this.checkTimers.clear()
    
    // Stop resource leak detection
    this.stopLeakDetection()
    
    console.log('🏥 Health Manager stopped')
    this.emit('stopped')
  }

  /**
   * Register a custom health check
   */
  registerHealthCheck(check: HealthCheck): void {
    this.checks.set(check.name, check)
    this.checkResults.set(check.name, [])
    
    if (this.isRunning) {
      this.startHealthCheck(check.name, check)
    }
    
    console.log(`📋 Registered health check: ${check.name}`)
  }

  /**
   * Get current health status
   */
  async getHealthStatus(): Promise<HealthManagerStatus> {
    const checkResults: Record<string, HealthCheckResult> = {}
    
    // Get latest results for each check
    for (const [name, results] of this.checkResults) {
      if (results.length > 0) {
        checkResults[name] = results[results.length - 1]
      }
    }
    
    // Determine overall health
    const overall = this.calculateOverallHealth(checkResults)
    
    // Update last healthy time
    if (overall === 'healthy') {
      this.lastHealthyTime = new Date()
    }
    
    return {
      overall,
      lastHealthy: this.lastHealthyTime,
      checks: checkResults,
      resources: await this.getResourceMetrics(),
      alerts: Array.from(this.alerts.values()).filter(a => !a.resolved)
    }
  }

  /**
   * Get resource usage metrics
   */
  async getResourceMetrics(): Promise<ResourceMetrics> {
    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    
    // Calculate CPU usage percentage (simplified)
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000 / process.uptime() * 100
    
    const metrics: ResourceMetrics = {
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      cpu: {
        usage: Math.min(cpuPercent, 100),
        loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0]
      },
      connections: {
        database: await this.getDatabaseConnections(),
        redis: await this.getRedisConnections(),
        http: await this.getHttpConnections()
      },
      fileHandles: {
        open: await this.getOpenFileHandles(),
        limit: await this.getFileHandleLimit()
      },
      uptime: lifecycleManager.getUptime()
    }
    
    // Store in history
    this.resourceHistory.push(metrics)
    if (this.resourceHistory.length > this.maxHistorySize) {
      this.resourceHistory.shift()
    }
    
    return metrics
  }

  /**
   * Detect resource leaks by analyzing trends
   */
  detectResourceLeaks(): Array<{ type: string; trend: string; severity: 'warning' | 'critical' }> {
    if (this.resourceHistory.length < 10) return []
    
    const leaks: Array<{ type: string; trend: string; severity: 'warning' | 'critical' }> = []
    const recent = this.resourceHistory.slice(-10)
    const older = this.resourceHistory.slice(-20, -10)
    
    if (older.length === 0) return []
    
    // Check memory trend
    const recentMemAvg = recent.reduce((sum, m) => sum + m.memory.heapUsed, 0) / recent.length
    const olderMemAvg = older.reduce((sum, m) => sum + m.memory.heapUsed, 0) / older.length
    const memGrowth = (recentMemAvg - olderMemAvg) / olderMemAvg * 100
    
    if (memGrowth > 10) {
      leaks.push({
        type: 'memory',
        trend: `+${memGrowth.toFixed(1)}% over last 20 samples`,
        severity: memGrowth > 25 ? 'critical' : 'warning'
      })
    }
    
    // Check file handle trend
    const recentHandlesAvg = recent.reduce((sum, m) => sum + m.fileHandles.open, 0) / recent.length
    const olderHandlesAvg = older.reduce((sum, m) => sum + m.fileHandles.open, 0) / older.length
    const handlesGrowth = (recentHandlesAvg - olderHandlesAvg) / olderHandlesAvg * 100
    
    if (handlesGrowth > 15) {
      leaks.push({
        type: 'file-handles',
        trend: `+${handlesGrowth.toFixed(1)}% over last 20 samples`,
        severity: handlesGrowth > 30 ? 'critical' : 'warning'
      })
    }
    
    return leaks
  }

  /**
   * Trigger graceful shutdown if health is critical
   */
  async gracefulShutdown(reason: string): Promise<void> {
    console.log(`🚨 Health Manager triggering graceful shutdown: ${reason}`)
    
    this.createAlert('critical', `Graceful shutdown triggered: ${reason}`)
    this.emit('shutdown-requested', reason)
    
    // Give the application time to handle the shutdown
    setTimeout(() => {
      if (lifecycleManager.isShutdownInProgress()) return
      
      console.log('🚨 Force shutdown - graceful shutdown timeout')
      process.exit(1)
    }, 30000) // 30 second timeout
  }

  /**
   * Force restart the process (last resort)
   */
  async forceRestart(reason: string): Promise<void> {
    console.log(`🚨 Health Manager forcing restart: ${reason}`)
    
    this.createAlert('critical', `Force restart triggered: ${reason}`)
    this.emit('restart-requested', reason)
    
    // Force exit after short delay
    setTimeout(() => {
      process.exit(1)
    }, 5000)
  }

  /**
   * Setup default health checks
   */
  private setupDefaultChecks(): void {
    // Application responsiveness check
    this.registerHealthCheck({
      name: 'application-responsiveness',
      check: async () => {
        const start = Date.now()
        try {
          const health = lifecycleManager.getHealthStatus()
          const duration = Date.now() - start
          
          return {
            healthy: duration < 1000, // Should respond within 1 second
            message: duration < 1000 ? 'Responsive' : `Slow response: ${duration}ms`,
            duration,
            metadata: { responseTime: duration }
          }
        } catch (error) {
          return {
            healthy: false,
            message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
            duration: Date.now() - start
          }
        }
      },
      interval: 30000, // Every 30 seconds
      timeout: 5000,
      retries: 2,
      successThreshold: 1,
      failureThreshold: 3
    })

    // Memory usage check
    this.registerHealthCheck({
      name: 'memory-usage',
      check: async () => {
        const start = Date.now()
        const memUsage = process.memoryUsage()
        const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100
        
        return {
          healthy: usagePercent < 80,
          message: usagePercent < 80 ? 'Normal' : `High usage: ${usagePercent.toFixed(1)}%`,
          duration: Date.now() - start,
          metadata: { usagePercent, heapUsed: memUsage.heapUsed, heapTotal: memUsage.heapTotal }
        }
      },
      interval: 60000, // Every minute
      timeout: 1000,
      retries: 1,
      successThreshold: 1,
      failureThreshold: 5
    })

    // Database connectivity check
    this.registerHealthCheck({
      name: 'database-connectivity',
      check: async () => {
        const start = Date.now()
        try {
          await memoryDB.getStats()
          return {
            healthy: true,
            message: 'Connected',
            duration: Date.now() - start
          }
        } catch (error) {
          return {
            healthy: false,
            message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown'}`,
            duration: Date.now() - start
          }
        }
      },
      interval: 120000, // Every 2 minutes
      timeout: 5000,
      retries: 3,
      successThreshold: 1,
      failureThreshold: 3
    })
  }

  /**
   * Start monitoring a specific health check
   */
  private startHealthCheck(name: string, check: HealthCheck): void {
    const timer = setInterval(async () => {
      await this.executeHealthCheck(name, check)
    }, check.interval)
    
    this.checkTimers.set(name, timer)
    
    // Execute immediately
    setImmediate(() => this.executeHealthCheck(name, check))
  }

  /**
   * Execute a health check with retries and timeout
   */
  private async executeHealthCheck(name: string, check: HealthCheck): Promise<void> {
    let result: HealthCheckResult
    let attempts = 0
    
    while (attempts <= check.retries) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), check.timeout)
        })
        
        result = await Promise.race([check.check(), timeoutPromise])
        break
      } catch (error) {
        attempts++
        if (attempts > check.retries) {
          result = {
            healthy: false,
            message: `Failed after ${attempts} attempts: ${error instanceof Error ? error.message : 'Unknown'}`,
            duration: check.timeout
          }
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }
    
    // Store result
    const results = this.checkResults.get(name) || []
    results.push(result!)
    
    // Keep only last 10 results
    if (results.length > 10) {
      results.shift()
    }
    
    this.checkResults.set(name, results)
    
    // Check for alerts
    this.checkForAlerts(name, result!)
    
    this.emit('health-check-completed', name, result!)
  }

  /**
   * Calculate overall health from individual checks
   */
  private calculateOverallHealth(checks: Record<string, HealthCheckResult>): 'healthy' | 'degraded' | 'unhealthy' {
    const results = Object.values(checks)
    if (results.length === 0) return 'unhealthy'
    
    const healthyCount = results.filter(r => r.healthy).length
    const healthyPercent = healthyCount / results.length
    
    if (healthyPercent >= 0.8) return 'healthy'
    if (healthyPercent >= 0.5) return 'degraded'
    return 'unhealthy'
  }

  /**
   * Check for alert conditions
   */
  private checkForAlerts(checkName: string, result: HealthCheckResult): void {
    const alertId = `${checkName}-failure`
    
    if (!result.healthy) {
      if (!this.alerts.has(alertId)) {
        this.createAlert('warning', `Health check failed: ${checkName} - ${result.message}`)
      }
    } else {
      // Resolve alert if it exists
      const alert = this.alerts.get(alertId)
      if (alert && !alert.resolved) {
        alert.resolved = true
        this.emit('alert-resolved', alert)
      }
    }
  }

  /**
   * Create a new alert
   */
  private createAlert(level: 'warning' | 'critical', message: string): void {
    const alert: HealthAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      level,
      message,
      timestamp: new Date(),
      resolved: false
    }
    
    this.alerts.set(alert.id, alert)
    this.emit('alert-created', alert)
    
    console.log(`🚨 Health Alert [${level.toUpperCase()}]: ${message}`)
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    const monitorInterval = setInterval(async () => {
      try {
        const metrics = await this.getResourceMetrics()
        
        // Check for resource leaks
        const leaks = this.detectResourceLeaks()
        for (const leak of leaks) {
          this.createAlert(leak.severity, `Resource leak detected: ${leak.type} - ${leak.trend}`)
        }
        
        // Check for critical resource usage
        if (metrics.memory.heapUsed / metrics.memory.heapTotal > 0.9) {
          this.createAlert('critical', `Critical memory usage: ${(metrics.memory.heapUsed / metrics.memory.heapTotal * 100).toFixed(1)}%`)
        }
        
        this.emit('resource-metrics', metrics)
      } catch (error) {
        console.error('Resource monitoring error:', error)
      }
    }, 60000) // Every minute
    
    this.checkTimers.set('resource-monitor', monitorInterval)
  }

  /**
   * Setup resource leak detection integration
   */
  private setupLeakDetection(): void {
    // Set up leak detection event listeners
    resourceLeakDetector.on('leak-detected', (result: LeakDetectionResult) => {
      const alertLevel = result.severity === 'critical' ? 'critical' : 'warning'
      
      this.createAlert(alertLevel, `Resource leak detected: ${result.message}`)
      
      // Emit specific leak event
      this.emit('resource-leak-detected', result)
      
      // If critical memory leak, consider triggering recovery
      if (result.type === 'memory' && result.severity === 'critical') {
        this.emit('critical-memory-leak', result)
      }
    })

    resourceLeakDetector.on('monitoring-started', () => {
      console.log('🔍 Resource leak detection integrated with health manager')
    })

    resourceLeakDetector.on('snapshot-taken', (snapshot) => {
      // Emit resource snapshot for other systems to use
      this.emit('resource-snapshot', snapshot)
    })
  }

  /**
   * Start resource leak detection
   */
  startLeakDetection(): void {
    resourceLeakDetector.start()
  }

  /**
   * Stop resource leak detection
   */
  stopLeakDetection(): void {
    resourceLeakDetector.stop()
  }

  /**
   * Get current resource leak statistics
   */
  getLeakDetectionStats() {
    return resourceLeakDetector.getLeakStatistics()
  }

  /**
   * Get resource usage history
   */
  getResourceHistory(hours: number = 1) {
    return resourceLeakDetector.getUsageHistory(hours)
  }

  // Helper methods for connection counting (simplified implementations)
  private async getDatabaseConnections(): Promise<number> {
    try {
      const stats = await memoryDB.getStats()
      return 1 // Simplified - in real implementation, count actual connections
    } catch {
      return 0
    }
  }

  private async getRedisConnections(): Promise<number> {
    try {
      cache.getStats()
      return 1 // Simplified - in real implementation, count actual connections
    } catch {
      return 0
    }
  }

  private async getHttpConnections(): Promise<number> {
    // Simplified - in real implementation, track active HTTP connections
    return 0
  }

  private async getOpenFileHandles(): Promise<number> {
    // Simplified - in real implementation, count open file descriptors
    return 0
  }

  private async getFileHandleLimit(): Promise<number> {
    // Simplified - in real implementation, get system limits
    return 1024
  }
}

// Global health manager instance
export const healthManager = new HealthManager()

// Integration with lifecycle manager
lifecycleManager.onShutdown(async () => {
  console.log('Stopping health manager...')
  healthManager.stop()
})
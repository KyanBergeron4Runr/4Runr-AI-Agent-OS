import { EventEmitter } from 'events'
import { memoryDB } from '../models/memory-db'
import { cache } from './cache'

export interface ResourceUsageSnapshot {
  timestamp: Date
  memory: {
    heapUsed: number
    heapTotal: number
    external: number
    rss: number
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
  eventListeners: {
    total: number
    byEmitter: Record<string, number>
  }
  timers: {
    active: number
    intervals: number
    timeouts: number
  }
}

export interface LeakDetectionResult {
  type: 'memory' | 'connections' | 'fileHandles' | 'eventListeners' | 'timers'
  severity: 'warning' | 'critical'
  trend: 'increasing' | 'stable' | 'decreasing'
  currentValue: number
  baselineValue: number
  changePercent: number
  timeWindow: number
  message: string
  recommendations: string[]
}

export interface LeakDetectionConfig {
  monitoringInterval: number
  analysisWindow: number
  memoryLeakThreshold: number
  connectionLeakThreshold: number
  fileHandleLeakThreshold: number
  eventListenerLeakThreshold: number
  timerLeakThreshold: number
  historyRetention: number
}

/**
 * Resource Leak Detection System
 * Monitors system resources for potential leaks and provides early warning
 */
export class ResourceLeakDetector extends EventEmitter {
  private config: LeakDetectionConfig
  private snapshots: ResourceUsageSnapshot[] = []
  private isMonitoring: boolean = false
  private monitoringInterval?: NodeJS.Timeout
  private analysisInterval?: NodeJS.Timeout

  constructor(config: Partial<LeakDetectionConfig> = {}) {
    super()
    
    this.config = {
      monitoringInterval: 60000,        // 1 minute
      analysisWindow: 1800000,          // 30 minutes
      memoryLeakThreshold: 20,          // 20% increase
      connectionLeakThreshold: 50,      // 50% increase
      fileHandleLeakThreshold: 30,      // 30% increase
      eventListenerLeakThreshold: 100,  // 100% increase
      timerLeakThreshold: 200,          // 200% increase
      historyRetention: 1440,           // 24 hours of snapshots
      ...config
    }
    
    console.log('🔍 Resource Leak Detector initialized')
  }

  /**
   * Start resource leak monitoring
   */
  start(): void {
    if (this.isMonitoring) {
      console.log('⚠️ Resource Leak Detector already running')
      return
    }

    console.log('🔍 Starting Resource Leak Detection...')
    
    // Take initial snapshot
    this.takeSnapshot()
    
    // Start monitoring interval
    this.monitoringInterval = setInterval(() => {
      this.takeSnapshot()
    }, this.config.monitoringInterval)
    
    // Start analysis interval (every 5 minutes)
    this.analysisInterval = setInterval(() => {
      this.analyzeLeaks()
    }, 300000)
    
    this.isMonitoring = true
    
    console.log('✅ Resource Leak Detection started')
    this.emit('monitoring-started')
  }

  /**
   * Stop resource leak monitoring
   */
  stop(): void {
    if (!this.isMonitoring) return

    console.log('🛑 Stopping Resource Leak Detection...')
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }
    
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval)
      this.analysisInterval = undefined
    }
    
    this.isMonitoring = false
    
    console.log('✅ Resource Leak Detection stopped')
    this.emit('monitoring-stopped')
  }

  /**
   * Take a resource usage snapshot
   */
  async takeSnapshot(): Promise<ResourceUsageSnapshot> {
    try {
      const memUsage = process.memoryUsage()
      
      const snapshot: ResourceUsageSnapshot = {
        timestamp: new Date(),
        memory: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
          rss: memUsage.rss
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
        eventListeners: await this.getEventListenerCount(),
        timers: await this.getTimerCount()
      }
      
      // Add to snapshots
      this.snapshots.push(snapshot)
      
      // Trim history if needed
      if (this.snapshots.length > this.config.historyRetention) {
        this.snapshots.shift()
      }
      
      this.emit('snapshot-taken', snapshot)
      
      return snapshot
      
    } catch (error) {
      console.error('❌ Failed to take resource snapshot:', error)
      throw error
    }
  }

  /**
   * Analyze snapshots for potential leaks
   */
  analyzeLeaks(): LeakDetectionResult[] {
    if (this.snapshots.length < 2) {
      return []
    }

    const results: LeakDetectionResult[] = []
    const analysisWindowStart = Date.now() - this.config.analysisWindow
    
    // Filter snapshots within analysis window
    const recentSnapshots = this.snapshots.filter(
      s => s.timestamp.getTime() >= analysisWindowStart
    )
    
    if (recentSnapshots.length < 2) {
      return []
    }

    const baseline = recentSnapshots[0]
    const current = recentSnapshots[recentSnapshots.length - 1]
    const timeWindow = current.timestamp.getTime() - baseline.timestamp.getTime()

    // Analyze memory leaks
    results.push(...this.analyzeMemoryLeaks(baseline, current, timeWindow))
    
    // Analyze connection leaks
    results.push(...this.analyzeConnectionLeaks(baseline, current, timeWindow))
    
    // Analyze file handle leaks
    results.push(...this.analyzeFileHandleLeaks(baseline, current, timeWindow))
    
    // Analyze event listener leaks
    results.push(...this.analyzeEventListenerLeaks(baseline, current, timeWindow))
    
    // Analyze timer leaks
    results.push(...this.analyzeTimerLeaks(baseline, current, timeWindow))

    // Emit results
    for (const result of results) {
      this.emit('leak-detected', result)
      
      if (result.severity === 'critical') {
        console.log(`🚨 Critical resource leak detected: ${result.message}`)
      } else {
        console.log(`⚠️ Resource leak warning: ${result.message}`)
      }
    }

    return results
  }

  /**
   * Analyze memory usage for leaks
   */
  private analyzeMemoryLeaks(
    baseline: ResourceUsageSnapshot, 
    current: ResourceUsageSnapshot, 
    timeWindow: number
  ): LeakDetectionResult[] {
    const results: LeakDetectionResult[] = []

    // Analyze heap memory
    const heapChange = ((current.memory.heapUsed - baseline.memory.heapUsed) / baseline.memory.heapUsed) * 100
    
    if (Math.abs(heapChange) > this.config.memoryLeakThreshold) {
      const trend = heapChange > 0 ? 'increasing' : 'decreasing'
      const severity = Math.abs(heapChange) > 50 ? 'critical' : 'warning'
      
      results.push({
        type: 'memory',
        severity,
        trend,
        currentValue: current.memory.heapUsed,
        baselineValue: baseline.memory.heapUsed,
        changePercent: heapChange,
        timeWindow,
        message: `Heap memory ${trend} by ${Math.abs(heapChange).toFixed(1)}% over ${Math.round(timeWindow / 60000)} minutes`,
        recommendations: [
          'Check for memory leaks in application code',
          'Review object retention and garbage collection',
          'Monitor for circular references',
          'Consider triggering garbage collection'
        ]
      })
    }

    // Analyze RSS memory
    const rssChange = ((current.memory.rss - baseline.memory.rss) / baseline.memory.rss) * 100
    
    if (Math.abs(rssChange) > this.config.memoryLeakThreshold) {
      const trend = rssChange > 0 ? 'increasing' : 'decreasing'
      const severity = Math.abs(rssChange) > 50 ? 'critical' : 'warning'
      
      results.push({
        type: 'memory',
        severity,
        trend,
        currentValue: current.memory.rss,
        baselineValue: baseline.memory.rss,
        changePercent: rssChange,
        timeWindow,
        message: `RSS memory ${trend} by ${Math.abs(rssChange).toFixed(1)}% over ${Math.round(timeWindow / 60000)} minutes`,
        recommendations: [
          'Check for native memory leaks',
          'Review buffer usage and cleanup',
          'Monitor external library memory usage',
          'Consider process restart if critical'
        ]
      })
    }

    return results
  }

  /**
   * Analyze database and Redis connections for leaks
   */
  private analyzeConnectionLeaks(
    baseline: ResourceUsageSnapshot, 
    current: ResourceUsageSnapshot, 
    timeWindow: number
  ): LeakDetectionResult[] {
    const results: LeakDetectionResult[] = []

    // Database connections
    const dbChange = ((current.connections.database - baseline.connections.database) / Math.max(baseline.connections.database, 1)) * 100
    
    if (dbChange > this.config.connectionLeakThreshold) {
      results.push({
        type: 'connections',
        severity: dbChange > 100 ? 'critical' : 'warning',
        trend: 'increasing',
        currentValue: current.connections.database,
        baselineValue: baseline.connections.database,
        changePercent: dbChange,
        timeWindow,
        message: `Database connections increased by ${dbChange.toFixed(1)}% (${baseline.connections.database} → ${current.connections.database})`,
        recommendations: [
          'Check for unclosed database connections',
          'Review connection pool configuration',
          'Ensure proper connection cleanup in error handlers',
          'Monitor for connection timeout issues'
        ]
      })
    }

    // Redis connections
    const redisChange = ((current.connections.redis - baseline.connections.redis) / Math.max(baseline.connections.redis, 1)) * 100
    
    if (redisChange > this.config.connectionLeakThreshold) {
      results.push({
        type: 'connections',
        severity: redisChange > 100 ? 'critical' : 'warning',
        trend: 'increasing',
        currentValue: current.connections.redis,
        baselineValue: baseline.connections.redis,
        changePercent: redisChange,
        timeWindow,
        message: `Redis connections increased by ${redisChange.toFixed(1)}% (${baseline.connections.redis} → ${current.connections.redis})`,
        recommendations: [
          'Check for unclosed Redis connections',
          'Review Redis client configuration',
          'Ensure proper connection cleanup',
          'Monitor Redis connection pool usage'
        ]
      })
    }

    return results
  }

  /**
   * Analyze file handle usage for leaks
   */
  private analyzeFileHandleLeaks(
    baseline: ResourceUsageSnapshot, 
    current: ResourceUsageSnapshot, 
    timeWindow: number
  ): LeakDetectionResult[] {
    const results: LeakDetectionResult[] = []

    const handleChange = ((current.fileHandles.open - baseline.fileHandles.open) / Math.max(baseline.fileHandles.open, 1)) * 100
    
    if (handleChange > this.config.fileHandleLeakThreshold) {
      const severity = current.fileHandles.open > (current.fileHandles.limit * 0.8) ? 'critical' : 'warning'
      
      results.push({
        type: 'fileHandles',
        severity,
        trend: 'increasing',
        currentValue: current.fileHandles.open,
        baselineValue: baseline.fileHandles.open,
        changePercent: handleChange,
        timeWindow,
        message: `File handles increased by ${handleChange.toFixed(1)}% (${baseline.fileHandles.open} → ${current.fileHandles.open})`,
        recommendations: [
          'Check for unclosed file handles',
          'Review file operations and ensure proper cleanup',
          'Monitor for leaked file descriptors',
          'Ensure streams and files are properly closed'
        ]
      })
    }

    return results
  }

  /**
   * Analyze event listener count for leaks
   */
  private analyzeEventListenerLeaks(
    baseline: ResourceUsageSnapshot, 
    current: ResourceUsageSnapshot, 
    timeWindow: number
  ): LeakDetectionResult[] {
    const results: LeakDetectionResult[] = []

    const listenerChange = ((current.eventListeners.total - baseline.eventListeners.total) / Math.max(baseline.eventListeners.total, 1)) * 100
    
    if (listenerChange > this.config.eventListenerLeakThreshold) {
      results.push({
        type: 'eventListeners',
        severity: listenerChange > 500 ? 'critical' : 'warning',
        trend: 'increasing',
        currentValue: current.eventListeners.total,
        baselineValue: baseline.eventListeners.total,
        changePercent: listenerChange,
        timeWindow,
        message: `Event listeners increased by ${listenerChange.toFixed(1)}% (${baseline.eventListeners.total} → ${current.eventListeners.total})`,
        recommendations: [
          'Check for unremoved event listeners',
          'Review event listener cleanup in component lifecycle',
          'Monitor for memory leaks in event handling',
          'Ensure proper removeListener calls'
        ]
      })
    }

    return results
  }

  /**
   * Analyze timer count for leaks
   */
  private analyzeTimerLeaks(
    baseline: ResourceUsageSnapshot, 
    current: ResourceUsageSnapshot, 
    timeWindow: number
  ): LeakDetectionResult[] {
    const results: LeakDetectionResult[] = []

    const timerChange = ((current.timers.active - baseline.timers.active) / Math.max(baseline.timers.active, 1)) * 100
    
    if (timerChange > this.config.timerLeakThreshold) {
      results.push({
        type: 'timers',
        severity: timerChange > 1000 ? 'critical' : 'warning',
        trend: 'increasing',
        currentValue: current.timers.active,
        baselineValue: baseline.timers.active,
        changePercent: timerChange,
        timeWindow,
        message: `Active timers increased by ${timerChange.toFixed(1)}% (${baseline.timers.active} → ${current.timers.active})`,
        recommendations: [
          'Check for uncleared timers and intervals',
          'Review timer cleanup in error handlers',
          'Monitor for leaked setTimeout/setInterval calls',
          'Ensure proper clearTimeout/clearInterval usage'
        ]
      })
    }

    return results
  }

  /**
   * Get current resource usage summary
   */
  getCurrentUsage(): ResourceUsageSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null
  }

  /**
   * Get resource usage history
   */
  getUsageHistory(hours: number = 1): ResourceUsageSnapshot[] {
    const since = Date.now() - (hours * 60 * 60 * 1000)
    return this.snapshots.filter(s => s.timestamp.getTime() >= since)
  }

  /**
   * Get leak detection statistics
   */
  getLeakStatistics(): {
    monitoringDuration: number
    snapshotCount: number
    averageMemoryUsage: number
    averageConnections: number
    peakMemoryUsage: number
    peakConnections: number
  } {
    if (this.snapshots.length === 0) {
      return {
        monitoringDuration: 0,
        snapshotCount: 0,
        averageMemoryUsage: 0,
        averageConnections: 0,
        peakMemoryUsage: 0,
        peakConnections: 0
      }
    }

    const first = this.snapshots[0]
    const last = this.snapshots[this.snapshots.length - 1]
    const duration = last.timestamp.getTime() - first.timestamp.getTime()

    const memoryUsages = this.snapshots.map(s => s.memory.heapUsed)
    const connectionCounts = this.snapshots.map(s => s.connections.database + s.connections.redis)

    return {
      monitoringDuration: duration,
      snapshotCount: this.snapshots.length,
      averageMemoryUsage: memoryUsages.reduce((sum, val) => sum + val, 0) / memoryUsages.length,
      averageConnections: connectionCounts.reduce((sum, val) => sum + val, 0) / connectionCounts.length,
      peakMemoryUsage: Math.max(...memoryUsages),
      peakConnections: Math.max(...connectionCounts)
    }
  }

  /**
   * Helper methods for resource counting
   */
  private async getDatabaseConnections(): Promise<number> {
    try {
      // This would integrate with your actual database connection pool
      // For now, return a simulated count
      return memoryDB ? 1 : 0
    } catch {
      return 0
    }
  }

  private async getRedisConnections(): Promise<number> {
    try {
      // This would integrate with your actual Redis client
      // For now, return a simulated count
      return cache ? 1 : 0
    } catch {
      return 0
    }
  }

  private async getHttpConnections(): Promise<number> {
    try {
      // This would count active HTTP connections
      // For now, return a simulated count based on process handles
      return process.getActiveResourcesInfo?.()?.filter(r => r.includes('TCP')).length || 0
    } catch {
      return 0
    }
  }

  private async getOpenFileHandles(): Promise<number> {
    try {
      // On Unix systems, count open file descriptors
      if (process.platform !== 'win32') {
        const { execSync } = require('child_process')
        const result = execSync(`lsof -p ${process.pid} | wc -l`, { encoding: 'utf8' })
        return parseInt(result.trim()) || 0
      } else {
        // On Windows, use process handle count (approximation)
        return process.getActiveResourcesInfo?.()?.length || 0
      }
    } catch {
      return 0
    }
  }

  private async getFileHandleLimit(): Promise<number> {
    try {
      if (process.platform !== 'win32') {
        const { execSync } = require('child_process')
        const result = execSync('ulimit -n', { encoding: 'utf8' })
        return parseInt(result.trim()) || 1024
      } else {
        // Windows default approximation
        return 2048
      }
    } catch {
      return 1024
    }
  }

  private async getEventListenerCount(): Promise<{ total: number; byEmitter: Record<string, number> }> {
    try {
      let total = 0
      const byEmitter: Record<string, number> = {}

      // Count listeners on process
      const processListeners = process.listenerCount ? 
        Object.keys(process.eventNames()).reduce((sum, event) => sum + process.listenerCount(event), 0) : 0
      
      total += processListeners
      byEmitter['process'] = processListeners

      return { total, byEmitter }
    } catch {
      return { total: 0, byEmitter: {} }
    }
  }

  private async getTimerCount(): Promise<{ active: number; intervals: number; timeouts: number }> {
    try {
      // Get active handles (includes timers)
      const activeHandles = process.getActiveResourcesInfo?.() || []
      const timerHandles = activeHandles.filter(handle => 
        handle.includes('Timer') || handle.includes('Timeout') || handle.includes('Interval')
      )

      return {
        active: timerHandles.length,
        intervals: timerHandles.filter(h => h.includes('Interval')).length,
        timeouts: timerHandles.filter(h => h.includes('Timeout')).length
      }
    } catch {
      return { active: 0, intervals: 0, timeouts: 0 }
    }
  }
}

// Export singleton instance
export const resourceLeakDetector = new ResourceLeakDetector()
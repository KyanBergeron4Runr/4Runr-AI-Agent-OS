import { EventEmitter } from 'events'
import { promises as fs } from 'fs'
import { join } from 'path'
import { spawn, ChildProcess } from 'child_process'
import { metrics, getMetricsResponse } from './metrics'

export interface SystemMetrics {
  timestamp: Date
  cpu: {
    usage: number
    loadAverage: number[]
  }
  memory: {
    total: number
    used: number
    free: number
    available: number
  }
  disk: {
    total: number
    used: number
    free: number
  }
  network: {
    bytesIn: number
    bytesOut: number
    packetsIn: number
    packetsOut: number
  }
}

export interface DockerMetrics {
  timestamp: Date
  containers: Array<{
    id: string
    name: string
    cpu: number
    memory: {
      usage: number
      limit: number
      percent: number
    }
    network: {
      rx: number
      tx: number
    }
    blockIO: {
      read: number
      write: number
    }
  }>
}

export interface ApplicationMetrics {
  timestamp: Date
  prometheus: string
  parsed: {
    counters: Record<string, number>
    gauges: Record<string, number>
    histograms: Record<string, any>
  }
}

export interface InfrastructureMetrics {
  timestamp: Date
  database: {
    connected: boolean
    responseTime?: number
    error?: string
  }
  redis: {
    connected: boolean
    responseTime?: number
    error?: string
  }
  external: {
    [service: string]: {
      connected: boolean
      responseTime?: number
      error?: string
    }
  }
}

export interface MonitoringSnapshot {
  timestamp: Date
  level: 'application' | 'system' | 'docker' | 'infrastructure'
  data: SystemMetrics | DockerMetrics | ApplicationMetrics | InfrastructureMetrics
  success: boolean
  error?: string
}

/**
 * Multi-Level Monitoring System
 * Collects metrics at different levels and persists data even during application failures
 */
export class MultiLevelMonitor extends EventEmitter {
  private isRunning: boolean = false
  private collectors: Map<string, NodeJS.Timeout> = new Map()
  private storageDir: string
  private maxStorageFiles: number = 100
  private collectionIntervals: Record<string, number>
  private retryAttempts: number = 3
  private retryDelay: number = 1000

  constructor(options: {
    storageDir?: string
    maxStorageFiles?: number
    collectionIntervals?: Record<string, number>
  } = {}) {
    super()
    
    this.storageDir = options.storageDir || 'logs/monitoring'
    this.maxStorageFiles = options.maxStorageFiles || 100
    this.collectionIntervals = {
      application: 30000,    // 30 seconds
      system: 60000,         // 1 minute
      docker: 60000,         // 1 minute
      infrastructure: 120000, // 2 minutes
      ...options.collectionIntervals
    }
  }

  /**
   * Start multi-level monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) return

    console.log('📊 Starting Multi-Level Monitoring System...')
    
    // Ensure storage directory exists
    await fs.mkdir(this.storageDir, { recursive: true })
    
    this.isRunning = true
    
    // Start all collectors
    this.startApplicationMonitoring()
    this.startSystemMonitoring()
    this.startDockerMonitoring()
    this.startInfrastructureMonitoring()
    
    // Start cleanup routine
    this.startCleanupRoutine()
    
    console.log('✅ Multi-Level Monitoring System started')
    this.emit('monitoring-started')
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return

    this.isRunning = false
    
    // Clear all timers
    for (const timer of this.collectors.values()) {
      clearInterval(timer)
    }
    this.collectors.clear()
    
    console.log('🛑 Multi-Level Monitoring System stopped')
    this.emit('monitoring-stopped')
  }

  /**
   * Get recent monitoring data
   */
  async getRecentData(level?: string, limit: number = 10): Promise<MonitoringSnapshot[]> {
    try {
      const files = await fs.readdir(this.storageDir)
      const dataFiles = files
        .filter(f => f.endsWith('.json'))
        .filter(f => !level || f.includes(`-${level}-`))
        .sort()
        .reverse()
        .slice(0, limit)
      
      const snapshots: MonitoringSnapshot[] = []
      
      for (const file of dataFiles) {
        try {
          const content = await fs.readFile(join(this.storageDir, file), 'utf-8')
          const snapshot = JSON.parse(content)
          snapshots.push(snapshot)
        } catch (error) {
          console.warn(`Failed to read monitoring file ${file}:`, error)
        }
      }
      
      return snapshots
    } catch (error) {
      console.error('Failed to get recent monitoring data:', error)
      return []
    }
  }

  /**
   * Query monitoring data by time range
   */
  async queryData(options: {
    level?: string
    startTime?: Date
    endTime?: Date
    limit?: number
  } = {}): Promise<MonitoringSnapshot[]> {
    const { level, startTime, endTime, limit = 100 } = options
    
    try {
      const files = await fs.readdir(this.storageDir)
      const dataFiles = files
        .filter(f => f.endsWith('.json'))
        .filter(f => !level || f.includes(`-${level}-`))
        .sort()
      
      const snapshots: MonitoringSnapshot[] = []
      
      for (const file of dataFiles) {
        if (snapshots.length >= limit) break
        
        try {
          const content = await fs.readFile(join(this.storageDir, file), 'utf-8')
          const snapshot = JSON.parse(content)
          const timestamp = new Date(snapshot.timestamp)
          
          // Filter by time range
          if (startTime && timestamp < startTime) continue
          if (endTime && timestamp > endTime) continue
          
          snapshots.push(snapshot)
        } catch (error) {
          console.warn(`Failed to read monitoring file ${file}:`, error)
        }
      }
      
      return snapshots
    } catch (error) {
      console.error('Failed to query monitoring data:', error)
      return []
    }
  }

  /**
   * Start application-level monitoring
   */
  private startApplicationMonitoring(): void {
    const timer = setInterval(async () => {
      await this.collectApplicationMetrics()
    }, this.collectionIntervals.application)
    
    this.collectors.set('application', timer)
    
    // Collect immediately
    setImmediate(() => this.collectApplicationMetrics())
  }

  /**
   * Start system-level monitoring
   */
  private startSystemMonitoring(): void {
    const timer = setInterval(async () => {
      await this.collectSystemMetrics()
    }, this.collectionIntervals.system)
    
    this.collectors.set('system', timer)
    
    // Collect immediately
    setImmediate(() => this.collectSystemMetrics())
  }

  /**
   * Start Docker monitoring
   */
  private startDockerMonitoring(): void {
    const timer = setInterval(async () => {
      await this.collectDockerMetrics()
    }, this.collectionIntervals.docker)
    
    this.collectors.set('docker', timer)
    
    // Collect immediately
    setImmediate(() => this.collectDockerMetrics())
  }

  /**
   * Start infrastructure monitoring
   */
  private startInfrastructureMonitoring(): void {
    const timer = setInterval(async () => {
      await this.collectInfrastructureMetrics()
    }, this.collectionIntervals.infrastructure)
    
    this.collectors.set('infrastructure', timer)
    
    // Collect immediately
    setImmediate(() => this.collectInfrastructureMetrics())
  }

  /**
   * Collect application metrics (Prometheus)
   */
  private async collectApplicationMetrics(): Promise<void> {
    await this.withRetry('application', async () => {
      try {
        const prometheusData = getMetricsResponse()
        const parsed = this.parsePrometheusMetrics(prometheusData)
        
        const metrics: ApplicationMetrics = {
          timestamp: new Date(),
          prometheus: prometheusData,
          parsed
        }
        
        await this.storeSnapshot({
          timestamp: new Date(),
          level: 'application',
          data: metrics,
          success: true
        })
        
        this.emit('metrics-collected', 'application', metrics)
      } catch (error) {
        throw new Error(`Application metrics collection failed: ${error}`)
      }
    })
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    await this.withRetry('system', async () => {
      try {
        const metrics: SystemMetrics = {
          timestamp: new Date(),
          cpu: await this.getCpuMetrics(),
          memory: await this.getMemoryMetrics(),
          disk: await this.getDiskMetrics(),
          network: await this.getNetworkMetrics()
        }
        
        await this.storeSnapshot({
          timestamp: new Date(),
          level: 'system',
          data: metrics,
          success: true
        })
        
        this.emit('metrics-collected', 'system', metrics)
      } catch (error) {
        throw new Error(`System metrics collection failed: ${error}`)
      }
    })
  }

  /**
   * Collect Docker metrics
   */
  private async collectDockerMetrics(): Promise<void> {
    await this.withRetry('docker', async () => {
      try {
        const containers = await this.getDockerStats()
        
        const metrics: DockerMetrics = {
          timestamp: new Date(),
          containers
        }
        
        await this.storeSnapshot({
          timestamp: new Date(),
          level: 'docker',
          data: metrics,
          success: true
        })
        
        this.emit('metrics-collected', 'docker', metrics)
      } catch (error) {
        throw new Error(`Docker metrics collection failed: ${error}`)
      }
    })
  }

  /**
   * Collect infrastructure metrics
   */
  private async collectInfrastructureMetrics(): Promise<void> {
    await this.withRetry('infrastructure', async () => {
      try {
        const metrics: InfrastructureMetrics = {
          timestamp: new Date(),
          database: await this.checkDatabaseHealth(),
          redis: await this.checkRedisHealth(),
          external: await this.checkExternalServices()
        }
        
        await this.storeSnapshot({
          timestamp: new Date(),
          level: 'infrastructure',
          data: metrics,
          success: true
        })
        
        this.emit('metrics-collected', 'infrastructure', metrics)
      } catch (error) {
        throw new Error(`Infrastructure metrics collection failed: ${error}`)
      }
    })
  }

  /**
   * Execute with retry logic
   */
  private async withRetry(level: string, operation: () => Promise<void>): Promise<void> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        await operation()
        return
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempt < this.retryAttempts) {
          console.warn(`${level} metrics collection attempt ${attempt} failed, retrying...`)
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt))
        }
      }
    }
    
    // All retries failed, store failure snapshot
    await this.storeSnapshot({
      timestamp: new Date(),
      level: level as any,
      data: {} as any,
      success: false,
      error: lastError?.message || 'Unknown error'
    })
    
    this.emit('collection-failed', level, lastError)
  }

  /**
   * Store monitoring snapshot to disk
   */
  private async storeSnapshot(snapshot: MonitoringSnapshot): Promise<void> {
    try {
      const timestamp = snapshot.timestamp.toISOString().replace(/[:.]/g, '-')
      const filename = `${timestamp}-${snapshot.level}-${snapshot.success ? 'success' : 'failed'}.json`
      const filepath = join(this.storageDir, filename)
      
      await fs.writeFile(filepath, JSON.stringify(snapshot, null, 2))
    } catch (error) {
      console.error('Failed to store monitoring snapshot:', error)
    }
  }

  /**
   * Parse Prometheus metrics into structured data
   */
  private parsePrometheusMetrics(prometheusData: string): {
    counters: Record<string, number>
    gauges: Record<string, number>
    histograms: Record<string, any>
  } {
    const counters: Record<string, number> = {}
    const gauges: Record<string, number> = {}
    const histograms: Record<string, any> = {}
    
    const lines = prometheusData.split('\n')
    
    for (const line of lines) {
      if (line.startsWith('#') || !line.trim()) continue
      
      const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*(?:\{[^}]*\})?) (.+)$/)
      if (!match) continue
      
      const [, metricName, value] = match
      const numValue = parseFloat(value)
      
      if (metricName.includes('_total')) {
        counters[metricName] = numValue
      } else if (metricName.includes('_bucket') || metricName.includes('_sum') || metricName.includes('_count')) {
        histograms[metricName] = numValue
      } else {
        gauges[metricName] = numValue
      }
    }
    
    return { counters, gauges, histograms }
  }

  /**
   * Get CPU metrics
   */
  private async getCpuMetrics(): Promise<SystemMetrics['cpu']> {
    const cpuUsage = process.cpuUsage()
    const uptime = process.uptime()
    
    // Calculate CPU percentage (simplified)
    const cpuPercent = ((cpuUsage.user + cpuUsage.system) / 1000000) / uptime * 100
    
    return {
      usage: Math.min(cpuPercent, 100),
      loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0]
    }
  }

  /**
   * Get memory metrics
   */
  private async getMemoryMetrics(): Promise<SystemMetrics['memory']> {
    const memUsage = process.memoryUsage()
    const totalMem = require('os').totalmem()
    const freeMem = require('os').freemem()
    
    return {
      total: totalMem,
      used: totalMem - freeMem,
      free: freeMem,
      available: freeMem
    }
  }

  /**
   * Get disk metrics (simplified)
   */
  private async getDiskMetrics(): Promise<SystemMetrics['disk']> {
    // Simplified implementation - in production, use proper disk monitoring
    return {
      total: 1000000000, // 1GB placeholder
      used: 500000000,   // 500MB placeholder
      free: 500000000    // 500MB placeholder
    }
  }

  /**
   * Get network metrics (simplified)
   */
  private async getNetworkMetrics(): Promise<SystemMetrics['network']> {
    // Simplified implementation - in production, use proper network monitoring
    return {
      bytesIn: 0,
      bytesOut: 0,
      packetsIn: 0,
      packetsOut: 0
    }
  }

  /**
   * Get Docker stats
   */
  private async getDockerStats(): Promise<DockerMetrics['containers']> {
    return new Promise((resolve, reject) => {
      const docker = spawn('docker', ['stats', '--no-stream', '--format', 'table {{.Container}}\t{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}'])
      
      let output = ''
      let errorOutput = ''
      
      docker.stdout.on('data', (data) => {
        output += data.toString()
      })
      
      docker.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })
      
      docker.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Docker stats failed: ${errorOutput}`))
          return
        }
        
        try {
          const containers = this.parseDockerStats(output)
          resolve(containers)
        } catch (error) {
          reject(error)
        }
      })
      
      // Timeout after 10 seconds
      setTimeout(() => {
        docker.kill()
        reject(new Error('Docker stats timeout'))
      }, 10000)
    })
  }

  /**
   * Parse Docker stats output
   */
  private parseDockerStats(output: string): DockerMetrics['containers'] {
    const lines = output.trim().split('\n').slice(1) // Skip header
    const containers: DockerMetrics['containers'] = []
    
    for (const line of lines) {
      const parts = line.split('\t')
      if (parts.length < 6) continue
      
      const [id, name, cpuPerc, memUsage, netIO, blockIO] = parts
      
      // Parse CPU percentage
      const cpu = parseFloat(cpuPerc.replace('%', '')) || 0
      
      // Parse memory usage (e.g., "123.4MiB / 1.5GiB")
      const memMatch = memUsage.match(/([0-9.]+)([A-Za-z]+) \/ ([0-9.]+)([A-Za-z]+)/)
      let memoryUsage = 0, memoryLimit = 0, memoryPercent = 0
      
      if (memMatch) {
        memoryUsage = this.parseSize(memMatch[1], memMatch[2])
        memoryLimit = this.parseSize(memMatch[3], memMatch[4])
        memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0
      }
      
      // Parse network I/O (e.g., "1.2kB / 3.4kB")
      const netMatch = netIO.match(/([0-9.]+)([A-Za-z]+) \/ ([0-9.]+)([A-Za-z]+)/)
      let netRx = 0, netTx = 0
      
      if (netMatch) {
        netRx = this.parseSize(netMatch[1], netMatch[2])
        netTx = this.parseSize(netMatch[3], netMatch[4])
      }
      
      // Parse block I/O (e.g., "5.6MB / 7.8MB")
      const blockMatch = blockIO.match(/([0-9.]+)([A-Za-z]+) \/ ([0-9.]+)([A-Za-z]+)/)
      let blockRead = 0, blockWrite = 0
      
      if (blockMatch) {
        blockRead = this.parseSize(blockMatch[1], blockMatch[2])
        blockWrite = this.parseSize(blockMatch[3], blockMatch[4])
      }
      
      containers.push({
        id: id.substring(0, 12), // Short ID
        name,
        cpu,
        memory: {
          usage: memoryUsage,
          limit: memoryLimit,
          percent: memoryPercent
        },
        network: {
          rx: netRx,
          tx: netTx
        },
        blockIO: {
          read: blockRead,
          write: blockWrite
        }
      })
    }
    
    return containers
  }

  /**
   * Parse size string to bytes
   */
  private parseSize(value: string, unit: string): number {
    const num = parseFloat(value)
    const unitLower = unit.toLowerCase()
    
    const multipliers: Record<string, number> = {
      'b': 1,
      'kb': 1024,
      'mb': 1024 * 1024,
      'gb': 1024 * 1024 * 1024,
      'kib': 1024,
      'mib': 1024 * 1024,
      'gib': 1024 * 1024 * 1024
    }
    
    return num * (multipliers[unitLower] || 1)
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<InfrastructureMetrics['database']> {
    try {
      const start = Date.now()
      
      // Try to import and use the database
      const { memoryDB } = await import('../models/memory-db')
      await memoryDB.getStats()
      
      const responseTime = Date.now() - start
      
      return {
        connected: true,
        responseTime
      }
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedisHealth(): Promise<InfrastructureMetrics['redis']> {
    try {
      const start = Date.now()
      
      // Try to import and use the cache
      const { cache } = await import('../runtime/cache')
      cache.getStats()
      
      const responseTime = Date.now() - start
      
      return {
        connected: true,
        responseTime
      }
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Check external services health
   */
  private async checkExternalServices(): Promise<InfrastructureMetrics['external']> {
    // Placeholder for external service checks
    // In production, you'd check actual external dependencies
    return {}
  }

  /**
   * Start cleanup routine to manage storage
   */
  private startCleanupRoutine(): void {
    const timer = setInterval(async () => {
      await this.cleanupOldFiles()
    }, 3600000) // Every hour
    
    this.collectors.set('cleanup', timer)
  }

  /**
   * Clean up old monitoring files
   */
  private async cleanupOldFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.storageDir)
      const dataFiles = files
        .filter(f => f.endsWith('.json'))
        .sort()
      
      if (dataFiles.length > this.maxStorageFiles) {
        const filesToDelete = dataFiles.slice(0, dataFiles.length - this.maxStorageFiles)
        
        for (const file of filesToDelete) {
          try {
            await fs.unlink(join(this.storageDir, file))
          } catch (error) {
            console.warn(`Failed to delete old monitoring file ${file}:`, error)
          }
        }
        
        console.log(`🧹 Cleaned up ${filesToDelete.length} old monitoring files`)
      }
    } catch (error) {
      console.error('Failed to cleanup old monitoring files:', error)
    }
  }
}

// Export singleton instance
export const multiLevelMonitor = new MultiLevelMonitor()
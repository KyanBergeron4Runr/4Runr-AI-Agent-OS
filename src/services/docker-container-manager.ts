import { EventEmitter } from 'events'
import { executeCommand } from '../utils/cross-platform-executor'
import { platformOptimizer } from '../utils/platform-optimizations'

export interface ContainerInfo {
  id: string
  name: string
  image: string
  status: string
  state: string
  health: string
  ports: string[]
  created: Date
  started?: Date
  uptime: number
  restartCount: number
}

export interface ContainerStats {
  containerId: string
  containerName: string
  cpuPercent: number
  memoryUsage: number
  memoryLimit: number
  memoryPercent: number
  networkRx: number
  networkTx: number
  blockRead: number
  blockWrite: number
  pids: number
  timestamp: Date
}

export interface ContainerHealthCheck {
  containerId: string
  containerName: string
  status: 'healthy' | 'unhealthy' | 'starting' | 'none'
  failingStreak: number
  log: HealthCheckLog[]
  lastCheck: Date
}

export interface HealthCheckLog {
  timestamp: Date
  exitCode: number
  output: string
  duration: number
}

export interface ContainerRestartPolicy {
  name: 'no' | 'always' | 'unless-stopped' | 'on-failure'
  maximumRetryCount?: number
  delay?: number
  window?: number
}

export interface ContainerResourceLimits {
  memory?: string
  cpus?: string
  swap?: string
  kernelMemory?: string
  oomKillDisable?: boolean
}

export interface ContainerManagementConfig {
  healthCheckInterval: number
  statsCollectionInterval: number
  restartBackoffMultiplier: number
  maxRestartAttempts: number
  healthCheckTimeout: number
  containerTimeout: number
  logRetention: number
}

/**
 * Enhanced Docker Container Manager
 * Provides comprehensive container lifecycle management, health monitoring,
 * and resource management with proper restart policies and failure handling
 */
export class DockerContainerManager extends EventEmitter {
  private config: ContainerManagementConfig
  private containers: Map<string, ContainerInfo> = new Map()
  private healthChecks: Map<string, ContainerHealthCheck> = new Map()
  private stats: Map<string, ContainerStats[]> = new Map()
  private restartAttempts: Map<string, number> = new Map()
  private isMonitoring: boolean = false
  private monitoringInterval?: NodeJS.Timeout
  private statsInterval?: NodeJS.Timeout

  constructor(config: Partial<ContainerManagementConfig> = {}) {
    super()
    
    this.config = {
      healthCheckInterval: 30000,      // 30 seconds
      statsCollectionInterval: 60000,  // 1 minute
      restartBackoffMultiplier: 2,
      maxRestartAttempts: 3,
      healthCheckTimeout: 10000,       // 10 seconds
      containerTimeout: 30000,         // 30 seconds
      logRetention: 100,               // Keep last 100 health check logs
      ...config
    }
    
    console.log('🐳 Docker Container Manager initialized')
  }

  /**
   * Start container monitoring
   */
  async start(): Promise<void> {
    if (this.isMonitoring) {
      console.log('⚠️ Container monitoring already running')
      return
    }

    console.log('🐳 Starting Docker Container Manager...')
    
    try {
      // Initial container discovery
      await this.discoverContainers()
      
      // Start monitoring intervals
      this.monitoringInterval = setInterval(async () => {
        await this.monitorContainers()
      }, this.config.healthCheckInterval)
      
      this.statsInterval = setInterval(async () => {
        await this.collectContainerStats()
      }, this.config.statsCollectionInterval)
      
      this.isMonitoring = true
      
      console.log('✅ Docker Container Manager started')
      this.emit('manager-started')
      
    } catch (error) {
      console.error('❌ Failed to start Docker Container Manager:', error)
      throw error
    }
  }

  /**
   * Stop container monitoring
   */
  async stop(): Promise<void> {
    if (!this.isMonitoring) return

    console.log('🛑 Stopping Docker Container Manager...')
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }
    
    if (this.statsInterval) {
      clearInterval(this.statsInterval)
      this.statsInterval = undefined
    }
    
    this.isMonitoring = false
    
    console.log('✅ Docker Container Manager stopped')
    this.emit('manager-stopped')
  }

  /**
   * Discover all containers
   */
  async discoverContainers(): Promise<ContainerInfo[]> {
    try {
      console.log('🔍 Discovering Docker containers...')
      
      const result = await executeCommand('docker', ['ps', '-a', '--format', 'json'], {
        timeout: this.config.containerTimeout
      })
      
      if (!result.success) {
        throw new Error(`Failed to list containers: ${result.stderr}`)
      }
      
      const containers: ContainerInfo[] = []
      const lines = result.stdout.trim().split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        try {
          const containerData = JSON.parse(line)
          const container = await this.parseContainerInfo(containerData)
          containers.push(container)
          this.containers.set(container.id, container)
        } catch (error) {
          console.log('⚠️ Failed to parse container info:', error)
        }
      }
      
      console.log(`📦 Discovered ${containers.length} containers`)
      this.emit('containers-discovered', containers)
      
      return containers
    } catch (error) {
      console.error('❌ Container discovery failed:', error)
      throw error
    }
  }

  /**
   * Monitor container health and status
   */
  async monitorContainers(): Promise<void> {
    try {
      const containers = await this.discoverContainers()
      
      for (const container of containers) {
        await this.checkContainerHealth(container)
        
        // Handle unhealthy containers
        if (container.status === 'exited' || container.health === 'unhealthy') {
          await this.handleUnhealthyContainer(container)
        }
      }
      
      this.emit('monitoring-cycle-complete', containers.length)
      
    } catch (error) {
      console.error('❌ Container monitoring failed:', error)
      this.emit('monitoring-error', error)
    }
  }

  /**
   * Collect container statistics
   */
  async collectContainerStats(): Promise<void> {
    try {
      const runningContainers = Array.from(this.containers.values())
        .filter(c => c.status === 'running')
      
      if (runningContainers.length === 0) {
        return
      }
      
      const containerIds = runningContainers.map(c => c.id)
      
      const result = await executeCommand('docker', [
        'stats', '--no-stream', '--format', 'json', ...containerIds
      ], {
        timeout: this.config.containerTimeout
      })
      
      if (!result.success) {
        console.log('⚠️ Failed to collect container stats:', result.stderr)
        return
      }
      
      const lines = result.stdout.trim().split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        try {
          const statsData = JSON.parse(line)
          const stats = this.parseContainerStats(statsData)
          
          if (!this.stats.has(stats.containerId)) {
            this.stats.set(stats.containerId, [])
          }
          
          const containerStats = this.stats.get(stats.containerId)!
          containerStats.push(stats)
          
          // Keep only recent stats
          if (containerStats.length > this.config.logRetention) {
            containerStats.shift()
          }
          
          this.emit('stats-collected', stats)
          
        } catch (error) {
          console.log('⚠️ Failed to parse container stats:', error)
        }
      }
      
    } catch (error) {
      console.error('❌ Stats collection failed:', error)
    }
  }

  /**
   * Check individual container health
   */
  async checkContainerHealth(container: ContainerInfo): Promise<ContainerHealthCheck> {
    const startTime = Date.now()
    
    try {
      const result = await executeCommand('docker', [
        'inspect', container.id, '--format', '{{json .State.Health}}'
      ], {
        timeout: this.config.healthCheckTimeout
      })
      
      let healthStatus: ContainerHealthCheck = {
        containerId: container.id,
        containerName: container.name,
        status: 'none',
        failingStreak: 0,
        log: [],
        lastCheck: new Date()
      }
      
      if (result.success && result.stdout.trim() !== 'null') {
        const healthData = JSON.parse(result.stdout.trim())
        healthStatus = this.parseHealthCheck(container, healthData)
      } else {
        // No health check configured, check if container is running
        healthStatus.status = container.status === 'running' ? 'healthy' : 'unhealthy'
      }
      
      const duration = Date.now() - startTime
      
      // Add to health check log
      healthStatus.log.push({
        timestamp: new Date(),
        exitCode: result.success ? 0 : 1,
        output: result.stdout || result.stderr,
        duration
      })
      
      // Keep only recent logs
      if (healthStatus.log.length > this.config.logRetention) {
        healthStatus.log.shift()
      }
      
      this.healthChecks.set(container.id, healthStatus)
      this.emit('health-check-complete', healthStatus)
      
      return healthStatus
      
    } catch (error) {
      console.error(`❌ Health check failed for ${container.name}:`, error)
      
      const healthStatus: ContainerHealthCheck = {
        containerId: container.id,
        containerName: container.name,
        status: 'unhealthy',
        failingStreak: (this.healthChecks.get(container.id)?.failingStreak || 0) + 1,
        log: [{
          timestamp: new Date(),
          exitCode: 1,
          output: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime
        }],
        lastCheck: new Date()
      }
      
      this.healthChecks.set(container.id, healthStatus)
      this.emit('health-check-failed', healthStatus)
      
      return healthStatus
    }
  }

  /**
   * Handle unhealthy containers
   */
  async handleUnhealthyContainer(container: ContainerInfo): Promise<void> {
    const currentAttempts = this.restartAttempts.get(container.id) || 0
    
    if (currentAttempts >= this.config.maxRestartAttempts) {
      console.log(`🚨 Container ${container.name} exceeded max restart attempts (${currentAttempts})`)
      this.emit('container-failed', container, currentAttempts)
      return
    }
    
    console.log(`🔄 Attempting to restart unhealthy container: ${container.name} (attempt ${currentAttempts + 1})`)
    
    try {
      // Calculate backoff delay
      const delay = Math.pow(this.config.restartBackoffMultiplier, currentAttempts) * 1000
      
      if (delay > 0) {
        console.log(`⏳ Waiting ${delay}ms before restart attempt...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      
      // Attempt restart
      const success = await this.restartContainer(container.id)
      
      if (success) {
        console.log(`✅ Successfully restarted container: ${container.name}`)
        this.restartAttempts.delete(container.id) // Reset attempts on success
        this.emit('container-restarted', container, currentAttempts + 1)
      } else {
        this.restartAttempts.set(container.id, currentAttempts + 1)
        this.emit('container-restart-failed', container, currentAttempts + 1)
      }
      
    } catch (error) {
      console.error(`❌ Failed to restart container ${container.name}:`, error)
      this.restartAttempts.set(container.id, currentAttempts + 1)
      this.emit('container-restart-error', container, error)
    }
  }

  /**
   * Restart a container
   */
  async restartContainer(containerId: string): Promise<boolean> {
    try {
      const result = await executeCommand('docker', ['restart', containerId], {
        timeout: this.config.containerTimeout,
        retries: 1
      })
      
      return result.success
    } catch (error) {
      console.error(`❌ Container restart failed: ${error}`)
      return false
    }
  }

  /**
   * Stop a container gracefully
   */
  async stopContainer(containerId: string, timeout: number = 10): Promise<boolean> {
    try {
      const result = await executeCommand('docker', ['stop', '-t', timeout.toString(), containerId], {
        timeout: (timeout + 5) * 1000
      })
      
      return result.success
    } catch (error) {
      console.error(`❌ Container stop failed: ${error}`)
      return false
    }
  }

  /**
   * Start a container
   */
  async startContainer(containerId: string): Promise<boolean> {
    try {
      const result = await executeCommand('docker', ['start', containerId], {
        timeout: this.config.containerTimeout
      })
      
      return result.success
    } catch (error) {
      console.error(`❌ Container start failed: ${error}`)
      return false
    }
  }

  /**
   * Get container information
   */
  getContainer(containerId: string): ContainerInfo | undefined {
    return this.containers.get(containerId)
  }

  /**
   * Get all containers
   */
  getAllContainers(): ContainerInfo[] {
    return Array.from(this.containers.values())
  }

  /**
   * Get container health status
   */
  getContainerHealth(containerId: string): ContainerHealthCheck | undefined {
    return this.healthChecks.get(containerId)
  }

  /**
   * Get container statistics
   */
  getContainerStats(containerId: string, limit?: number): ContainerStats[] {
    const stats = this.stats.get(containerId) || []
    return limit ? stats.slice(-limit) : stats
  }

  /**
   * Get container management status
   */
  getManagerStatus(): {
    isMonitoring: boolean
    containerCount: number
    healthyContainers: number
    unhealthyContainers: number
    runningContainers: number
    restartAttempts: number
  } {
    const containers = Array.from(this.containers.values())
    const healthChecks = Array.from(this.healthChecks.values())
    
    return {
      isMonitoring: this.isMonitoring,
      containerCount: containers.length,
      healthyContainers: healthChecks.filter(h => h.status === 'healthy').length,
      unhealthyContainers: healthChecks.filter(h => h.status === 'unhealthy').length,
      runningContainers: containers.filter(c => c.status === 'running').length,
      restartAttempts: Array.from(this.restartAttempts.values()).reduce((sum, attempts) => sum + attempts, 0)
    }
  }

  /**
   * Parse container information from Docker output
   */
  private async parseContainerInfo(containerData: any): Promise<ContainerInfo> {
    const created = new Date(containerData.CreatedAt)
    const uptime = containerData.Status?.includes('Up') 
      ? this.parseUptime(containerData.Status) 
      : 0
    
    return {
      id: containerData.ID,
      name: containerData.Names,
      image: containerData.Image,
      status: containerData.State,
      state: containerData.Status,
      health: this.parseHealthStatus(containerData.Status),
      ports: containerData.Ports ? containerData.Ports.split(', ') : [],
      created,
      started: containerData.State === 'running' ? new Date(Date.now() - uptime) : undefined,
      uptime,
      restartCount: 0 // Will be updated from inspect if needed
    }
  }

  /**
   * Parse container statistics from Docker output
   */
  private parseContainerStats(statsData: any): ContainerStats {
    return {
      containerId: statsData.Container,
      containerName: statsData.Name,
      cpuPercent: parseFloat(statsData.CPUPerc?.replace('%', '') || '0'),
      memoryUsage: this.parseMemoryValue(statsData.MemUsage?.split(' / ')[0] || '0B'),
      memoryLimit: this.parseMemoryValue(statsData.MemUsage?.split(' / ')[1] || '0B'),
      memoryPercent: parseFloat(statsData.MemPerc?.replace('%', '') || '0'),
      networkRx: this.parseNetworkValue(statsData.NetIO?.split(' / ')[0] || '0B'),
      networkTx: this.parseNetworkValue(statsData.NetIO?.split(' / ')[1] || '0B'),
      blockRead: this.parseNetworkValue(statsData.BlockIO?.split(' / ')[0] || '0B'),
      blockWrite: this.parseNetworkValue(statsData.BlockIO?.split(' / ')[1] || '0B'),
      pids: parseInt(statsData.PIDs || '0'),
      timestamp: new Date()
    }
  }

  /**
   * Parse health check information
   */
  private parseHealthCheck(container: ContainerInfo, healthData: any): ContainerHealthCheck {
    const existing = this.healthChecks.get(container.id)
    
    return {
      containerId: container.id,
      containerName: container.name,
      status: healthData.Status?.toLowerCase() || 'none',
      failingStreak: healthData.FailingStreak || 0,
      log: existing?.log || [],
      lastCheck: new Date()
    }
  }

  /**
   * Parse health status from container status string
   */
  private parseHealthStatus(status: string): string {
    if (status.includes('(healthy)')) return 'healthy'
    if (status.includes('(unhealthy)')) return 'unhealthy'
    if (status.includes('(health: starting)')) return 'starting'
    return 'none'
  }

  /**
   * Parse uptime from status string
   */
  private parseUptime(status: string): number {
    const match = status.match(/Up (\d+) (\w+)/)
    if (!match) return 0
    
    const value = parseInt(match[1])
    const unit = match[2]
    
    switch (unit) {
      case 'second':
      case 'seconds': return value * 1000
      case 'minute':
      case 'minutes': return value * 60 * 1000
      case 'hour':
      case 'hours': return value * 60 * 60 * 1000
      case 'day':
      case 'days': return value * 24 * 60 * 60 * 1000
      default: return 0
    }
  }

  /**
   * Parse memory value (e.g., "1.5GiB" -> bytes)
   */
  private parseMemoryValue(value: string): number {
    const match = value.match(/^([\d.]+)(\w+)$/)
    if (!match) return 0
    
    const num = parseFloat(match[1])
    const unit = match[2].toLowerCase()
    
    switch (unit) {
      case 'b': return num
      case 'kb': case 'kib': return num * 1024
      case 'mb': case 'mib': return num * 1024 * 1024
      case 'gb': case 'gib': return num * 1024 * 1024 * 1024
      case 'tb': case 'tib': return num * 1024 * 1024 * 1024 * 1024
      default: return num
    }
  }

  /**
   * Parse network value (same as memory)
   */
  private parseNetworkValue(value: string): number {
    return this.parseMemoryValue(value)
  }
}

// Export singleton instance
export const dockerContainerManager = new DockerContainerManager()
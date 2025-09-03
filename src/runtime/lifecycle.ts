import { memoryDB } from '../models/memory-db'
import { circuitBreakerRegistry } from './circuit'
import { cache } from './cache'

export interface HealthStatus {
  ok: boolean
  timestamp: string
  uptime: number
  memory: {
    used: number
    total: number
    external: number
  }
  process: {
    pid: number
    version: string
    platform: string
  }
}

export interface ReadinessStatus {
  ready: boolean
  timestamp: string
  checks: {
    database: boolean
    circuitBreakers: Record<string, boolean>
    cache: boolean
  }
  details: {
    database: string
    circuitBreakers: Record<string, string>
    cache: string
  }
}

class LifecycleManager {
  private startTime: number
  private isShuttingDown: boolean = false
  private shutdownCallbacks: Array<() => Promise<void>> = []

  constructor() {
    this.startTime = Date.now()
    this.setupGracefulShutdown()
  }

  getHealthStatus(): HealthStatus {
    const memUsage = process.memoryUsage()
    
    // Enhanced health status with more detailed memory info
    return {
      ok: !this.isShuttingDown,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        external: memUsage.external
      },
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform
      }
    }
  }

  async getReadinessStatus(): Promise<ReadinessStatus> {
    const checks = {
      database: true,
      circuitBreakers: {} as Record<string, boolean>,
      cache: true
    }

    const details = {
      database: 'OK',
      circuitBreakers: {} as Record<string, string>,
      cache: 'OK'
    }

    // Check database
    try {
      await memoryDB.getStats()
    } catch (error) {
      checks.database = false
      details.database = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }

    // Check circuit breakers
    const breakerStats = circuitBreakerRegistry.getBreakerStats()
    for (const [tool, stats] of Object.entries(breakerStats)) {
      const isReady = stats.state !== 'OPEN'
      checks.circuitBreakers[tool] = isReady
      details.circuitBreakers[tool] = isReady ? 'OK' : `OPEN (${stats.failureCount} failures)`
    }

    // Check cache
    try {
      const cacheStats = cache.getStats()
      if (cacheStats.size > cacheStats.maxSize * 0.9) {
        checks.cache = false
        details.cache = `High usage: ${cacheStats.size}/${cacheStats.maxSize}`
      }
    } catch (error) {
      checks.cache = false
      details.cache = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }

    const ready = checks.database && 
                  Object.values(checks.circuitBreakers).every(Boolean) && 
                  checks.cache

    return {
      ready,
      timestamp: new Date().toISOString(),
      checks,
      details
    }
  }

  onShutdown(callback: () => Promise<void>): void {
    this.shutdownCallbacks.push(callback)
  }

  private setupGracefulShutdown(): void {
    const signals = ['SIGTERM', 'SIGINT']
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        console.log(`\nReceived ${signal}, starting graceful shutdown...`)
        await this.shutdown()
      })
    })

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught Exception:', error)
      await this.shutdown(1)
    })

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason)
      await this.shutdown(1)
    })
  }

  private async shutdown(exitCode: number = 0): Promise<void> {
    if (this.isShuttingDown) {
      console.log('Shutdown already in progress...')
      return
    }

    this.isShuttingDown = true
    console.log('Starting graceful shutdown...')

    try {
      // Execute shutdown callbacks
      const shutdownPromises = this.shutdownCallbacks.map(async (callback, index) => {
        try {
          await callback()
          console.log(`Shutdown callback ${index + 1} completed`)
        } catch (error) {
          console.error(`Shutdown callback ${index + 1} failed:`, error)
        }
      })

      // Wait for all callbacks with timeout
      await Promise.race([
        Promise.all(shutdownPromises),
        new Promise(resolve => setTimeout(resolve, 10000)) // 10 second timeout
      ])

      console.log('Graceful shutdown completed')
    } catch (error) {
      console.error('Error during shutdown:', error)
    } finally {
      process.exit(exitCode)
    }
  }

  isShutdownInProgress(): boolean {
    return this.isShuttingDown
  }

  getUptime(): number {
    return Date.now() - this.startTime
  }
}

// Global lifecycle manager instance
export const lifecycleManager = new LifecycleManager()

// Default shutdown handlers
lifecycleManager.onShutdown(async () => {
  console.log('Flushing logs...')
  // Any log flushing logic would go here
})

lifecycleManager.onShutdown(async () => {
  console.log('Closing database connections...')
  // Any database cleanup would go here
})

lifecycleManager.onShutdown(async () => {
  console.log('Clearing caches...')
  cache.clear()
})

// Utility functions
export function getHealthStatus(): HealthStatus {
  return lifecycleManager.getHealthStatus()
}

export async function getReadinessStatus(): Promise<ReadinessStatus> {
  return lifecycleManager.getReadinessStatus()
}

export function onShutdown(callback: () => Promise<void>): void {
  lifecycleManager.onShutdown(callback)
}

export function isShutdownInProgress(): boolean {
  return lifecycleManager.isShutdownInProgress()
}

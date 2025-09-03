import { Semaphore } from 'async-mutex'
import { setBreakerState, recordBreakerFastFail } from '../observability/metrics'

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold: number
  windowMs: number
  openMs: number
  bulkheadConcurrency: number
}

export interface CircuitBreakerStats {
  state: CircuitState
  failureCount: number
  successCount: number
  lastFailureTime?: Date
  lastSuccessTime?: Date
  lastStateChangeTime: Date
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount: number = 0
  private successCount: number = 0
  private lastFailureTime?: Date
  private lastSuccessTime?: Date
  private lastStateChangeTime: Date = new Date()
  private bulkhead: Semaphore
  private config: CircuitBreakerConfig

  constructor(config: CircuitBreakerConfig) {
    this.config = config
    this.bulkhead = new Semaphore(config.bulkheadConcurrency)
  }

  async execute<T>(operation: () => Promise<T>, tool?: string): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen()
      } else {
        // Record fast fail when circuit is open
        if (tool) {
          recordBreakerFastFail(tool)
        }
        throw new Error(`Circuit breaker is OPEN for ${this.config.openMs}ms`)
      }
    }

    // Acquire bulkhead permit
    const [, release] = await this.bulkhead.acquire()
    
    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    } finally {
      release()
    }
  }

  private onSuccess(): void {
    this.successCount++
    this.lastSuccessTime = new Date()
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToClosed()
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = new Date()
    
    if (this.state === CircuitState.CLOSED && this.failureCount >= this.config.failureThreshold) {
      this.transitionToOpen()
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen()
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false
    const timeSinceFailure = Date.now() - this.lastFailureTime.getTime()
    return timeSinceFailure >= this.config.openMs
  }

  private transitionToOpen(): void {
    this.state = CircuitState.OPEN
    this.lastStateChangeTime = new Date()
    // Note: We'll set the breaker state when we have the tool context
  }

  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN
    this.lastStateChangeTime = new Date()
    this.successCount = 0
    this.failureCount = 0
    // Note: We'll set the breaker state when we have the tool context
  }

  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED
    this.lastStateChangeTime = new Date()
    this.successCount = 0
    this.failureCount = 0
    // Note: We'll set the breaker state when we have the tool context
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      lastStateChangeTime: this.lastStateChangeTime
    }
  }

  getConfig(): CircuitBreakerConfig {
    return { ...this.config }
  }

  isOpen(): boolean {
    return this.state === CircuitState.OPEN
  }

  isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN
  }

  isClosed(): boolean {
    return this.state === CircuitState.CLOSED
  }
}

// Circuit breaker registry per tool
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map()
  private defaultConfig: CircuitBreakerConfig

  constructor(defaultConfig: CircuitBreakerConfig) {
    this.defaultConfig = defaultConfig
  }

  getBreaker(tool: string): CircuitBreaker {
    if (!this.breakers.has(tool)) {
      this.breakers.set(tool, new CircuitBreaker(this.defaultConfig))
    }
    return this.breakers.get(tool)!
  }

  getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers)
  }

  getBreakerStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {}
    for (const [tool, breaker] of this.breakers) {
      stats[tool] = breaker.getStats()
    }
    return stats
  }

  resetBreaker(tool: string): void {
    this.breakers.delete(tool)
  }

  resetAllBreakers(): void {
    this.breakers.clear()
  }
}

// Global circuit breaker configuration
const cbFailureThreshold = parseInt(process.env.CB_FAIL_THRESHOLD || '5')
const cbWindowMs = parseInt(process.env.CB_WINDOW_MS || '60000') // 1 minute
const cbOpenMs = parseInt(process.env.CB_OPEN_MS || '30000') // 30 seconds
const cbBulkheadConcurrency = parseInt(process.env.CB_BULKHEAD_CONCURRENCY || '10')

const defaultCircuitConfig: CircuitBreakerConfig = {
  failureThreshold: cbFailureThreshold,
  windowMs: cbWindowMs,
  openMs: cbOpenMs,
  bulkheadConcurrency: cbBulkheadConcurrency
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry(defaultCircuitConfig)

// Utility function to get circuit breaker for a tool
export function getCircuitBreaker(tool: string): CircuitBreaker {
  return circuitBreakerRegistry.getBreaker(tool)
}

// Utility function to execute with circuit breaker
export async function executeWithCircuitBreaker<T>(
  tool: string, 
  operation: () => Promise<T>
): Promise<T> {
  const breaker = getCircuitBreaker(tool)
  
  // Track breaker state changes
  const currentState = breaker.getStats().state
  setBreakerState(tool, currentState)
  
  try {
    const result = await breaker.execute(operation, tool)
    
    // Update state after successful execution
    const newState = breaker.getStats().state
    if (newState !== currentState) {
      setBreakerState(tool, newState)
    }
    
    return result
  } catch (error) {
    // Update state after failed execution
    const newState = breaker.getStats().state
    if (newState !== currentState) {
      setBreakerState(tool, newState)
    }
    throw error
  }
}

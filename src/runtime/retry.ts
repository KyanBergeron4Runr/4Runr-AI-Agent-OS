export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  jitterFactor: number
}

export interface RetryableOperation {
  tool: string
  action: string
  operation: () => Promise<any>
}

// Import metrics for retry tracking
import { recordRetry } from '../observability/metrics'

export class RetryPolicy {
  private config: RetryConfig
  private retryableTools: Set<string>
  private nonRetryableActions: Set<string>

  constructor(config: RetryConfig) {
    this.config = config
    this.retryableTools = new Set(['serpapi', 'openai', 'http_fetch'])
    this.nonRetryableActions = new Set(['gmail_send.send'])
  }

  async execute<T>(operation: RetryableOperation): Promise<T> {
    const { tool, action, operation: op } = operation
    
    // Check if operation is retryable
    if (!this.isRetryable(tool, action)) {
      return op()
    }

    let lastError: Error
    let attempt = 0

    while (attempt <= this.config.maxRetries) {
      try {
        return await op()
      } catch (error) {
        lastError = error as Error
        attempt++

        // Check if error is retryable
        if (!this.isRetryableError(error as Error) || attempt > this.config.maxRetries) {
          throw error
        }

        // Record retry attempt
        const reason = this.getRetryReason(error as Error)
        recordRetry(tool, action, reason)

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt)
        
        // Wait before retry
        await this.sleep(delay)
      }
    }

    throw lastError!
  }

  private isRetryable(tool: string, action: string): boolean {
    // Check if tool is in retryable list
    if (!this.retryableTools.has(tool)) {
      return false
    }

    // Check if action is explicitly non-retryable
    const fullAction = `${tool}.${action}`
    if (this.nonRetryableActions.has(fullAction)) {
      return false
    }

    return true
  }

  private isRetryableError(error: Error): boolean {
    // Network timeouts
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      return true
    }

    // HTTP status codes
    if (error.message.includes('502') || error.message.includes('503') || error.message.includes('504')) {
      return true
    }

    // Network errors
    if (error.message.includes('ECONNRESET') || error.message.includes('ENOTFOUND')) {
      return true
    }

    // Rate limiting (429) - retry with backoff
    if (error.message.includes('429')) {
      return true
    }

    return false
  }

  private getRetryReason(error: Error): string {
    // Network timeouts
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      return 'timeout'
    }

    // HTTP status codes
    if (error.message.includes('502') || error.message.includes('503') || error.message.includes('504')) {
      return '5xx'
    }

    // Network errors
    if (error.message.includes('ECONNRESET') || error.message.includes('ENOTFOUND')) {
      return 'network'
    }

    // Rate limiting (429) - retry with backoff
    if (error.message.includes('429')) {
      return 'rate_limit'
    }

    return 'unknown'
  }

  private calculateDelay(attempt: number): number {
    // Exponential backoff: baseDelay * 2^(attempt-1)
    const exponentialDelay = this.config.baseDelayMs * Math.pow(2, attempt - 1)
    
    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs)
    
    // Add jitter: ±jitterFactor% random variation
    const jitterRange = cappedDelay * this.config.jitterFactor
    const jitter = (Math.random() - 0.5) * jitterRange * 2
    
    return Math.max(0, cappedDelay + jitter)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  addRetryableTool(tool: string): void {
    this.retryableTools.add(tool)
  }

  removeRetryableTool(tool: string): void {
    this.retryableTools.delete(tool)
  }

  addNonRetryableAction(action: string): void {
    this.nonRetryableActions.add(action)
  }

  removeNonRetryableAction(action: string): void {
    this.nonRetryableActions.delete(action)
  }

  getConfig(): RetryConfig {
    return { ...this.config }
  }

  getRetryableTools(): string[] {
    return Array.from(this.retryableTools)
  }

  getNonRetryableActions(): string[] {
    return Array.from(this.nonRetryableActions)
  }
}

// Global retry configuration
const retryMaxRetries = parseInt(process.env.RETRY_MAX_RETRIES || '2')
const retryBaseDelayMs = parseInt(process.env.RETRY_BASE_DELAY_MS || '250')
const retryMaxDelayMs = parseInt(process.env.RETRY_MAX_DELAY_MS || '1000')
const retryJitterFactor = parseFloat(process.env.RETRY_JITTER_FACTOR || '0.1')

const defaultRetryConfig: RetryConfig = {
  maxRetries: retryMaxRetries,
  baseDelayMs: retryBaseDelayMs,
  maxDelayMs: retryMaxDelayMs,
  jitterFactor: retryJitterFactor
}

export const retryPolicy = new RetryPolicy(defaultRetryConfig)

// Utility function to execute with retry policy
export async function executeWithRetry<T>(
  tool: string,
  action: string,
  operation: () => Promise<T>
): Promise<T> {
  return retryPolicy.execute({ tool, action, operation })
}

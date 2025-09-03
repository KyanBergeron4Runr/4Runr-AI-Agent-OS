import { GatewayError, GatewayRateLimitError, GatewayUpstreamError } from '../errors'

export interface RetryOptions {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  jitter: boolean
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  jitter: true
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: GatewayError): boolean {
  // Rate limit errors are not retryable (wait for retry-after)
  if (error instanceof GatewayRateLimitError) {
    return false
  }
  
  // Network errors are retryable
  if (error.code === 'NETWORK_ERROR') {
    return true
  }
  
  // Upstream errors (502, 503, 504) are retryable
  if (error instanceof GatewayUpstreamError) {
    return true
  }
  
  // 5xx errors are retryable
  if (error.statusCode && error.statusCode >= 500) {
    return true
  }
  
  return false
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
export function calculateDelay(
  attempt: number,
  options: RetryOptions
): number {
  const delay = Math.min(
    options.baseDelay * Math.pow(2, attempt),
    options.maxDelay
  )
  
  if (options.jitter) {
    // Add ±25% jitter
    const jitter = delay * 0.25 * (Math.random() - 0.5)
    return Math.max(0, delay + jitter)
  }
  
  return delay
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: Error
  
  for (let attempt = 0; attempt <= retryOptions.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      // Don't retry on last attempt
      if (attempt === retryOptions.maxRetries) {
        throw error
      }
      
      // Check if error is retryable
      if (error instanceof GatewayError && !isRetryableError(error)) {
        throw error
      }
      
      // Calculate delay and wait
      const delay = calculateDelay(attempt, retryOptions)
      await sleep(delay)
    }
  }
  
  throw lastError!
}

import crypto from 'crypto'

// Utility functions shared across packages

/**
 * Generate a unique correlation ID for tracking requests
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID()
}

/**
 * Generate a unique run ID
 */
export function generateRunId(): string {
  return crypto.randomUUID()
}

/**
 * Generate a unique agent ID
 */
export function generateAgentId(): string {
  return crypto.randomUUID()
}

/**
 * Hash content for deduplication
 */
export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

/**
 * Format SSE event data
 */
export function formatSSEEvent(event: string, data: any, id?: string): string {
  let sse = `event: ${event}\n`
  sse += `data: ${JSON.stringify(data)}\n`
  if (id) {
    sse += `id: ${id}\n`
  }
  sse += '\n'
  return sse
}

/**
 * Parse SSE event from string
 */
export function parseSSEEvent(eventString: string): { event: string; data: any; id?: string } | null {
  const lines = eventString.trim().split('\n')
  const result: any = {}
  
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      result.event = line.slice(7)
    } else if (line.startsWith('data: ')) {
      try {
        result.data = JSON.parse(line.slice(6))
      } catch {
        result.data = line.slice(6)
      }
    } else if (line.startsWith('id: ')) {
      result.id = line.slice(4)
    }
  }
  
  return result.event && result.data ? result : null
}

/**
 * Calculate metrics from an array of values
 */
export function calculateMetrics(values: number[]): {
  mean: number
  min: number
  max: number
  median: number
  p95: number
  p99: number
} {
  if (values.length === 0) {
    return { mean: 0, min: 0, max: 0, median: 0, p95: 0, p99: 0 }
  }
  
  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const median = sorted[Math.floor(sorted.length / 2)]
  const p95 = sorted[Math.floor(sorted.length * 0.95)]
  const p99 = sorted[Math.floor(sorted.length * 0.99)]
  
  return { 
    mean: mean || 0, 
    min: min || 0, 
    max: max || 0, 
    median: median || 0, 
    p95: p95 || 0, 
    p99: p99 || 0 
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Sanitize string for logging (remove sensitive data)
 */
export function sanitizeForLogging(input: string): string {
  return input
    .replace(/(password|token|secret|key|authorization)\s*[:=]\s*[^\s,}]+/gi, '$1: ***REDACTED***')
    .replace(/([0-9]{4}[-\s]?){4}/g, '****-****-****-****') // Credit card numbers
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***') // Email addresses
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as T
  }
  
  if (typeof obj === 'object') {
    const cloned = {} as T
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key])
      }
    }
    return cloned
  }
  
  return obj
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      if (attempt === maxRetries) {
        throw lastError
      }
      
      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError!
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

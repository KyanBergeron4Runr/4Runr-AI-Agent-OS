/**
 * Generate a unique correlation ID for request tracking
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  return `req_${timestamp}_${random}`
}

/**
 * Extract correlation ID from response headers
 */
export function extractCorrelationId(headers: Headers): string | undefined {
  return headers.get('X-Correlation-Id') || undefined
}

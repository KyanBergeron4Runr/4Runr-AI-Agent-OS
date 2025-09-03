import { randomUUID } from 'crypto'

/**
 * Generate a unique idempotency key
 */
export function generateIdempotencyKey(): string {
  return `idemp_${Date.now()}_${randomUUID()}`
}

/**
 * Generate idempotency key from request data
 */
export function generateIdempotencyKeyFromData(
  tool: string,
  action: string,
  params: Record<string, any>
): string {
  const dataString = JSON.stringify({ tool, action, params })
  const hash = require('crypto').createHash('sha256').update(dataString).digest('hex')
  return `idemp_${hash.substring(0, 16)}`
}

import { z } from 'zod'

// Policy specification schema
export const PolicySpecSchema = z.object({
  scopes: z.array(z.string()).min(1), // e.g., ["serpapi:search", "http_fetch:get"]
  intent: z.string().optional(), // e.g., "data_collection", "communication"
  guards: z.object({
    maxRequestSize: z.number().optional(), // bytes
    maxResponseSize: z.number().optional(), // bytes
    allowedDomains: z.array(z.string()).optional(), // for http_fetch
    blockedDomains: z.array(z.string()).optional(),
    piiFilters: z.array(z.string()).optional(), // e.g., ["email", "phone", "ssn"]
    timeWindow: z.object({
      start: z.string().optional(), // HH:MM
      end: z.string().optional(), // HH:MM
      timezone: z.string().optional() // e.g., "America/New_York"
    }).optional()
  }).optional(),
  quotas: z.array(z.object({
    action: z.string(), // e.g., "serpapi:search"
    limit: z.number(),
    window: z.string(), // e.g., "1h", "24h", "7d"
    resetStrategy: z.enum(["sliding", "fixed"]).default("sliding")
  })).optional(),
  schedule: z.object({
    enabled: z.boolean().default(true),
    timezone: z.string().default("UTC"),
    allowedDays: z.array(z.number()).optional(), // 0-6 (Sunday-Saturday)
    allowedHours: z.object({
      start: z.number().min(0).max(23).optional(),
      end: z.number().min(0).max(23).optional()
    }).optional()
  }).optional(),
  responseFilters: z.object({
    redactFields: z.array(z.string()).optional(), // e.g., ["api_key", "password"]
    truncateFields: z.array(z.object({
      field: z.string(),
      maxLength: z.number()
    })).optional(),
    blockPatterns: z.array(z.string()).optional() // regex patterns
  }).optional()
})

export type PolicySpec = z.infer<typeof PolicySpecSchema>

// Policy evaluation result
export interface PolicyEvaluationResult {
  allowed: boolean
  reason?: string
  appliedFilters?: {
    redactedFields?: string[]
    truncatedFields?: string[]
    blockedPatterns?: string[]
  }
  quotaInfo?: {
    action: string
    current: number
    limit: number
    resetAt: Date
  }
}

// Policy merge strategy
export interface PolicyMergeResult {
  mergedSpec: PolicySpec
  sourcePolicies: string[] // policy IDs that were merged
}

// Quota key generation
export function generateQuotaKey(action: string, window: string): string {
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0] // YYYY-MM-DD
  
  if (window === '1h') {
    const hour = now.getHours()
    return `${action}:${dateStr}:${hour}`
  } else if (window === '24h') {
    return `${action}:${dateStr}`
  } else if (window === '7d') {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay()) // Start of week (Sunday)
    const weekStr = weekStart.toISOString().split('T')[0]
    return `${action}:week:${weekStr}`
  }
  
  return `${action}:${dateStr}`
}

// Default timezone for policy evaluation
export const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'UTC'

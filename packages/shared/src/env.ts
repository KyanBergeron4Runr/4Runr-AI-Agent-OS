import { z } from 'zod'
import * as dotenv from 'dotenv'
import path from 'path'

// Load environment variables from infra/.env
const envPath = path.resolve(process.cwd(), 'infra', '.env')
dotenv.config({ path: envPath })

// Environment schema with strict validation
const envSchema = z.object({
  // Server configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().default('127.0.0.1'),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Redis (optional in development)
  REDIS_URL: z.string().url().optional(),
  
  // Security
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),
  
  // Sentinel configuration
  SENTINEL_STORE_PLAIN: z.string().transform(val => val === 'true').default('true'),
  SENTINEL_MODE: z.enum(['live', 'mock']).default('live'),
  SENTINEL_SHIELD_MODE: z.enum(['enforce', 'monitor', 'off']).default('enforce'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // Development
  DEV_MODE: z.string().transform(val => val === 'true').default('false'),
  ALLOW_LOCALHOST_ONLY: z.string().transform(val => val === 'true').default('true'),
})

// Parse and validate environment
export function parseEnv() {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:')
      error.errors.forEach(err => {
        console.error(`   ${err.path.join('.')}: ${err.message}`)
      })
      console.error(`\n📝 Please check infra/.env.example and create infra/.env`)
      process.exit(1)
    }
    throw error
  }
}

// Export validated environment
export const env = parseEnv()

// Environment utilities
export const isDevelopment = env.NODE_ENV === 'development'
export const isProduction = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'

// Feature flags
export const features = {
  sentinel: {
    enabled: env.SENTINEL_MODE === 'live',
    storePlain: env.SENTINEL_STORE_PLAIN,
    shieldMode: env.SENTINEL_SHIELD_MODE,
  },
  development: {
    devMode: env.DEV_MODE,
    localhostOnly: env.ALLOW_LOCALHOST_ONLY,
  }
} as const

// Validation helpers
export function validateRequiredEnv(required: string[]) {
  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

// Safe environment logging (no secrets)
export function getSafeEnvForLogging() {
  return {
    NODE_ENV: env.NODE_ENV,
    PORT: env.PORT,
    HOST: env.HOST,
    DATABASE_URL: env.DATABASE_URL ? '***configured***' : '***missing***',
    REDIS_URL: env.REDIS_URL ? '***configured***' : '***missing***',
    SENTINEL_MODE: env.SENTINEL_MODE,
    SENTINEL_SHIELD_MODE: env.SENTINEL_SHIELD_MODE,
    LOG_LEVEL: env.LOG_LEVEL,
    DEV_MODE: env.DEV_MODE,
  }
}

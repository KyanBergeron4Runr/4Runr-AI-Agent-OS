const REQUIRED = [
  'PORT','DATABASE_URL','TOKEN_HMAC_SECRET',
  'SECRETS_BACKEND','HTTP_TIMEOUT_MS','DEFAULT_TIMEZONE','KEK_BASE64'
] as const

export function validateEnv(env = process.env) {
  const missing = REQUIRED.filter(k => !env[k] || String(env[k]).trim() === '')
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`)
  }
  
  // basic shape checks
  if (!/^\d+$/.test(env.HTTP_TIMEOUT_MS!)) {
    throw new Error('HTTP_TIMEOUT_MS must be number (ms)')
  }
  
  if (!/^([A-Za-z0-9+/]{43}=)$/.test(env.KEK_BASE64!)) {
    throw new Error('KEK_BASE64 must be base64 32 bytes (44 chars with =)')
  }
  
  return true
}

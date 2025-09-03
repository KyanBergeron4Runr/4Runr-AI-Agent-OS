// Middleware configuration with environment variable support
export interface MiddlewareConfig {
  validation: {
    enforce: 'strict' | 'warn' | 'off';
  };
  idempotency: {
    enabled: boolean;
    ttlSeconds: number;
    redisUrl?: string;
    redisPrefix: string;
  };
  bodyLimits: {
    gatewayMaxBytes: number;
    runInputStringMax: number;
    runInputObjectMax: number;
  };
}

// Default configuration
const defaultConfig: MiddlewareConfig = {
  validation: {
    enforce: 'strict'
  },
  idempotency: {
    enabled: false,
    ttlSeconds: 86400, // 24 hours
    redisUrl: 'redis://localhost:6379',
    redisPrefix: 'idempotency'
  },
  bodyLimits: {
    gatewayMaxBytes: 262144, // 256KB
    runInputStringMax: 65536, // 64KB
    runInputObjectMax: 131072 // 128KB
  }
};

// Load configuration from environment variables
export function loadMiddlewareConfig(): MiddlewareConfig {
  const config = { ...defaultConfig };

  // Validation settings
  const validationEnforce = process.env.VALIDATION_ENFORCE;
  if (validationEnforce === 'strict' || validationEnforce === 'warn' || validationEnforce === 'off') {
    config.validation.enforce = validationEnforce;
  }

  // Idempotency settings
  if (process.env.IDEMPOTENCY_ENABLED === 'true') {
    config.idempotency.enabled = true;
  }
  
  const ttlSeconds = parseInt(process.env.IDEMPOTENCY_TTL_SECONDS || '');
  if (!isNaN(ttlSeconds) && ttlSeconds > 0) {
    config.idempotency.ttlSeconds = ttlSeconds;
  }

  if (process.env.REDIS_URL) {
    config.idempotency.redisUrl = process.env.REDIS_URL;
  }

  if (process.env.REDIS_PREFIX) {
    config.idempotency.redisPrefix = process.env.REDIS_PREFIX;
  }

  // Body limit settings
  const gatewayMaxBytes = parseInt(process.env.GATEWAY_BODY_LIMIT_BYTES || '');
  if (!isNaN(gatewayMaxBytes) && gatewayMaxBytes > 0) {
    config.bodyLimits.gatewayMaxBytes = gatewayMaxBytes;
  }

  const runInputStringMax = parseInt(process.env.RUN_INPUT_STRING_MAX || '');
  if (!isNaN(runInputStringMax) && runInputStringMax > 0) {
    config.bodyLimits.runInputStringMax = runInputStringMax;
  }

  const runInputObjectMax = parseInt(process.env.RUN_INPUT_OBJECT_MAX || '');
  if (!isNaN(runInputObjectMax) && runInputObjectMax > 0) {
    config.bodyLimits.runInputObjectMax = runInputObjectMax;
  }

  return config;
}

// Get current configuration
export const middlewareConfig = loadMiddlewareConfig();

// Helper functions for common config checks
export function isValidationStrict(): boolean {
  return middlewareConfig.validation.enforce === 'strict';
}

export function isValidationEnabled(): boolean {
  return middlewareConfig.validation.enforce !== 'off';
}

export function isIdempotencyEnabled(): boolean {
  return middlewareConfig.idempotency.enabled;
}

export function getBodyLimits() {
  return middlewareConfig.bodyLimits;
}

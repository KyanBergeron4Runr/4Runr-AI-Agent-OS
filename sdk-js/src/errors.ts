/**
 * Base error class for all Gateway SDK errors
 */
export class GatewayError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

/**
 * Authentication/authorization errors
 */
export class GatewayAuthError extends GatewayError {
  constructor(message: string, statusCode?: number) {
    super(message, statusCode, 'AUTH_ERROR')
  }
}

/**
 * Policy enforcement errors
 */
export class GatewayPolicyError extends GatewayError {
  constructor(message: string, statusCode?: number) {
    super(message, statusCode, 'POLICY_ERROR')
  }
}

/**
 * Rate limiting errors
 */
export class GatewayRateLimitError extends GatewayError {
  constructor(
    message: string,
    public retryAfter?: number,
    statusCode?: number
  ) {
    super(message, statusCode, 'RATE_LIMIT_ERROR')
  }
}

/**
 * Upstream service errors
 */
export class GatewayUpstreamError extends GatewayError {
  constructor(message: string, statusCode?: number) {
    super(message, statusCode, 'UPSTREAM_ERROR')
  }
}

/**
 * Network/connection errors
 */
export class GatewayNetworkError extends GatewayError {
  constructor(message: string, public originalError?: Error) {
    super(message, undefined, 'NETWORK_ERROR')
  }
}

/**
 * Token-related errors
 */
export class GatewayTokenError extends GatewayError {
  constructor(message: string, statusCode?: number) {
    super(message, statusCode, 'TOKEN_ERROR')
  }
}

/**
 * Utility function to create appropriate error from HTTP response
 */
export function createErrorFromResponse(
  statusCode: number,
  errorMessage: string,
  retryAfter?: string
): GatewayError {
  switch (statusCode) {
    case 401:
    case 403:
      return new GatewayAuthError(errorMessage, statusCode)
    case 429:
      const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined
      return new GatewayRateLimitError(errorMessage, retryAfterSeconds, statusCode)
    case 400:
      if (errorMessage.includes('policy') || errorMessage.includes('scope')) {
        return new GatewayPolicyError(errorMessage, statusCode)
      }
      return new GatewayError(errorMessage, statusCode)
    case 502:
    case 503:
    case 504:
      return new GatewayUpstreamError(errorMessage, statusCode)
    default:
      return new GatewayError(errorMessage, statusCode)
  }
}

interface GatewayClientOptions {
    baseUrl: string;
    agentId: string;
    agentPrivateKeyPem: string;
    defaultIntent?: string;
    timeoutMs?: number;
}
interface TokenOptions {
    tools: string[];
    permissions: string[];
    ttlMinutes: number;
}
interface ProxyResponse<T = any> {
    success: boolean;
    data: T;
    metadata: {
        agent_id: string;
        agent_name: string;
        tool: string;
        action: string;
        response_time_ms: number;
    };
}
interface JobResponse {
    status: 'queued' | 'running' | 'done' | 'failed';
    result?: any;
    error?: string;
}
declare class GatewayClient {
    private baseUrl;
    private agentId;
    private agentPrivateKeyPem;
    private defaultIntent?;
    private timeoutMs;
    private currentIntent;
    constructor(options: GatewayClientOptions);
    /**
     * Set the current intent for requests
     */
    setIntent(intent: string): void;
    /**
     * Get a new token from the Gateway
     */
    getToken(opts: TokenOptions): Promise<string>;
    /**
     * Make a proxied request through the Gateway
     */
    proxy<T = any>(tool: string, action: string, params: Record<string, any>, agentToken?: string, proofPayloadOverride?: object): Promise<T>;
    /**
     * Make an async proxy request
     */
    proxyAsync(tool: string, action: string, params: Record<string, any>, agentToken?: string): Promise<{
        jobId: string;
    }>;
    /**
     * Get job status and result
     */
    getJob(jobId: string): Promise<JobResponse>;
    /**
     * Make an HTTP request with retry logic and error handling
     */
    private makeRequest;
    /**
     * Get token age in milliseconds
     */
    private getTokenAge;
    /**
     * Mask sensitive parameters in logs
     */
    private maskParams;
}

/**
 * Base error class for all Gateway SDK errors
 */
declare class GatewayError extends Error {
    statusCode?: number | undefined;
    code?: string | undefined;
    constructor(message: string, statusCode?: number | undefined, code?: string | undefined);
}
/**
 * Authentication/authorization errors
 */
declare class GatewayAuthError extends GatewayError {
    constructor(message: string, statusCode?: number);
}
/**
 * Policy enforcement errors
 */
declare class GatewayPolicyError extends GatewayError {
    constructor(message: string, statusCode?: number);
}
/**
 * Rate limiting errors
 */
declare class GatewayRateLimitError extends GatewayError {
    retryAfter?: number | undefined;
    constructor(message: string, retryAfter?: number | undefined, statusCode?: number);
}
/**
 * Upstream service errors
 */
declare class GatewayUpstreamError extends GatewayError {
    constructor(message: string, statusCode?: number);
}
/**
 * Network/connection errors
 */
declare class GatewayNetworkError extends GatewayError {
    originalError?: Error | undefined;
    constructor(message: string, originalError?: Error | undefined);
}
/**
 * Token-related errors
 */
declare class GatewayTokenError extends GatewayError {
    constructor(message: string, statusCode?: number);
}
/**
 * Utility function to create appropriate error from HTTP response
 */
declare function createErrorFromResponse(statusCode: number, errorMessage: string, retryAfter?: string): GatewayError;

/**
 * Generate a unique correlation ID for request tracking
 */
declare function generateCorrelationId(): string;
/**
 * Extract correlation ID from response headers
 */
declare function extractCorrelationId(headers: Headers): string | undefined;

interface RetryOptions {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    jitter: boolean;
}
/**
 * Check if an error is retryable
 */
declare function isRetryableError(error: GatewayError): boolean;
/**
 * Calculate delay with exponential backoff and optional jitter
 */
declare function calculateDelay(attempt: number, options: RetryOptions): number;
/**
 * Sleep for a given number of milliseconds
 */
declare function sleep(ms: number): Promise<void>;
/**
 * Retry a function with exponential backoff
 */
declare function withRetry<T>(fn: () => Promise<T>, options?: Partial<RetryOptions>): Promise<T>;

/**
 * Generate a unique idempotency key
 */
declare function generateIdempotencyKey(): string;
/**
 * Generate idempotency key from request data
 */
declare function generateIdempotencyKeyFromData(tool: string, action: string, params: Record<string, any>): string;

export { GatewayAuthError, GatewayClient, type GatewayClientOptions, GatewayError, GatewayNetworkError, GatewayPolicyError, GatewayRateLimitError, GatewayTokenError, GatewayUpstreamError, type JobResponse, type ProxyResponse, type RetryOptions, type TokenOptions, calculateDelay, createErrorFromResponse, extractCorrelationId, generateCorrelationId, generateIdempotencyKey, generateIdempotencyKeyFromData, isRetryableError, sleep, withRetry };

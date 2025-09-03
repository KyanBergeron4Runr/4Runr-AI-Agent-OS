"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryPolicy = exports.RetryPolicy = void 0;
exports.executeWithRetry = executeWithRetry;
// Import metrics for retry tracking
const metrics_1 = require("../observability/metrics");
class RetryPolicy {
    constructor(config) {
        this.config = config;
        this.retryableTools = new Set(['serpapi', 'openai', 'http_fetch']);
        this.nonRetryableActions = new Set(['gmail_send.send']);
    }
    async execute(operation) {
        const { tool, action, operation: op } = operation;
        // Check if operation is retryable
        if (!this.isRetryable(tool, action)) {
            return op();
        }
        let lastError;
        let attempt = 0;
        while (attempt <= this.config.maxRetries) {
            try {
                return await op();
            }
            catch (error) {
                lastError = error;
                attempt++;
                // Check if error is retryable
                if (!this.isRetryableError(error) || attempt > this.config.maxRetries) {
                    throw error;
                }
                // Record retry attempt
                const reason = this.getRetryReason(error);
                (0, metrics_1.recordRetry)(tool, action, reason);
                // Calculate delay with exponential backoff and jitter
                const delay = this.calculateDelay(attempt);
                // Wait before retry
                await this.sleep(delay);
            }
        }
        throw lastError;
    }
    isRetryable(tool, action) {
        // Check if tool is in retryable list
        if (!this.retryableTools.has(tool)) {
            return false;
        }
        // Check if action is explicitly non-retryable
        const fullAction = `${tool}.${action}`;
        if (this.nonRetryableActions.has(fullAction)) {
            return false;
        }
        return true;
    }
    isRetryableError(error) {
        // Network timeouts
        if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
            return true;
        }
        // HTTP status codes
        if (error.message.includes('502') || error.message.includes('503') || error.message.includes('504')) {
            return true;
        }
        // Network errors
        if (error.message.includes('ECONNRESET') || error.message.includes('ENOTFOUND')) {
            return true;
        }
        // Rate limiting (429) - retry with backoff
        if (error.message.includes('429')) {
            return true;
        }
        return false;
    }
    getRetryReason(error) {
        // Network timeouts
        if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
            return 'timeout';
        }
        // HTTP status codes
        if (error.message.includes('502') || error.message.includes('503') || error.message.includes('504')) {
            return '5xx';
        }
        // Network errors
        if (error.message.includes('ECONNRESET') || error.message.includes('ENOTFOUND')) {
            return 'network';
        }
        // Rate limiting (429) - retry with backoff
        if (error.message.includes('429')) {
            return 'rate_limit';
        }
        return 'unknown';
    }
    calculateDelay(attempt) {
        // Exponential backoff: baseDelay * 2^(attempt-1)
        const exponentialDelay = this.config.baseDelayMs * Math.pow(2, attempt - 1);
        // Cap at max delay
        const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);
        // Add jitter: ±jitterFactor% random variation
        const jitterRange = cappedDelay * this.config.jitterFactor;
        const jitter = (Math.random() - 0.5) * jitterRange * 2;
        return Math.max(0, cappedDelay + jitter);
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    addRetryableTool(tool) {
        this.retryableTools.add(tool);
    }
    removeRetryableTool(tool) {
        this.retryableTools.delete(tool);
    }
    addNonRetryableAction(action) {
        this.nonRetryableActions.add(action);
    }
    removeNonRetryableAction(action) {
        this.nonRetryableActions.delete(action);
    }
    getConfig() {
        return { ...this.config };
    }
    getRetryableTools() {
        return Array.from(this.retryableTools);
    }
    getNonRetryableActions() {
        return Array.from(this.nonRetryableActions);
    }
}
exports.RetryPolicy = RetryPolicy;
// Global retry configuration
const retryMaxRetries = parseInt(process.env.RETRY_MAX_RETRIES || '2');
const retryBaseDelayMs = parseInt(process.env.RETRY_BASE_DELAY_MS || '250');
const retryMaxDelayMs = parseInt(process.env.RETRY_MAX_DELAY_MS || '1000');
const retryJitterFactor = parseFloat(process.env.RETRY_JITTER_FACTOR || '0.1');
const defaultRetryConfig = {
    maxRetries: retryMaxRetries,
    baseDelayMs: retryBaseDelayMs,
    maxDelayMs: retryMaxDelayMs,
    jitterFactor: retryJitterFactor
};
exports.retryPolicy = new RetryPolicy(defaultRetryConfig);
// Utility function to execute with retry policy
async function executeWithRetry(tool, action, operation) {
    return exports.retryPolicy.execute({ tool, action, operation });
}
//# sourceMappingURL=retry.js.map
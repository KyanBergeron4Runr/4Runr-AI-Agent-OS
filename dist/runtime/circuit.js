"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.circuitBreakerRegistry = exports.CircuitBreaker = exports.CircuitState = void 0;
exports.getCircuitBreaker = getCircuitBreaker;
exports.executeWithCircuitBreaker = executeWithCircuitBreaker;
const async_mutex_1 = require("async-mutex");
const metrics_1 = require("../observability/metrics");
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
class CircuitBreaker {
    constructor(config) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastStateChangeTime = new Date();
        this.config = config;
        this.bulkhead = new async_mutex_1.Semaphore(config.bulkheadConcurrency);
    }
    async execute(operation, tool) {
        // Check if circuit is open
        if (this.state === CircuitState.OPEN) {
            if (this.shouldAttemptReset()) {
                this.transitionToHalfOpen();
            }
            else {
                // Record fast fail when circuit is open
                if (tool) {
                    (0, metrics_1.recordBreakerFastFail)(tool);
                }
                throw new Error(`Circuit breaker is OPEN for ${this.config.openMs}ms`);
            }
        }
        // Acquire bulkhead permit
        const [, release] = await this.bulkhead.acquire();
        try {
            const result = await operation();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
        finally {
            release();
        }
    }
    onSuccess() {
        this.successCount++;
        this.lastSuccessTime = new Date();
        if (this.state === CircuitState.HALF_OPEN) {
            this.transitionToClosed();
        }
    }
    onFailure() {
        this.failureCount++;
        this.lastFailureTime = new Date();
        if (this.state === CircuitState.CLOSED && this.failureCount >= this.config.failureThreshold) {
            this.transitionToOpen();
        }
        else if (this.state === CircuitState.HALF_OPEN) {
            this.transitionToOpen();
        }
    }
    shouldAttemptReset() {
        if (!this.lastFailureTime)
            return false;
        const timeSinceFailure = Date.now() - this.lastFailureTime.getTime();
        return timeSinceFailure >= this.config.openMs;
    }
    transitionToOpen() {
        this.state = CircuitState.OPEN;
        this.lastStateChangeTime = new Date();
        // Note: We'll set the breaker state when we have the tool context
    }
    transitionToHalfOpen() {
        this.state = CircuitState.HALF_OPEN;
        this.lastStateChangeTime = new Date();
        this.successCount = 0;
        this.failureCount = 0;
        // Note: We'll set the breaker state when we have the tool context
    }
    transitionToClosed() {
        this.state = CircuitState.CLOSED;
        this.lastStateChangeTime = new Date();
        this.successCount = 0;
        this.failureCount = 0;
        // Note: We'll set the breaker state when we have the tool context
    }
    getStats() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            lastStateChangeTime: this.lastStateChangeTime
        };
    }
    getConfig() {
        return { ...this.config };
    }
    isOpen() {
        return this.state === CircuitState.OPEN;
    }
    isHalfOpen() {
        return this.state === CircuitState.HALF_OPEN;
    }
    isClosed() {
        return this.state === CircuitState.CLOSED;
    }
}
exports.CircuitBreaker = CircuitBreaker;
// Circuit breaker registry per tool
class CircuitBreakerRegistry {
    constructor(defaultConfig) {
        this.breakers = new Map();
        this.defaultConfig = defaultConfig;
    }
    getBreaker(tool) {
        if (!this.breakers.has(tool)) {
            this.breakers.set(tool, new CircuitBreaker(this.defaultConfig));
        }
        return this.breakers.get(tool);
    }
    getAllBreakers() {
        return new Map(this.breakers);
    }
    getBreakerStats() {
        const stats = {};
        for (const [tool, breaker] of this.breakers) {
            stats[tool] = breaker.getStats();
        }
        return stats;
    }
    resetBreaker(tool) {
        this.breakers.delete(tool);
    }
    resetAllBreakers() {
        this.breakers.clear();
    }
}
// Global circuit breaker configuration
const cbFailureThreshold = parseInt(process.env.CB_FAIL_THRESHOLD || '5');
const cbWindowMs = parseInt(process.env.CB_WINDOW_MS || '60000'); // 1 minute
const cbOpenMs = parseInt(process.env.CB_OPEN_MS || '30000'); // 30 seconds
const cbBulkheadConcurrency = parseInt(process.env.CB_BULKHEAD_CONCURRENCY || '10');
const defaultCircuitConfig = {
    failureThreshold: cbFailureThreshold,
    windowMs: cbWindowMs,
    openMs: cbOpenMs,
    bulkheadConcurrency: cbBulkheadConcurrency
};
exports.circuitBreakerRegistry = new CircuitBreakerRegistry(defaultCircuitConfig);
// Utility function to get circuit breaker for a tool
function getCircuitBreaker(tool) {
    return exports.circuitBreakerRegistry.getBreaker(tool);
}
// Utility function to execute with circuit breaker
async function executeWithCircuitBreaker(tool, operation) {
    const breaker = getCircuitBreaker(tool);
    // Track breaker state changes
    const currentState = breaker.getStats().state;
    (0, metrics_1.setBreakerState)(tool, currentState);
    try {
        const result = await breaker.execute(operation, tool);
        // Update state after successful execution
        const newState = breaker.getStats().state;
        if (newState !== currentState) {
            (0, metrics_1.setBreakerState)(tool, newState);
        }
        return result;
    }
    catch (error) {
        // Update state after failed execution
        const newState = breaker.getStats().state;
        if (newState !== currentState) {
            (0, metrics_1.setBreakerState)(tool, newState);
        }
        throw error;
    }
}
//# sourceMappingURL=circuit.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gatewayCircuitBreaker = exports.CircuitBreaker = exports.CircuitState = void 0;
const events_1 = require("events");
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN"; // Testing - allow limited requests
})(CircuitState || (exports.CircuitState = CircuitState = {}));
class CircuitBreaker extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.options = options;
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.requests = 0;
        this.lastFailureTime = 0;
        this.nextAttempt = 0;
        this.halfOpenCalls = 0;
        this.requestHistory = [];
        this.cleanupHistory();
    }
    // Execute a function with circuit breaker protection
    async execute(fn) {
        if (!this.allowRequest()) {
            throw new Error(`Circuit breaker is ${this.state} - request rejected`);
        }
        this.requests++;
        if (this.state === CircuitState.HALF_OPEN) {
            this.halfOpenCalls++;
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    // Check if request should be allowed
    allowRequest() {
        const now = Date.now();
        switch (this.state) {
            case CircuitState.CLOSED:
                return true;
            case CircuitState.OPEN:
                if (now >= this.nextAttempt) {
                    this.state = CircuitState.HALF_OPEN;
                    this.halfOpenCalls = 0;
                    this.emit('state-change', this.state);
                    console.log('🔄 Circuit breaker HALF_OPEN - testing recovery');
                    return true;
                }
                return false;
            case CircuitState.HALF_OPEN:
                return this.halfOpenCalls < this.options.halfOpenMaxCalls;
            default:
                return false;
        }
    }
    onSuccess() {
        this.recordRequest(true);
        if (this.state === CircuitState.HALF_OPEN) {
            // Recovery successful
            this.state = CircuitState.CLOSED;
            this.failures = 0;
            this.halfOpenCalls = 0;
            this.emit('state-change', this.state);
            console.log('✅ Circuit breaker CLOSED - recovery successful');
        }
    }
    onFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        this.recordRequest(false);
        if (this.state === CircuitState.HALF_OPEN) {
            // Failed during recovery
            this.openCircuit();
        }
        else if (this.shouldOpenCircuit()) {
            this.openCircuit();
        }
    }
    shouldOpenCircuit() {
        if (this.requests < this.options.volumeThreshold) {
            return false; // Not enough requests to judge
        }
        const recentFailures = this.getRecentFailures();
        const failureRate = recentFailures / this.getRecentRequests();
        return failureRate >= (this.options.failureThreshold / 100);
    }
    openCircuit() {
        this.state = CircuitState.OPEN;
        this.nextAttempt = Date.now() + this.options.recoveryTimeout;
        this.emit('state-change', this.state);
        const failureRate = Math.round((this.getRecentFailures() / this.getRecentRequests()) * 100);
        console.log(`🚨 Circuit breaker OPEN - ${failureRate}% failure rate (${this.getRecentFailures()}/${this.getRecentRequests()} requests)`);
    }
    recordRequest(success) {
        this.requestHistory.push({
            timestamp: Date.now(),
            success
        });
    }
    getRecentRequests() {
        const cutoff = Date.now() - this.options.monitoringPeriod;
        return this.requestHistory.filter(req => req.timestamp >= cutoff).length;
    }
    getRecentFailures() {
        const cutoff = Date.now() - this.options.monitoringPeriod;
        return this.requestHistory.filter(req => req.timestamp >= cutoff && !req.success).length;
    }
    cleanupHistory() {
        setInterval(() => {
            const cutoff = Date.now() - this.options.monitoringPeriod;
            this.requestHistory = this.requestHistory.filter(req => req.timestamp >= cutoff);
        }, this.options.monitoringPeriod / 2);
    }
    // Get current stats
    getStats() {
        return {
            state: this.state,
            failures: this.failures,
            requests: this.requests,
            lastFailureTime: this.lastFailureTime,
            nextAttempt: this.nextAttempt
        };
    }
    // Manual controls for testing
    forceOpen() {
        this.state = CircuitState.OPEN;
        this.nextAttempt = Date.now() + this.options.recoveryTimeout;
        this.emit('state-change', this.state);
        console.log('🔧 Circuit breaker manually OPENED');
    }
    forceClose() {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.halfOpenCalls = 0;
        this.emit('state-change', this.state);
        console.log('🔧 Circuit breaker manually CLOSED');
    }
}
exports.CircuitBreaker = CircuitBreaker;
// Default circuit breaker for the gateway
exports.gatewayCircuitBreaker = new CircuitBreaker({
    failureThreshold: 50, // 50% failure rate triggers open
    recoveryTimeout: 30000, // 30 seconds before retry
    monitoringPeriod: 60000, // 1 minute monitoring window
    volumeThreshold: 10, // Need at least 10 requests
    halfOpenMaxCalls: 5 // Allow 5 test calls when half-open
});
//# sourceMappingURL=circuit-breaker.js.map
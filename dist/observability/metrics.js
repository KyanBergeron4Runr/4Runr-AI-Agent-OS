"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestTimer = exports.MetricNames = exports.metrics = void 0;
exports.recordRequest = recordRequest;
exports.recordRequestDuration = recordRequestDuration;
exports.recordCacheHit = recordCacheHit;
exports.recordRetry = recordRetry;
exports.recordBreakerFastFail = recordBreakerFastFail;
exports.setBreakerState = setBreakerState;
exports.setActiveConnections = setActiveConnections;
exports.recordTokenGeneration = recordTokenGeneration;
exports.recordTokenValidation = recordTokenValidation;
exports.recordTokenExpiration = recordTokenExpiration;
exports.recordPolicyDenial = recordPolicyDenial;
exports.recordAgentCreation = recordAgentCreation;
exports.recordChaosInjection = recordChaosInjection;
exports.recordChaosClearing = recordChaosClearing;
exports.getMetricsResponse = getMetricsResponse;
exports.startRequestTimer = startRequestTimer;
const circuit_1 = require("../runtime/circuit");
class PrometheusMetrics {
    constructor() {
        this.counters = new Map();
        this.histograms = new Map();
        this.gauges = new Map();
        this.startTime = Date.now();
    }
    // Increment counter
    incrementCounter(name, labels = {}) {
        const key = this.formatMetricKey(name, labels);
        const current = this.counters.get(key) || 0;
        this.counters.set(key, current + 1);
    }
    // Record histogram value
    recordHistogram(name, value, labels = {}) {
        const key = this.formatMetricKey(name, labels);
        const values = this.histograms.get(key) || [];
        values.push(value);
        this.histograms.set(key, values);
    }
    // Set gauge value
    setGauge(name, value, labels = {}) {
        const key = this.formatMetricKey(name, labels);
        this.gauges.set(key, value);
    }
    // Get histogram statistics with custom buckets
    getHistogramStats(name, labels = {}, customBuckets) {
        const key = this.formatMetricKey(name, labels);
        const values = this.histograms.get(key) || [];
        if (values.length === 0)
            return [];
        // Use custom buckets for request duration, default for others
        const buckets = customBuckets || [0.001, 0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10];
        const stats = [];
        for (const bucket of buckets) {
            const count = values.filter(v => v <= bucket).length;
            const sum = values.filter(v => v <= bucket).reduce((a, b) => a + b, 0);
            stats.push({ le: bucket.toString(), count, sum });
        }
        return stats;
    }
    formatMetricKey(name, labels) {
        const labelStr = Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');
        return labelStr ? `${name}{${labelStr}}` : name;
    }
    parseMetricKey(key) {
        const match = key.match(/^([^{]+)(?:\{(.+)\})?$/);
        if (!match)
            return [key, {}];
        const [, name, labelsStr] = match;
        const labels = {};
        if (labelsStr) {
            const labelMatches = labelsStr.matchAll(/([^,]+)="([^"]+)"/g);
            for (const [, key, value] of labelMatches) {
                labels[key] = value;
            }
        }
        return [name, labels];
    }
    formatLabels(labels) {
        if (Object.keys(labels).length === 0)
            return '';
        const labelStr = Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');
        return `{${labelStr}}`;
    }
    // Generate Prometheus format
    generateMetrics() {
        const lines = [];
        // Add process start time
        lines.push(`# HELP gateway_process_start_time_seconds Start time of the process since unix epoch in seconds.`);
        lines.push(`# TYPE gateway_process_start_time_seconds gauge`);
        lines.push(`gateway_process_start_time_seconds ${this.startTime / 1000}`);
        lines.push('');
        // Counters
        for (const [key, value] of this.counters) {
            const [name, labels] = this.parseMetricKey(key);
            const labelStr = this.formatLabels(labels);
            lines.push(`# HELP gateway_${name}_total Total number of ${name}`);
            lines.push(`# TYPE gateway_${name}_total counter`);
            lines.push(`gateway_${name}_total${labelStr} ${value}`);
        }
        lines.push('');
        // Histograms
        for (const [key, values] of this.histograms) {
            const [name, labels] = this.parseMetricKey(key);
            const labelStr = this.formatLabels(labels);
            // Use custom buckets for request duration
            const customBuckets = name === 'request_duration_ms' ? [25, 50, 100, 200, 400, 800, 1600, 3200, 6400] : undefined;
            const stats = this.getHistogramStats(name, labels, customBuckets);
            if (stats.length > 0) {
                const unit = name === 'request_duration_ms' ? 'ms' : 'seconds';
                lines.push(`# HELP gateway_${name}_${unit} Duration of ${name}`);
                lines.push(`# TYPE gateway_${name}_${unit} histogram`);
                for (const bucket of stats) {
                    lines.push(`gateway_${name}_${unit}_bucket${labelStr}le="${bucket.le}" ${bucket.count}`);
                }
                const sum = values.reduce((a, b) => a + b, 0);
                const count = values.length;
                lines.push(`gateway_${name}_${unit}_sum${labelStr} ${sum}`);
                lines.push(`gateway_${name}_${unit}_count${labelStr} ${count}`);
            }
        }
        lines.push('');
        // Gauges
        for (const [key, value] of this.gauges) {
            const [name, labels] = this.parseMetricKey(key);
            const labelStr = this.formatLabels(labels);
            lines.push(`# HELP gateway_${name} Current value of ${name}`);
            lines.push(`# TYPE gateway_${name} gauge`);
            lines.push(`gateway_${name}${labelStr} ${value}`);
        }
        return lines.join('\n');
    }
    // Reset all metrics (useful for testing)
    reset() {
        this.counters.clear();
        this.histograms.clear();
        this.gauges.clear();
    }
}
// Global metrics instance
exports.metrics = new PrometheusMetrics();
// Enhanced metric names with normalized naming
exports.MetricNames = {
    // Request metrics (new)
    REQUESTS_TOTAL: 'requests_total',
    REQUEST_DURATION_MS: 'request_duration_ms',
    // Cache metrics (new)
    CACHE_HITS_TOTAL: 'cache_hits_total',
    // Retry metrics (new)
    RETRIES_TOTAL: 'retries_total',
    // Circuit breaker metrics (new)
    BREAKER_FASTFAIL_TOTAL: 'breaker_fastfail_total',
    BREAKER_STATE: 'breaker_state',
    // Legacy metrics (keeping for backward compatibility)
    TOKEN_GENERATIONS_TOTAL: 'token_generations_total',
    TOKEN_VALIDATIONS_TOTAL: 'token_validations_total',
    TOKEN_EXPIRATIONS_TOTAL: 'token_expirations_total',
    POLICY_DENIALS_TOTAL: 'policy_denials_total',
    AGENT_CREATIONS_TOTAL: 'agent_creations_total',
    CHAOS_INJECTIONS_TOTAL: 'chaos_injections_total',
    CHAOS_CLEARINGS_TOTAL: 'chaos_clearings_total'
};
// Enhanced utility functions for new metrics
// 1. Request counters (per outcome)
function recordRequest(tool, action, statusCode) {
    exports.metrics.incrementCounter(exports.MetricNames.REQUESTS_TOTAL, {
        tool,
        action,
        code: statusCode.toString()
    });
}
// 2. Latency histogram (per tool/action)
function recordRequestDuration(tool, action, durationMs) {
    exports.metrics.recordHistogram(exports.MetricNames.REQUEST_DURATION_MS, durationMs, { tool, action });
}
// 3. Cache metrics
function recordCacheHit(tool, action) {
    exports.metrics.incrementCounter(exports.MetricNames.CACHE_HITS_TOTAL, { tool, action });
}
// 4. Retry metrics
function recordRetry(tool, action, reason) {
    exports.metrics.incrementCounter(exports.MetricNames.RETRIES_TOTAL, { tool, action, reason });
}
// 5. Circuit breaker metrics
function recordBreakerFastFail(tool) {
    exports.metrics.incrementCounter(exports.MetricNames.BREAKER_FASTFAIL_TOTAL, { tool });
}
function setBreakerState(tool, state) {
    const value = state === circuit_1.CircuitState.CLOSED ? 0 : state === circuit_1.CircuitState.HALF_OPEN ? 1 : 2;
    exports.metrics.setGauge(exports.MetricNames.BREAKER_STATE, value, { tool });
}
// Legacy utility functions (keeping for backward compatibility)
function setActiveConnections(count) {
    exports.metrics.setGauge('active_connections', count);
}
function recordTokenGeneration(agentId) {
    exports.metrics.incrementCounter(exports.MetricNames.TOKEN_GENERATIONS_TOTAL, { agent_id: agentId });
}
function recordTokenValidation(agentId, success) {
    exports.metrics.incrementCounter(exports.MetricNames.TOKEN_VALIDATIONS_TOTAL, {
        agent_id: agentId,
        success: success.toString()
    });
}
function recordTokenExpiration(agentId) {
    exports.metrics.incrementCounter(exports.MetricNames.TOKEN_EXPIRATIONS_TOTAL, { agent_id: agentId });
}
function recordPolicyDenial(agentId, tool, action) {
    exports.metrics.incrementCounter(exports.MetricNames.POLICY_DENIALS_TOTAL, {
        agent_id: agentId,
        tool,
        action
    });
}
function recordAgentCreation(agentId) {
    exports.metrics.incrementCounter(exports.MetricNames.AGENT_CREATIONS_TOTAL, { agent_id: agentId });
}
function recordChaosInjection(tool, errorType) {
    exports.metrics.incrementCounter(exports.MetricNames.CHAOS_INJECTIONS_TOTAL, { tool, error_type: errorType });
}
function recordChaosClearing(tool) {
    exports.metrics.incrementCounter(exports.MetricNames.CHAOS_CLEARINGS_TOTAL, { tool });
}
// Get metrics response
function getMetricsResponse() {
    return exports.metrics.generateMetrics();
}
// Timer utility for request duration tracking
class RequestTimer {
    constructor(tool, action) {
        this.startTime = Date.now();
        this.tool = tool;
        this.action = action;
    }
    end() {
        const duration = Date.now() - this.startTime;
        recordRequestDuration(this.tool, this.action, duration);
        return duration;
    }
}
exports.RequestTimer = RequestTimer;
// Convenience function to create a timer
function startRequestTimer(tool, action) {
    return new RequestTimer(tool, action);
}
//# sourceMappingURL=metrics.js.map
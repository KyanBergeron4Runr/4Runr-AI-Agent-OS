"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricNames = exports.metrics = void 0;
exports.recordRequest = recordRequest;
exports.recordRetry = recordRetry;
exports.setCircuitBreakerState = setCircuitBreakerState;
exports.recordCacheHit = recordCacheHit;
exports.recordCacheMiss = recordCacheMiss;
exports.setActiveConnections = setActiveConnections;
exports.recordTokenGeneration = recordTokenGeneration;
exports.recordTokenValidation = recordTokenValidation;
exports.recordTokenExpiration = recordTokenExpiration;
exports.recordPolicyDenial = recordPolicyDenial;
exports.recordAgentCreation = recordAgentCreation;
exports.recordChaosInjection = recordChaosInjection;
exports.recordChaosClearing = recordChaosClearing;
exports.getMetricsResponse = getMetricsResponse;
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
    // Get histogram statistics
    getHistogramStats(name, labels = {}) {
        const key = this.formatMetricKey(name, labels);
        const values = this.histograms.get(key) || [];
        if (values.length === 0)
            return [];
        const buckets = [0.001, 0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10];
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
            const stats = this.getHistogramStats(name, labels);
            if (stats.length > 0) {
                lines.push(`# HELP gateway_${name}_seconds Duration of ${name}`);
                lines.push(`# TYPE gateway_${name}_seconds histogram`);
                for (const bucket of stats) {
                    lines.push(`gateway_${name}_seconds_bucket${labelStr}le="${bucket.le}" ${bucket.count}`);
                }
                const sum = values.reduce((a, b) => a + b, 0);
                const count = values.length;
                lines.push(`gateway_${name}_seconds_sum${labelStr} ${sum}`);
                lines.push(`gateway_${name}_seconds_count${labelStr} ${count}`);
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
// Predefined metric names
exports.MetricNames = {
    REQUESTS_TOTAL: 'requests_total',
    REQUEST_DURATION_SECONDS: 'request_duration_seconds',
    RETRIES_TOTAL: 'retries_total',
    CIRCUIT_BREAKER_STATE: 'circuit_breaker_state',
    CACHE_HITS_TOTAL: 'cache_hits_total',
    CACHE_MISSES_TOTAL: 'cache_misses_total',
    ACTIVE_CONNECTIONS: 'active_connections',
    TOKEN_GENERATIONS_TOTAL: 'token_generations_total',
    TOKEN_VALIDATIONS_TOTAL: 'token_validations_total',
    TOKEN_EXPIRATIONS_TOTAL: 'token_expirations_total',
    POLICY_DENIALS_TOTAL: 'policy_denials_total',
    AGENT_CREATIONS_TOTAL: 'agent_creations_total',
    CHAOS_INJECTIONS_TOTAL: 'chaos_injections_total',
    CHAOS_CLEARINGS_TOTAL: 'chaos_clearings_total'
};
// Utility functions for common metrics
function recordRequest(tool, action, status, duration) {
    exports.metrics.incrementCounter(exports.MetricNames.REQUESTS_TOTAL, { tool, action, status: status.toString() });
    exports.metrics.recordHistogram(exports.MetricNames.REQUEST_DURATION_SECONDS, duration / 1000, { tool, action });
}
function recordRetry(tool, action) {
    exports.metrics.incrementCounter(exports.MetricNames.RETRIES_TOTAL, { tool, action });
}
function setCircuitBreakerState(tool, state) {
    const value = state === circuit_1.CircuitState.CLOSED ? 0 : state === circuit_1.CircuitState.HALF_OPEN ? 1 : 2;
    exports.metrics.setGauge(exports.MetricNames.CIRCUIT_BREAKER_STATE, value, { tool, state });
}
function recordCacheHit(tool) {
    exports.metrics.incrementCounter(exports.MetricNames.CACHE_HITS_TOTAL, { tool });
}
function recordCacheMiss(tool) {
    exports.metrics.incrementCounter(exports.MetricNames.CACHE_MISSES_TOTAL, { tool });
}
function setActiveConnections(count) {
    exports.metrics.setGauge(exports.MetricNames.ACTIVE_CONNECTIONS, count);
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
//# sourceMappingURL=metrics.js.map
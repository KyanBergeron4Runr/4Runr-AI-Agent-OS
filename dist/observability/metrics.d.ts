import { CircuitState } from '../runtime/circuit';
interface HistogramBucket {
    le: string;
    count: number;
    sum: number;
}
declare class PrometheusMetrics {
    private counters;
    private histograms;
    private gauges;
    private startTime;
    incrementCounter(name: string, labels?: Record<string, string>): void;
    recordHistogram(name: string, value: number, labels?: Record<string, string>): void;
    setGauge(name: string, value: number, labels?: Record<string, string>): void;
    getHistogramStats(name: string, labels?: Record<string, string>, customBuckets?: number[]): HistogramBucket[];
    private formatMetricKey;
    private parseMetricKey;
    private formatLabels;
    generateMetrics(): string;
    reset(): void;
}
export declare const metrics: PrometheusMetrics;
export declare const MetricNames: {
    readonly REQUESTS_TOTAL: "requests_total";
    readonly REQUEST_DURATION_MS: "request_duration_ms";
    readonly CACHE_HITS_TOTAL: "cache_hits_total";
    readonly RETRIES_TOTAL: "retries_total";
    readonly BREAKER_FASTFAIL_TOTAL: "breaker_fastfail_total";
    readonly BREAKER_STATE: "breaker_state";
    readonly TOKEN_GENERATIONS_TOTAL: "token_generations_total";
    readonly TOKEN_VALIDATIONS_TOTAL: "token_validations_total";
    readonly TOKEN_EXPIRATIONS_TOTAL: "token_expirations_total";
    readonly POLICY_DENIALS_TOTAL: "policy_denials_total";
    readonly AGENT_CREATIONS_TOTAL: "agent_creations_total";
    readonly CHAOS_INJECTIONS_TOTAL: "chaos_injections_total";
    readonly CHAOS_CLEARINGS_TOTAL: "chaos_clearings_total";
};
export declare function recordRequest(tool: string, action: string, statusCode: number): void;
export declare function recordRequestDuration(tool: string, action: string, durationMs: number): void;
export declare function recordCacheHit(tool: string, action: string): void;
export declare function recordRetry(tool: string, action: string, reason: string): void;
export declare function recordBreakerFastFail(tool: string): void;
export declare function setBreakerState(tool: string, state: CircuitState): void;
export declare function setActiveConnections(count: number): void;
export declare function recordTokenGeneration(agentId: string): void;
export declare function recordTokenValidation(agentId: string, success: boolean): void;
export declare function recordTokenExpiration(agentId: string): void;
export declare function recordPolicyDenial(agentId: string, tool: string, action: string): void;
export declare function recordAgentCreation(agentId: string): void;
export declare function recordChaosInjection(tool: string, errorType: string): void;
export declare function recordChaosClearing(tool: string): void;
export declare function getMetricsResponse(): string;
export declare class RequestTimer {
    private startTime;
    private tool;
    private action;
    constructor(tool: string, action: string);
    end(): number;
}
export declare function startRequestTimer(tool: string, action: string): RequestTimer;
export {};
//# sourceMappingURL=metrics.d.ts.map
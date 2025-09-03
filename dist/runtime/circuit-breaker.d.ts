import { EventEmitter } from 'events';
export declare enum CircuitState {
    CLOSED = "CLOSED",// Normal operation
    OPEN = "OPEN",// Failing - reject requests  
    HALF_OPEN = "HALF_OPEN"
}
export interface CircuitBreakerOptions {
    failureThreshold: number;
    recoveryTimeout: number;
    monitoringPeriod: number;
    volumeThreshold: number;
    halfOpenMaxCalls: number;
}
export interface CircuitBreakerStats {
    state: CircuitState;
    failures: number;
    requests: number;
    lastFailureTime: number;
    nextAttempt: number;
}
export declare class CircuitBreaker extends EventEmitter {
    private options;
    private state;
    private failures;
    private requests;
    private lastFailureTime;
    private nextAttempt;
    private halfOpenCalls;
    private requestHistory;
    constructor(options: CircuitBreakerOptions);
    execute<T>(fn: () => Promise<T>): Promise<T>;
    private allowRequest;
    private onSuccess;
    private onFailure;
    private shouldOpenCircuit;
    private openCircuit;
    private recordRequest;
    private getRecentRequests;
    private getRecentFailures;
    private cleanupHistory;
    getStats(): CircuitBreakerStats;
    forceOpen(): void;
    forceClose(): void;
}
export declare const gatewayCircuitBreaker: CircuitBreaker;
//# sourceMappingURL=circuit-breaker.d.ts.map
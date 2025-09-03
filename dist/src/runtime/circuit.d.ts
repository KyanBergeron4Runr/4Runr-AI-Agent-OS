export declare enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}
export interface CircuitBreakerConfig {
    failureThreshold: number;
    windowMs: number;
    openMs: number;
    bulkheadConcurrency: number;
}
export interface CircuitBreakerStats {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime?: Date;
    lastSuccessTime?: Date;
    lastStateChangeTime: Date;
}
export declare class CircuitBreaker {
    private state;
    private failureCount;
    private successCount;
    private lastFailureTime?;
    private lastSuccessTime?;
    private lastStateChangeTime;
    private bulkhead;
    private config;
    constructor(config: CircuitBreakerConfig);
    execute<T>(operation: () => Promise<T>): Promise<T>;
    private onSuccess;
    private onFailure;
    private shouldAttemptReset;
    private transitionToOpen;
    private transitionToHalfOpen;
    private transitionToClosed;
    getStats(): CircuitBreakerStats;
    getConfig(): CircuitBreakerConfig;
    isOpen(): boolean;
    isHalfOpen(): boolean;
    isClosed(): boolean;
}
declare class CircuitBreakerRegistry {
    private breakers;
    private defaultConfig;
    constructor(defaultConfig: CircuitBreakerConfig);
    getBreaker(tool: string): CircuitBreaker;
    getAllBreakers(): Map<string, CircuitBreaker>;
    getBreakerStats(): Record<string, CircuitBreakerStats>;
    resetBreaker(tool: string): void;
    resetAllBreakers(): void;
}
export declare const circuitBreakerRegistry: CircuitBreakerRegistry;
export declare function getCircuitBreaker(tool: string): CircuitBreaker;
export declare function executeWithCircuitBreaker<T>(tool: string, operation: () => Promise<T>): Promise<T>;
export {};
//# sourceMappingURL=circuit.d.ts.map
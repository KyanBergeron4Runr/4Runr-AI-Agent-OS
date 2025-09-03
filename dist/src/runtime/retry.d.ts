export interface RetryConfig {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    jitterFactor: number;
}
export interface RetryableOperation {
    tool: string;
    action: string;
    operation: () => Promise<any>;
}
export declare class RetryPolicy {
    private config;
    private retryableTools;
    private nonRetryableActions;
    constructor(config: RetryConfig);
    execute<T>(operation: RetryableOperation): Promise<T>;
    private isRetryable;
    private isRetryableError;
    private calculateDelay;
    private sleep;
    addRetryableTool(tool: string): void;
    removeRetryableTool(tool: string): void;
    addNonRetryableAction(action: string): void;
    removeNonRetryableAction(action: string): void;
    getConfig(): RetryConfig;
    getRetryableTools(): string[];
    getNonRetryableActions(): string[];
}
export declare const retryPolicy: RetryPolicy;
export declare function executeWithRetry<T>(tool: string, action: string, operation: () => Promise<T>): Promise<T>;
//# sourceMappingURL=retry.d.ts.map
export interface HealthStatus {
    ok: boolean;
    timestamp: string;
    uptime: number;
    memory: {
        used: number;
        total: number;
        external: number;
    };
    process: {
        pid: number;
        version: string;
        platform: string;
    };
}
export interface ReadinessStatus {
    ready: boolean;
    timestamp: string;
    checks: {
        database: boolean;
        circuitBreakers: Record<string, boolean>;
        cache: boolean;
    };
    details: {
        database: string;
        circuitBreakers: Record<string, string>;
        cache: string;
    };
}
declare class LifecycleManager {
    private startTime;
    private isShuttingDown;
    private shutdownCallbacks;
    constructor();
    getHealthStatus(): HealthStatus;
    getReadinessStatus(): Promise<ReadinessStatus>;
    onShutdown(callback: () => Promise<void>): void;
    private setupGracefulShutdown;
    private shutdown;
    isShutdownInProgress(): boolean;
    getUptime(): number;
}
export declare const lifecycleManager: LifecycleManager;
export declare function getHealthStatus(): HealthStatus;
export declare function getReadinessStatus(): Promise<ReadinessStatus>;
export declare function onShutdown(callback: () => Promise<void>): void;
export declare function isShutdownInProgress(): boolean;
export {};
//# sourceMappingURL=lifecycle.d.ts.map
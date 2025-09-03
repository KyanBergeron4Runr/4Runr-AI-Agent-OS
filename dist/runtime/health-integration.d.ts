/**
 * Initialize health manager integration
 */
export declare function initializeHealthManager(): void;
/**
 * Get enhanced health status (combines existing + new health manager)
 */
export declare function getEnhancedHealthStatus(): Promise<{
    enhanced: boolean;
    message: string;
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
} | {
    enhanced: boolean;
    healthManager: {
        overall: "healthy" | "degraded" | "unhealthy";
        lastHealthy: Date;
        activeAlerts: number;
        checksCount: number;
        resources: import("./health-manager").ResourceMetrics;
    };
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
} | {
    enhanced: boolean;
    error: string;
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
}>;
/**
 * Add a custom health check to the health manager
 */
export declare function addHealthCheck(name: string, checkFn: () => Promise<boolean>, options?: {
    interval?: number;
    timeout?: number;
    retries?: number;
}): void;
/**
 * Check if health manager is running
 */
export declare function isHealthManagerRunning(): boolean;
//# sourceMappingURL=health-integration.d.ts.map
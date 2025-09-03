import { EventEmitter } from 'events';
export interface HealthCheck {
    name: string;
    check: () => Promise<HealthCheckResult>;
    interval: number;
    timeout: number;
    retries: number;
    successThreshold: number;
    failureThreshold: number;
}
export interface HealthCheckResult {
    healthy: boolean;
    message: string;
    duration: number;
    metadata?: Record<string, any>;
}
export interface ResourceMetrics {
    memory: {
        used: number;
        total: number;
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
    };
    cpu: {
        usage: number;
        loadAverage: number[];
    };
    connections: {
        database: number;
        redis: number;
        http: number;
    };
    fileHandles: {
        open: number;
        limit: number;
    };
    uptime: number;
}
export interface HealthManagerStatus {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    lastHealthy: Date;
    checks: Record<string, HealthCheckResult>;
    resources: ResourceMetrics;
    alerts: HealthAlert[];
}
export interface HealthAlert {
    id: string;
    level: 'warning' | 'critical';
    message: string;
    timestamp: Date;
    resolved: boolean;
}
/**
 * Enhanced Health Manager for long-term stability monitoring
 * Builds on existing lifecycle manager with advanced monitoring
 */
export declare class HealthManager extends EventEmitter {
    private checks;
    private checkResults;
    private checkTimers;
    private alerts;
    private lastHealthyTime;
    private isRunning;
    private resourceHistory;
    private maxHistorySize;
    constructor();
    /**
     * Start health monitoring
     */
    start(): void;
    /**
     * Stop health monitoring
     */
    stop(): void;
    /**
     * Register a custom health check
     */
    registerHealthCheck(check: HealthCheck): void;
    /**
     * Get current health status
     */
    getHealthStatus(): Promise<HealthManagerStatus>;
    /**
     * Get resource usage metrics
     */
    getResourceMetrics(): Promise<ResourceMetrics>;
    /**
     * Detect resource leaks by analyzing trends
     */
    detectResourceLeaks(): Array<{
        type: string;
        trend: string;
        severity: 'warning' | 'critical';
    }>;
    /**
     * Trigger graceful shutdown if health is critical
     */
    gracefulShutdown(reason: string): Promise<void>;
    /**
     * Force restart the process (last resort)
     */
    forceRestart(reason: string): Promise<void>;
    /**
     * Setup default health checks
     */
    private setupDefaultChecks;
    /**
     * Start monitoring a specific health check
     */
    private startHealthCheck;
    /**
     * Execute a health check with retries and timeout
     */
    private executeHealthCheck;
    /**
     * Calculate overall health from individual checks
     */
    private calculateOverallHealth;
    /**
     * Check for alert conditions
     */
    private checkForAlerts;
    /**
     * Create a new alert
     */
    private createAlert;
    /**
     * Start resource monitoring
     */
    private startResourceMonitoring;
    /**
     * Setup resource leak detection integration
     */
    private setupLeakDetection;
    /**
     * Start resource leak detection
     */
    startLeakDetection(): void;
    /**
     * Stop resource leak detection
     */
    stopLeakDetection(): void;
    /**
     * Get current resource leak statistics
     */
    getLeakDetectionStats(): {
        monitoringDuration: number;
        snapshotCount: number;
        averageMemoryUsage: number;
        averageConnections: number;
        peakMemoryUsage: number;
        peakConnections: number;
    };
    /**
     * Get resource usage history
     */
    getResourceHistory(hours?: number): import("./resource-leak-detector").ResourceUsageSnapshot[];
    private getDatabaseConnections;
    private getRedisConnections;
    private getHttpConnections;
    private getOpenFileHandles;
    private getFileHandleLimit;
}
export declare const healthManager: HealthManager;
//# sourceMappingURL=health-manager.d.ts.map
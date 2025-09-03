import { EventEmitter } from 'events';
export interface SystemMetrics {
    timestamp: Date;
    cpu: {
        usage: number;
        loadAverage: number[];
    };
    memory: {
        total: number;
        used: number;
        free: number;
        available: number;
    };
    disk: {
        total: number;
        used: number;
        free: number;
    };
    network: {
        bytesIn: number;
        bytesOut: number;
        packetsIn: number;
        packetsOut: number;
    };
}
export interface DockerMetrics {
    timestamp: Date;
    containers: Array<{
        id: string;
        name: string;
        cpu: number;
        memory: {
            usage: number;
            limit: number;
            percent: number;
        };
        network: {
            rx: number;
            tx: number;
        };
        blockIO: {
            read: number;
            write: number;
        };
    }>;
}
export interface ApplicationMetrics {
    timestamp: Date;
    prometheus: string;
    parsed: {
        counters: Record<string, number>;
        gauges: Record<string, number>;
        histograms: Record<string, any>;
    };
}
export interface InfrastructureMetrics {
    timestamp: Date;
    database: {
        connected: boolean;
        responseTime?: number;
        error?: string;
    };
    redis: {
        connected: boolean;
        responseTime?: number;
        error?: string;
    };
    external: {
        [service: string]: {
            connected: boolean;
            responseTime?: number;
            error?: string;
        };
    };
}
export interface MonitoringSnapshot {
    timestamp: Date;
    level: 'application' | 'system' | 'docker' | 'infrastructure';
    data: SystemMetrics | DockerMetrics | ApplicationMetrics | InfrastructureMetrics;
    success: boolean;
    error?: string;
}
/**
 * Multi-Level Monitoring System
 * Collects metrics at different levels and persists data even during application failures
 */
export declare class MultiLevelMonitor extends EventEmitter {
    private isRunning;
    private collectors;
    private storageDir;
    private maxStorageFiles;
    private collectionIntervals;
    private retryAttempts;
    private retryDelay;
    constructor(options?: {
        storageDir?: string;
        maxStorageFiles?: number;
        collectionIntervals?: Record<string, number>;
    });
    /**
     * Start multi-level monitoring
     */
    start(): Promise<void>;
    /**
     * Stop monitoring
     */
    stop(): Promise<void>;
    /**
     * Get recent monitoring data
     */
    getRecentData(level?: string, limit?: number): Promise<MonitoringSnapshot[]>;
    /**
     * Query monitoring data by time range
     */
    queryData(options?: {
        level?: string;
        startTime?: Date;
        endTime?: Date;
        limit?: number;
    }): Promise<MonitoringSnapshot[]>;
    /**
     * Start application-level monitoring
     */
    private startApplicationMonitoring;
    /**
     * Start system-level monitoring
     */
    private startSystemMonitoring;
    /**
     * Start Docker monitoring
     */
    private startDockerMonitoring;
    /**
     * Start infrastructure monitoring
     */
    private startInfrastructureMonitoring;
    /**
     * Collect application metrics (Prometheus)
     */
    private collectApplicationMetrics;
    /**
     * Collect system metrics
     */
    private collectSystemMetrics;
    /**
     * Collect Docker metrics
     */
    private collectDockerMetrics;
    /**
     * Collect infrastructure metrics
     */
    private collectInfrastructureMetrics;
    /**
     * Execute with retry logic
     */
    private withRetry;
    /**
     * Store monitoring snapshot to disk
     */
    private storeSnapshot;
    /**
     * Parse Prometheus metrics into structured data
     */
    private parsePrometheusMetrics;
    /**
     * Get CPU metrics
     */
    private getCpuMetrics;
    /**
     * Get memory metrics
     */
    private getMemoryMetrics;
    /**
     * Get disk metrics (simplified)
     */
    private getDiskMetrics;
    /**
     * Get network metrics (simplified)
     */
    private getNetworkMetrics;
    /**
     * Get Docker stats
     */
    private getDockerStats;
    /**
     * Parse Docker stats output
     */
    private parseDockerStats;
    /**
     * Parse size string to bytes
     */
    private parseSize;
    /**
     * Check database health
     */
    private checkDatabaseHealth;
    /**
     * Check Redis health
     */
    private checkRedisHealth;
    /**
     * Check external services health
     */
    private checkExternalServices;
    /**
     * Start cleanup routine to manage storage
     */
    private startCleanupRoutine;
    /**
     * Clean up old monitoring files
     */
    private cleanupOldFiles;
}
export declare const multiLevelMonitor: MultiLevelMonitor;
//# sourceMappingURL=multi-level-monitor.d.ts.map
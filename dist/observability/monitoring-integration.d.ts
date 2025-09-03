/**
 * Initialize multi-level monitoring integration
 */
export declare function initializeMonitoring(): void;
/**
 * Get monitoring dashboard data
 */
export declare function getMonitoringDashboard(): Promise<{
    enabled: boolean;
    message: string;
    timestamp?: undefined;
    levels?: undefined;
    summary?: undefined;
    error?: undefined;
} | {
    enabled: boolean;
    timestamp: string;
    levels: {
        application: {
            recentCollections: number;
            successRate: number;
            lastCollection: Date;
            status: string;
        };
        system: {
            recentCollections: number;
            successRate: number;
            lastCollection: Date;
            status: string;
        };
        docker: {
            recentCollections: number;
            successRate: number;
            lastCollection: Date;
            status: string;
        };
        infrastructure: {
            recentCollections: number;
            successRate: number;
            lastCollection: Date;
            status: string;
        };
    };
    summary: {
        totalCollections: number;
        overallSuccessRate: number;
        healthyLevels: number;
        totalLevels: number;
    };
    message?: undefined;
    error?: undefined;
} | {
    enabled: boolean;
    error: string;
    timestamp: string;
    message?: undefined;
    levels?: undefined;
    summary?: undefined;
}>;
/**
 * Get metrics for a specific time range
 */
export declare function getMetricsHistory(options?: {
    level?: string;
    hours?: number;
    limit?: number;
}): Promise<import("./multi-level-monitor").MonitoringSnapshot[]>;
/**
 * Get current system health summary
 */
export declare function getSystemHealthSummary(): Promise<{
    enabled: boolean;
    message: string;
    error?: undefined;
    timestamp?: undefined;
} | {
    timestamp: string;
    application: {
        available: boolean;
        metricsCount: number;
        lastUpdate: Date;
    };
    system: {
        available: boolean;
        cpuUsage: any;
        memoryUsage: any;
        lastUpdate: Date;
    };
    docker: {
        available: boolean;
        containerCount: any;
        lastUpdate: Date;
    };
    infrastructure: {
        available: boolean;
        databaseConnected: any;
        redisConnected: any;
        lastUpdate: Date;
    };
    enabled: boolean;
    overallHealth: string;
    healthyLevels: number;
    totalLevels: number;
    message?: undefined;
    error?: undefined;
} | {
    enabled: boolean;
    error: string;
    timestamp: string;
    message?: undefined;
}>;
/**
 * Force collection of all metrics (useful for testing)
 */
export declare function forceMetricsCollection(): Promise<{
    enabled: boolean;
    message: string;
    error?: undefined;
    timestamp?: undefined;
} | {
    timestamp: string;
    application: {
        available: boolean;
        metricsCount: number;
        lastUpdate: Date;
    };
    system: {
        available: boolean;
        cpuUsage: any;
        memoryUsage: any;
        lastUpdate: Date;
    };
    docker: {
        available: boolean;
        containerCount: any;
        lastUpdate: Date;
    };
    infrastructure: {
        available: boolean;
        databaseConnected: any;
        redisConnected: any;
        lastUpdate: Date;
    };
    enabled: boolean;
    overallHealth: string;
    healthyLevels: number;
    totalLevels: number;
    message?: undefined;
    error?: undefined;
} | {
    enabled: boolean;
    error: string;
    timestamp: string;
    message?: undefined;
}>;
/**
 * Check if monitoring is running
 */
export declare function isMonitoringRunning(): boolean;
/**
 * Get monitoring statistics
 */
export declare function getMonitoringStats(): Promise<{
    enabled: boolean;
    message: string;
    period?: undefined;
    timestamp?: undefined;
    levels?: undefined;
    summary?: undefined;
    error?: undefined;
} | {
    enabled: boolean;
    period: string;
    timestamp: string;
    levels: {
        level: string;
        totalCollections: number;
        successful: number;
        failed: number;
        successRate: number;
        lastCollection: any;
        oldestCollection: any;
    }[];
    summary: {
        totalCollections: number;
        successfulCollections: number;
        failedCollections: number;
        overallSuccessRate: number;
    };
    message?: undefined;
    error?: undefined;
} | {
    enabled: boolean;
    error: string;
    timestamp: string;
    message?: undefined;
    period?: undefined;
    levels?: undefined;
    summary?: undefined;
}>;
//# sourceMappingURL=monitoring-integration.d.ts.map
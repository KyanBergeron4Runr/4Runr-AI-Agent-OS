import { EventEmitter } from 'events';
export interface ResourceUsageSnapshot {
    timestamp: Date;
    memory: {
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
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
    eventListeners: {
        total: number;
        byEmitter: Record<string, number>;
    };
    timers: {
        active: number;
        intervals: number;
        timeouts: number;
    };
}
export interface LeakDetectionResult {
    type: 'memory' | 'connections' | 'fileHandles' | 'eventListeners' | 'timers';
    severity: 'warning' | 'critical';
    trend: 'increasing' | 'stable' | 'decreasing';
    currentValue: number;
    baselineValue: number;
    changePercent: number;
    timeWindow: number;
    message: string;
    recommendations: string[];
}
export interface LeakDetectionConfig {
    monitoringInterval: number;
    analysisWindow: number;
    memoryLeakThreshold: number;
    connectionLeakThreshold: number;
    fileHandleLeakThreshold: number;
    eventListenerLeakThreshold: number;
    timerLeakThreshold: number;
    historyRetention: number;
}
/**
 * Resource Leak Detection System
 * Monitors system resources for potential leaks and provides early warning
 */
export declare class ResourceLeakDetector extends EventEmitter {
    private config;
    private snapshots;
    private isMonitoring;
    private monitoringInterval?;
    private analysisInterval?;
    constructor(config?: Partial<LeakDetectionConfig>);
    /**
     * Start resource leak monitoring
     */
    start(): void;
    /**
     * Stop resource leak monitoring
     */
    stop(): void;
    /**
     * Take a resource usage snapshot
     */
    takeSnapshot(): Promise<ResourceUsageSnapshot>;
    /**
     * Analyze snapshots for potential leaks
     */
    analyzeLeaks(): LeakDetectionResult[];
    /**
     * Analyze memory usage for leaks
     */
    private analyzeMemoryLeaks;
    /**
     * Analyze database and Redis connections for leaks
     */
    private analyzeConnectionLeaks;
    /**
     * Analyze file handle usage for leaks
     */
    private analyzeFileHandleLeaks;
    /**
     * Analyze event listener count for leaks
     */
    private analyzeEventListenerLeaks;
    /**
     * Analyze timer count for leaks
     */
    private analyzeTimerLeaks;
    /**
     * Get current resource usage summary
     */
    getCurrentUsage(): ResourceUsageSnapshot | null;
    /**
     * Get resource usage history
     */
    getUsageHistory(hours?: number): ResourceUsageSnapshot[];
    /**
     * Get leak detection statistics
     */
    getLeakStatistics(): {
        monitoringDuration: number;
        snapshotCount: number;
        averageMemoryUsage: number;
        averageConnections: number;
        peakMemoryUsage: number;
        peakConnections: number;
    };
    /**
     * Helper methods for resource counting
     */
    private getDatabaseConnections;
    private getRedisConnections;
    private getHttpConnections;
    private getOpenFileHandles;
    private getFileHandleLimit;
    private getEventListenerCount;
    private getTimerCount;
}
export declare const resourceLeakDetector: ResourceLeakDetector;
//# sourceMappingURL=resource-leak-detector.d.ts.map
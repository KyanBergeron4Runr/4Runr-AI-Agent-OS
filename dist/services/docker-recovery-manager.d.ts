import { EventEmitter } from 'events';
export interface ContainerRecoveryStrategy {
    id: string;
    name: string;
    description: string;
    priority: number;
    conditions: RecoveryCondition[];
    actions: RecoveryAction[];
    timeout: number;
    retries: number;
}
export interface RecoveryCondition {
    type: 'health_status' | 'restart_count' | 'memory_usage' | 'cpu_usage' | 'uptime' | 'custom';
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    threshold: number | string;
    duration?: number;
}
export interface RecoveryAction {
    type: 'restart_container' | 'stop_container' | 'recreate_container' | 'scale_service' | 'collect_logs' | 'notify_operator';
    target?: string;
    parameters?: Record<string, any>;
    timeout?: number;
}
export interface RecoveryAttempt {
    id: string;
    containerId: string;
    containerName: string;
    strategyId: string;
    startTime: Date;
    endTime?: Date;
    status: 'running' | 'success' | 'failed' | 'timeout';
    actions: RecoveryActionResult[];
    logs: string[];
    error?: string;
}
export interface RecoveryActionResult {
    action: RecoveryAction;
    startTime: Date;
    endTime?: Date;
    status: 'running' | 'success' | 'failed' | 'timeout';
    result?: any;
    error?: string;
}
export interface ContainerLogEntry {
    containerId: string;
    containerName: string;
    timestamp: Date;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    source: string;
}
export interface RecoveryConfig {
    logCollectionEnabled: boolean;
    logRetentionDays: number;
    maxLogSizeMB: number;
    recoveryTimeout: number;
    maxConcurrentRecoveries: number;
    notificationThreshold: number;
    logDirectory: string;
}
/**
 * Docker Container Recovery Manager
 * Provides automatic container recovery, log collection, and performance monitoring
 */
export declare class DockerRecoveryManager extends EventEmitter {
    private config;
    private strategies;
    private activeRecoveries;
    private recoveryHistory;
    private containerLogs;
    private isRunning;
    private logCollectionInterval?;
    constructor(config?: Partial<RecoveryConfig>);
    /**
     * Start recovery manager
     */
    start(): Promise<void>;
    /**
     * Stop recovery manager
     */
    stop(): Promise<void>;
    /**
     * Execute container recovery
     */
    executeRecovery(containerId: string, strategyId?: string): Promise<RecoveryAttempt>;
    /**
     * Collect container logs
     */
    collectContainerLogs(containerId: string, attempt?: RecoveryAttempt): Promise<ContainerLogEntry[]>;
    /**
     * Monitor container performance
     */
    monitorContainerPerformance(containerId: string): Promise<{
        cpuTrend: 'increasing' | 'decreasing' | 'stable';
        memoryTrend: 'increasing' | 'decreasing' | 'stable';
        restartFrequency: number;
        healthScore: number;
    }>;
    /**
     * Get recovery statistics
     */
    getRecoveryStatistics(hours?: number): {
        totalAttempts: number;
        successfulAttempts: number;
        failedAttempts: number;
        successRate: number;
        averageRecoveryTime: number;
        strategiesUsed: Record<string, number>;
        containerFailures: Record<string, number>;
    };
    /**
     * Setup default recovery strategies
     */
    private setupDefaultStrategies;
    /**
     * Add recovery strategy
     */
    addRecoveryStrategy(strategy: ContainerRecoveryStrategy): void;
    /**
     * Setup container manager event listeners
     */
    private setupContainerManagerListeners;
    /**
     * Start log collection
     */
    private startLogCollection;
    /**
     * Select appropriate recovery strategy
     */
    private selectRecoveryStrategy;
    /**
     * Execute recovery actions
     */
    private executeRecoveryActions;
    /**
     * Execute individual recovery action
     */
    private executeRecoveryAction;
    /**
     * Recreate container (simplified - would need more complex logic in production)
     */
    private recreateContainer;
    /**
     * Validate recovery success
     */
    private validateRecovery;
    /**
     * Evaluate recovery conditions
     */
    private evaluateConditions;
    /**
     * Get condition value
     */
    private getConditionValue;
    /**
     * Compare values with operator
     */
    private compareValues;
    /**
     * Analyze trend in numeric values
     */
    private analyzeTrend;
    /**
     * Parse container logs
     */
    private parseContainerLogs;
    /**
     * Persist container logs to file
     */
    private persistContainerLogs;
    /**
     * Persist recovery attempt
     */
    private persistRecoveryAttempt;
    /**
     * Generate attempt ID
     */
    private generateAttemptId;
}
export declare const dockerRecoveryManager: DockerRecoveryManager;
//# sourceMappingURL=docker-recovery-manager.d.ts.map
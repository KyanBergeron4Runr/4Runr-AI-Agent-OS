import { EventEmitter } from 'events';
export interface RecoveryStrategy {
    id: string;
    name: string;
    description: string;
    type: 'soft' | 'medium' | 'hard';
    priority: number;
    timeout: number;
    retries: number;
    conditions: RecoveryCondition[];
    actions: RecoveryAction[];
    validation: RecoveryValidation;
    rollback?: RecoveryAction[];
}
export interface RecoveryCondition {
    type: 'health_status' | 'memory_usage' | 'response_time' | 'error_rate' | 'custom';
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    threshold: number | string;
    duration?: number;
}
export interface RecoveryAction {
    type: 'gc_trigger' | 'cache_clear' | 'connection_reset' | 'service_restart' | 'container_restart' | 'custom';
    target?: string;
    parameters?: Record<string, any>;
    timeout?: number;
}
export interface RecoveryValidation {
    checks: ValidationCheck[];
    timeout: number;
    retries: number;
}
export interface ValidationCheck {
    type: 'health_endpoint' | 'memory_check' | 'response_time' | 'custom';
    target?: string;
    expected: any;
    timeout: number;
}
export interface RecoveryAttempt {
    id: string;
    strategyId: string;
    startTime: Date;
    endTime?: Date;
    status: 'running' | 'success' | 'failed' | 'timeout' | 'rollback';
    actions: RecoveryActionResult[];
    validationResults: ValidationResult[];
    error?: string;
    metrics?: Record<string, any>;
}
export interface RecoveryActionResult {
    action: RecoveryAction;
    startTime: Date;
    endTime?: Date;
    status: 'running' | 'success' | 'failed' | 'timeout';
    result?: any;
    error?: string;
}
export interface ValidationResult {
    check: ValidationCheck;
    success: boolean;
    value: any;
    expected: any;
    error?: string;
}
export interface RecoveryEvent {
    id: string;
    timestamp: Date;
    type: 'recovery_started' | 'recovery_completed' | 'recovery_failed' | 'escalation_triggered';
    strategyId: string;
    reason: string;
    success: boolean;
    duration?: number;
    details?: any;
}
/**
 * Recovery Controller for automated system recovery
 * Implements multiple recovery strategies with validation and escalation
 */
export declare class RecoveryController extends EventEmitter {
    private strategies;
    private activeAttempts;
    private recoveryHistory;
    private isRunning;
    private maxHistorySize;
    private storageDir;
    constructor(options?: {
        storageDir?: string;
        maxHistorySize?: number;
    });
    /**
     * Start recovery controller
     */
    start(): Promise<void>;
    /**
     * Stop recovery controller
     */
    stop(): Promise<void>;
    /**
     * Execute recovery strategy
     */
    executeRecovery(strategyId: string, reason: string, context?: Record<string, any>): Promise<RecoveryAttempt>;
    /**
     * Execute escalated recovery (try multiple strategies)
     */
    executeEscalatedRecovery(reason: string, context?: Record<string, any>): Promise<RecoveryAttempt[]>;
    /**
     * Add custom recovery strategy
     */
    addRecoveryStrategy(strategy: RecoveryStrategy): void;
    /**
     * Remove recovery strategy
     */
    removeRecoveryStrategy(strategyId: string): boolean;
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
        escalations: number;
    };
    /**
     * Get active recovery attempts
     */
    getActiveAttempts(): RecoveryAttempt[];
    /**
     * Get recovery history
     */
    getRecoveryHistory(limit?: number): RecoveryEvent[];
    /**
     * Setup default recovery strategies
     */
    private setupDefaultStrategies;
    /**
     * Check if recovery conditions are met
     */
    private checkConditions;
    /**
     * Execute recovery actions
     */
    private executeActions;
    /**
     * Execute individual recovery action
     */
    private executeAction;
    /**
     * Validate recovery success
     */
    private validateRecovery;
    /**
     * Execute validation check
     */
    private executeValidationCheck;
    /**
     * Recovery action implementations
     */
    private triggerGarbageCollection;
    private clearCache;
    private resetConnections;
    private restartService;
    private restartContainer;
    /**
     * Validation check implementations
     */
    private checkHealthEndpoint;
    private checkMemoryUsage;
    private checkResponseTime;
    /**
     * Utility methods
     */
    private evaluateCondition;
    private compareValues;
    private validateCheckResult;
    private executeCommand;
    private generateAttemptId;
    private recordRecoveryEvent;
    private persistAttempt;
    private saveRecoveryHistory;
    private loadRecoveryHistory;
}
export declare const recoveryController: RecoveryController;
//# sourceMappingURL=recovery-controller.d.ts.map
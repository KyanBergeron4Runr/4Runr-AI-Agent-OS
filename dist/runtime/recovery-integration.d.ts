/**
 * Initialize recovery controller integration
 */
export declare function initializeRecoveryIntegration(): void;
/**
 * Manually trigger recovery
 */
export declare function triggerRecovery(strategyId: string, reason: string, context?: Record<string, any>): Promise<import("./recovery-controller").RecoveryAttempt>;
/**
 * Manually trigger escalated recovery
 */
export declare function triggerEscalatedRecovery(reason: string, context?: Record<string, any>): Promise<import("./recovery-controller").RecoveryAttempt[]>;
/**
 * Get recovery status and statistics
 */
export declare function getRecoveryStatus(): {
    enabled: boolean;
    statistics: {
        totalAttempts: number;
        successfulAttempts: number;
        failedAttempts: number;
        successRate: number;
        averageRecoveryTime: number;
        strategiesUsed: Record<string, number>;
        escalations: number;
    };
    activeAttempts: number;
    recentHistory: import("./recovery-controller").RecoveryEvent[];
};
/**
 * Add custom recovery strategy
 */
export declare function addCustomRecoveryStrategy(strategy: any): void;
/**
 * Get available recovery strategies
 */
export declare function getRecoveryStrategies(): string[];
//# sourceMappingURL=recovery-integration.d.ts.map
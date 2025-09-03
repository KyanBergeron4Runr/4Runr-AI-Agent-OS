import { EventEmitter } from 'events';
export interface DegradationLevel {
    level: number;
    name: string;
    description: string;
    triggers: DegradationTrigger[];
    actions: DegradationAction[];
    recoveryThreshold: number;
}
export interface DegradationTrigger {
    type: 'memory' | 'cpu' | 'response_time' | 'error_rate' | 'queue_depth' | 'custom';
    threshold: number;
    duration: number;
    operator: '>' | '<' | '>=' | '<=' | '==';
}
export interface DegradationAction {
    type: 'disable_feature' | 'reduce_cache' | 'limit_requests' | 'close_connections' | 'gc_trigger' | 'custom';
    target?: string;
    parameters?: Record<string, any>;
}
export interface DegradationStatus {
    active: boolean;
    level: number;
    levelName: string;
    activatedAt?: Date;
    triggers: string[];
    actions: string[];
    metrics: {
        requestsDropped: number;
        featuresDisabled: string[];
        cacheReductions: number;
        connectionsDropped: number;
    };
}
export interface LoadSheddingConfig {
    enabled: boolean;
    maxQueueSize: number;
    dropProbability: number;
    priorityLevels: Record<string, number>;
    exemptPaths: string[];
}
export interface BackpressureConfig {
    enabled: boolean;
    maxConcurrentRequests: number;
    queueTimeout: number;
    slowConsumerThreshold: number;
}
/**
 * Graceful Degradation Controller
 * Maintains service availability under stress through intelligent load shedding and feature degradation
 */
export declare class DegradationController extends EventEmitter {
    private degradationLevels;
    private currentLevel;
    private isActive;
    private activatedAt?;
    private monitoringTimer;
    private metrics;
    private loadSheddingConfig;
    private backpressureConfig;
    private requestQueue;
    private activeRequests;
    private disabledFeatures;
    private connectionLimits;
    constructor();
    /**
     * Start degradation monitoring
     */
    start(): void;
    /**
     * Stop degradation monitoring
     */
    stop(): void;
    /**
     * Get current degradation status
     */
    getStatus(): DegradationStatus;
    /**
     * Check if a feature is enabled (not degraded)
     */
    isFeatureEnabled(feature: string): boolean;
    /**
     * Apply load shedding to incoming request
     */
    shouldAcceptRequest(request: {
        path: string;
        priority?: string;
        timestamp?: Date;
    }): {
        accept: boolean;
        reason?: string;
    };
    /**
     * Register request start
     */
    registerRequestStart(requestId: string): void;
    /**
     * Register request completion
     */
    registerRequestComplete(requestId: string): void;
    /**
     * Trigger garbage collection
     */
    triggerGarbageCollection(): void;
    /**
     * Close idle connections
     */
    closeIdleConnections(): void;
    /**
     * Clear caches with priority
     */
    clearCaches(priority?: 'low' | 'medium' | 'high'): void;
    /**
     * Disable non-essential feature
     */
    disableFeature(feature: string): void;
    /**
     * Re-enable feature
     */
    enableFeature(feature: string): void;
    /**
     * Open circuit breaker for service
     */
    openCircuit(service: string, reason: string): void;
    /**
     * Close circuit breaker for service
     */
    closeCircuit(service: string): void;
    /**
     * Add custom degradation level
     */
    addDegradationLevel(level: DegradationLevel): void;
    /**
     * Force degradation to specific level
     */
    forceDegradation(level: number, reason?: string): void;
    /**
     * Force recovery from degradation
     */
    forceRecovery(reason?: string): void;
    /**
     * Setup default degradation levels
     */
    private setupDefaultDegradationLevels;
    /**
     * Evaluate degradation conditions
     */
    private evaluateDegradationConditions;
    /**
     * Get current system metrics
     */
    private getCurrentMetrics;
    /**
     * Check if degradation level should be activated
     */
    private shouldActivateLevel;
    /**
     * Check if we should recover from degradation
     */
    private shouldRecover;
    /**
     * Get triggered conditions for a level
     */
    private getTriggeredConditions;
    /**
     * Activate degradation level
     */
    private activateDegradation;
    /**
     * Deactivate degradation
     */
    private deactivateDegradation;
    /**
     * Execute degradation action
     */
    private executeAction;
    /**
     * Restore normal operation
     */
    private restoreNormalOperation;
    /**
     * Utility methods
     */
    private getCurrentLevelName;
    private getActiveTriggers;
    private getActiveActions;
    private getClearRatio;
    private getAverageResponseTime;
    private getErrorRate;
}
export declare const degradationController: DegradationController;
//# sourceMappingURL=degradation-controller.d.ts.map
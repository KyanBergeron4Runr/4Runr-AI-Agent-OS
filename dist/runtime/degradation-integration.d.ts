/**
 * Initialize graceful degradation integration
 */
export declare function initializeDegradation(): void;
/**
 * Get degradation status
 */
export declare function getDegradationStatus(): {
    enabled: boolean;
    message: string;
} | {
    recommendations: string[];
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
    enabled: boolean;
    timestamp: string;
    message?: undefined;
};
/**
 * Check if a feature is available (not degraded)
 */
export declare function isFeatureAvailable(feature: string): boolean;
/**
 * Apply load shedding to request
 */
export declare function shouldAcceptRequest(request: {
    path: string;
    method?: string;
    priority?: string;
    userAgent?: string;
}): {
    accept: boolean;
    reason?: string;
    queuePosition?: number;
};
/**
 * Register request lifecycle events
 */
export declare function registerRequest(requestId: string): void;
export declare function completeRequest(requestId: string): void;
/**
 * Force degradation for testing or emergency
 */
export declare function forceDegradation(level: number, reason?: string): void;
/**
 * Force recovery from degradation
 */
export declare function forceRecovery(reason?: string): void;
/**
 * Trigger emergency actions
 */
export declare function triggerEmergencyActions(): {
    success: boolean;
    actions: string[];
    timestamp: string;
};
/**
 * Get degradation metrics and statistics
 */
export declare function getDegradationMetrics(): {
    enabled: boolean;
    message: string;
    timestamp?: undefined;
    currentStatus?: undefined;
    capabilities?: undefined;
    degradationLevels?: undefined;
} | {
    enabled: boolean;
    timestamp: string;
    currentStatus: import("./degradation-controller").DegradationStatus;
    capabilities: {
        loadShedding: boolean;
        featureDegradation: boolean;
        backpressureManagement: boolean;
        automaticRecovery: boolean;
        emergencyActions: boolean;
    };
    degradationLevels: {
        level: number;
        name: string;
        description: string;
        triggers: string[];
    }[];
    message?: undefined;
};
/**
 * Test degradation system
 */
export declare function testDegradationSystem(): Promise<{
    summary: {
        passed: number;
        total: number;
        successRate: number;
    };
    tests: Array<{
        name: string;
        success: boolean;
        details: string;
    }>;
    success: boolean;
    timestamp: string;
}>;
/**
 * Check if degradation is running
 */
export declare function isDegradationRunning(): boolean;
//# sourceMappingURL=degradation-integration.d.ts.map
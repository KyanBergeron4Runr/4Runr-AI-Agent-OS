/**
 * Initialize alert management integration
 */
export declare function initializeAlerting(): void;
/**
 * Create a manual alert
 */
export declare function createManualAlert(options: {
    level: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    category: string;
    metadata?: Record<string, any>;
}): Promise<import("./alert-manager").Alert>;
/**
 * Get alert dashboard data
 */
export declare function getAlertDashboard(): Promise<{
    enabled: boolean;
    message: string;
    timestamp?: undefined;
    summary?: undefined;
    statistics?: undefined;
    activeAlerts?: undefined;
    recentAlerts?: undefined;
    correlations?: undefined;
} | {
    enabled: boolean;
    timestamp: string;
    summary: {
        activeAlerts: number;
        criticalAlerts: number;
        warningAlerts: number;
        infoAlerts: number;
        activeCorrelations: number;
    };
    statistics: {
        total: number;
        byLevel: Record<import("./alert-manager").Alert["level"], number>;
        byCategory: Record<string, number>;
        resolved: number;
        acknowledged: number;
        escalated: number;
        suppressed: number;
    };
    activeAlerts: {
        critical: {
            id: any;
            level: any;
            title: any;
            message: any;
            source: any;
            category: any;
            timestamp: any;
            resolved: any;
            resolvedAt: any;
            resolvedBy: any;
            acknowledgedBy: any;
            acknowledgedAt: any;
            escalationLevel: any;
            correlationId: any;
        }[];
        warning: {
            id: any;
            level: any;
            title: any;
            message: any;
            source: any;
            category: any;
            timestamp: any;
            resolved: any;
            resolvedAt: any;
            resolvedBy: any;
            acknowledgedBy: any;
            acknowledgedAt: any;
            escalationLevel: any;
            correlationId: any;
        }[];
        info: {
            id: any;
            level: any;
            title: any;
            message: any;
            source: any;
            category: any;
            timestamp: any;
            resolved: any;
            resolvedAt: any;
            resolvedBy: any;
            acknowledgedBy: any;
            acknowledgedAt: any;
            escalationLevel: any;
            correlationId: any;
        }[];
    };
    recentAlerts: {
        id: any;
        level: any;
        title: any;
        message: any;
        source: any;
        category: any;
        timestamp: any;
        resolved: any;
        resolvedAt: any;
        resolvedBy: any;
        acknowledgedBy: any;
        acknowledgedAt: any;
        escalationLevel: any;
        correlationId: any;
    }[];
    correlations: {
        id: any;
        alertCount: any;
        category: any;
        severity: any;
        startTime: any;
        endTime: any;
        description: any;
        resolved: boolean;
    }[];
    message?: undefined;
}>;
/**
 * Get alert statistics
 */
export declare function getAlertStatistics(hours?: number): Promise<{
    enabled: boolean;
    message: string;
} | {
    currentlyActive: {
        total: number;
        critical: number;
        warning: number;
        info: number;
    };
    total: number;
    byLevel: Record<import("./alert-manager").Alert["level"], number>;
    byCategory: Record<string, number>;
    resolved: number;
    acknowledged: number;
    escalated: number;
    suppressed: number;
    enabled: boolean;
    period: string;
    timestamp: string;
    message?: undefined;
}>;
/**
 * Resolve an alert
 */
export declare function resolveAlert(alertId: string, resolvedBy?: string): Promise<boolean>;
/**
 * Acknowledge an alert
 */
export declare function acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean>;
/**
 * Get alert history
 */
export declare function getAlertHistory(options?: {
    limit?: number;
    level?: 'info' | 'warning' | 'critical';
    category?: string;
    hours?: number;
}): Promise<{
    id: any;
    level: any;
    title: any;
    message: any;
    source: any;
    category: any;
    timestamp: any;
    resolved: any;
    resolvedAt: any;
    resolvedBy: any;
    acknowledgedBy: any;
    acknowledgedAt: any;
    escalationLevel: any;
    correlationId: any;
}[]>;
/**
 * Test alert system
 */
export declare function testAlertSystem(): Promise<{
    success: boolean;
    alertsCreated: number;
    alertsResolved: number;
}>;
/**
 * Check if alerting is running
 */
export declare function isAlertingRunning(): boolean;
//# sourceMappingURL=alert-integration.d.ts.map
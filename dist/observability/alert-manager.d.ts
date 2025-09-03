import { EventEmitter } from 'events';
export interface Alert {
    id: string;
    level: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    source: string;
    category: string;
    timestamp: Date;
    resolved: boolean;
    resolvedAt?: Date;
    resolvedBy?: string;
    metadata?: Record<string, any>;
    correlationId?: string;
    suppressUntil?: Date;
    escalationLevel: number;
    escalatedAt?: Date[];
    acknowledgedBy?: string;
    acknowledgedAt?: Date;
}
export interface AlertRule {
    id: string;
    name: string;
    description: string;
    condition: (context: AlertContext) => boolean;
    level: Alert['level'];
    category: string;
    cooldownMs: number;
    escalationRules?: EscalationRule[];
    autoResolve?: boolean;
    autoResolveCondition?: (context: AlertContext) => boolean;
    suppressionRules?: SuppressionRule[];
}
export interface EscalationRule {
    afterMinutes: number;
    escalateTo: Alert['level'];
    notifyChannels: string[];
    autoActions?: string[];
}
export interface SuppressionRule {
    condition: (alert: Alert, existingAlerts: Alert[]) => boolean;
    durationMs: number;
    reason: string;
}
export interface AlertContext {
    metrics: Record<string, any>;
    healthStatus: any;
    systemMetrics: any;
    dockerMetrics: any;
    infrastructureMetrics: any;
    recentAlerts: Alert[];
    timestamp: Date;
}
export interface AlertCorrelation {
    id: string;
    alerts: Alert[];
    rootCause?: Alert;
    category: string;
    severity: Alert['level'];
    startTime: Date;
    endTime?: Date;
    description: string;
}
export interface AlertResponse {
    id: string;
    alertId: string;
    action: string;
    result: 'success' | 'failure' | 'pending';
    timestamp: Date;
    details?: any;
    error?: string;
}
/**
 * Enhanced Alert Management System
 * Provides intelligent alerting with correlation, suppression, and automated responses
 */
export declare class AlertManager extends EventEmitter {
    private alerts;
    private alertRules;
    private correlations;
    private responses;
    private alertHistory;
    private isRunning;
    private evaluationTimer;
    private storageDir;
    private maxHistorySize;
    private evaluationInterval;
    constructor(options?: {
        storageDir?: string;
        maxHistorySize?: number;
        evaluationInterval?: number;
    });
    /**
     * Start alert management
     */
    start(): Promise<void>;
    /**
     * Stop alert management
     */
    stop(): Promise<void>;
    /**
     * Create a new alert
     */
    createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'resolved' | 'escalationLevel'>): Promise<Alert>;
    /**
     * Resolve an alert
     */
    resolveAlert(alertId: string, resolvedBy?: string): Promise<boolean>;
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean>;
    /**
     * Add alert rule
     */
    addAlertRule(rule: AlertRule): void;
    /**
     * Remove alert rule
     */
    removeAlertRule(ruleId: string): boolean;
    /**
     * Get active alerts
     */
    getActiveAlerts(level?: Alert['level']): Alert[];
    /**
     * Get alert history
     */
    getAlertHistory(options?: {
        limit?: number;
        level?: Alert['level'];
        category?: string;
        startTime?: Date;
        endTime?: Date;
    }): Alert[];
    /**
     * Get alert correlations
     */
    getCorrelations(): AlertCorrelation[];
    /**
     * Get alert statistics
     */
    getAlertStatistics(hours?: number): {
        total: number;
        byLevel: Record<Alert['level'], number>;
        byCategory: Record<string, number>;
        resolved: number;
        acknowledged: number;
        escalated: number;
        suppressed: number;
    };
    /**
     * Evaluate alert rules against current context
     */
    evaluateAlerts(context: AlertContext): Promise<void>;
    /**
     * Setup default alert rules
     */
    private setupDefaultRules;
    /**
     * Check if alert should be suppressed
     */
    private shouldSuppressAlert;
    /**
     * Find correlation for alert
     */
    private findCorrelation;
    /**
     * Update correlation when alert is resolved
     */
    private updateCorrelation;
    /**
     * Trigger automated responses for alert
     */
    private triggerAutomatedResponses;
    /**
     * Escalate an alert
     */
    private escalateAlert;
    /**
     * Execute automated action
     */
    private executeAutomatedAction;
    /**
     * Start alert evaluation loop
     */
    private startAlertEvaluation;
    /**
     * Utility methods
     */
    private generateAlertId;
    private generateCorrelationId;
    private generateResponseId;
    private getAlertSeverityLevel;
    private sanitizeContext;
    private isInCooldown;
    private setCooldown;
    private autoResolveRuleAlerts;
    private persistAlert;
    private persistData;
    private loadPersistedData;
}
export declare const alertManager: AlertManager;
//# sourceMappingURL=alert-manager.d.ts.map
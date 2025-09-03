"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeAlerting = initializeAlerting;
exports.createManualAlert = createManualAlert;
exports.getAlertDashboard = getAlertDashboard;
exports.getAlertStatistics = getAlertStatistics;
exports.resolveAlert = resolveAlert;
exports.acknowledgeAlert = acknowledgeAlert;
exports.getAlertHistory = getAlertHistory;
exports.testAlertSystem = testAlertSystem;
exports.isAlertingRunning = isAlertingRunning;
const alert_manager_1 = require("./alert-manager");
const health_manager_1 = require("../runtime/health-manager");
const multi_level_monitor_1 = require("./multi-level-monitor");
const lifecycle_1 = require("../runtime/lifecycle");
/**
 * Integration layer for Alert Management System
 * Connects alerts with health manager and multi-level monitoring
 */
let isAlertingStarted = false;
let contextUpdateTimer = null;
/**
 * Initialize alert management integration
 */
function initializeAlerting() {
    if (isAlertingStarted) {
        console.log('⚠️ Alert Management already started');
        return;
    }
    console.log('🚨 Initializing Enhanced Alert Management System...');
    // Set up event listeners for alert manager
    alert_manager_1.alertManager.on('alert-manager-started', () => {
        console.log('✅ Alert Management active');
        console.log('   - Alert evaluation: Every 30 seconds');
        console.log('   - Correlation detection: Automatic');
        console.log('   - Automated responses: Enabled');
        console.log('   - Alert suppression: Intelligent');
    });
    alert_manager_1.alertManager.on('alert-created', (alert) => {
        const icon = getAlertIcon(alert.level);
        console.log(`${icon} ALERT [${alert.level.toUpperCase()}]: ${alert.title}`);
        if (alert.level === 'critical') {
            console.log(`   🚨 CRITICAL ALERT: ${alert.message}`);
        }
    });
    alert_manager_1.alertManager.on('alert-resolved', (alert) => {
        console.log(`✅ Alert resolved: ${alert.title} (resolved by: ${alert.resolvedBy})`);
    });
    alert_manager_1.alertManager.on('alert-escalated', (alert, escalationRule) => {
        console.log(`⬆️ Alert escalated to ${escalationRule.escalateTo}: ${alert.title}`);
        if (escalationRule.autoActions?.length) {
            console.log(`   🤖 Triggering automated actions: ${escalationRule.autoActions.join(', ')}`);
        }
    });
    alert_manager_1.alertManager.on('correlation-resolved', (correlation) => {
        console.log(`🔗 Alert correlation resolved: ${correlation.description}`);
    });
    alert_manager_1.alertManager.on('automated-response', (response) => {
        const status = response.result === 'success' ? '✅' : response.result === 'failure' ? '❌' : '⏳';
        console.log(`${status} Automated response: ${response.action} - ${response.result}`);
    });
    // Set up integration with health manager
    if (health_manager_1.healthManager) {
        health_manager_1.healthManager.on('alert-created', (alert) => {
            // Forward health manager alerts to alert manager
            alert_manager_1.alertManager.createAlert({
                level: alert.level === 'critical' ? 'critical' : 'warning',
                title: 'Health Manager Alert',
                message: alert.message,
                source: 'health-manager',
                category: 'health',
                metadata: { originalAlert: alert }
            });
        });
        health_manager_1.healthManager.on('shutdown-requested', (reason) => {
            // Create critical alert for shutdown requests
            alert_manager_1.alertManager.createAlert({
                level: 'critical',
                title: 'System Shutdown Requested',
                message: `Health manager requesting shutdown: ${reason}`,
                source: 'health-manager',
                category: 'system',
                metadata: { shutdownReason: reason }
            });
        });
    }
    // Set up integration with multi-level monitor
    if (multi_level_monitor_1.multiLevelMonitor) {
        multi_level_monitor_1.multiLevelMonitor.on('collection-failed', (level, error) => {
            alert_manager_1.alertManager.createAlert({
                level: 'warning',
                title: `${level} Monitoring Failed`,
                message: `Failed to collect ${level} metrics: ${error?.message}`,
                source: 'multi-level-monitor',
                category: 'monitoring',
                metadata: { level, error: error?.message }
            });
        });
    }
    // Start alert manager
    alert_manager_1.alertManager.start();
    // Start context updates
    startContextUpdates();
    isAlertingStarted = true;
    // Register shutdown handler
    lifecycle_1.lifecycleManager.onShutdown(async () => {
        console.log('🚨 Shutting down Alert Management...');
        if (contextUpdateTimer) {
            clearInterval(contextUpdateTimer);
        }
        await alert_manager_1.alertManager.stop();
    });
    console.log('🚨 Alert Management integration complete');
}
/**
 * Create a manual alert
 */
async function createManualAlert(options) {
    if (!isAlertingStarted) {
        throw new Error('Alert management not started');
    }
    return await alert_manager_1.alertManager.createAlert({
        level: options.level,
        title: options.title,
        message: options.message,
        source: 'manual',
        category: options.category,
        metadata: options.metadata
    });
}
/**
 * Get alert dashboard data
 */
async function getAlertDashboard() {
    if (!isAlertingStarted) {
        return {
            enabled: false,
            message: 'Alert management not started'
        };
    }
    const activeAlerts = alert_manager_1.alertManager.getActiveAlerts();
    const stats = alert_manager_1.alertManager.getAlertStatistics(24);
    const correlations = alert_manager_1.alertManager.getCorrelations();
    // Group active alerts by level
    const alertsByLevel = {
        critical: activeAlerts.filter(a => a.level === 'critical'),
        warning: activeAlerts.filter(a => a.level === 'warning'),
        info: activeAlerts.filter(a => a.level === 'info')
    };
    // Get recent alert history
    const recentAlerts = alert_manager_1.alertManager.getAlertHistory({ limit: 10 });
    return {
        enabled: true,
        timestamp: new Date().toISOString(),
        summary: {
            activeAlerts: activeAlerts.length,
            criticalAlerts: alertsByLevel.critical.length,
            warningAlerts: alertsByLevel.warning.length,
            infoAlerts: alertsByLevel.info.length,
            activeCorrelations: correlations.filter(c => !c.endTime).length
        },
        statistics: stats,
        activeAlerts: {
            critical: alertsByLevel.critical.map(formatAlertForDashboard),
            warning: alertsByLevel.warning.map(formatAlertForDashboard),
            info: alertsByLevel.info.map(formatAlertForDashboard)
        },
        recentAlerts: recentAlerts.map(formatAlertForDashboard),
        correlations: correlations.map(formatCorrelationForDashboard)
    };
}
/**
 * Get alert statistics
 */
async function getAlertStatistics(hours = 24) {
    if (!isAlertingStarted) {
        return {
            enabled: false,
            message: 'Alert management not started'
        };
    }
    const stats = alert_manager_1.alertManager.getAlertStatistics(hours);
    const activeAlerts = alert_manager_1.alertManager.getActiveAlerts();
    return {
        enabled: true,
        period: `${hours} hours`,
        timestamp: new Date().toISOString(),
        ...stats,
        currentlyActive: {
            total: activeAlerts.length,
            critical: activeAlerts.filter(a => a.level === 'critical').length,
            warning: activeAlerts.filter(a => a.level === 'warning').length,
            info: activeAlerts.filter(a => a.level === 'info').length
        }
    };
}
/**
 * Resolve an alert
 */
async function resolveAlert(alertId, resolvedBy = 'user') {
    if (!isAlertingStarted) {
        throw new Error('Alert management not started');
    }
    return await alert_manager_1.alertManager.resolveAlert(alertId, resolvedBy);
}
/**
 * Acknowledge an alert
 */
async function acknowledgeAlert(alertId, acknowledgedBy) {
    if (!isAlertingStarted) {
        throw new Error('Alert management not started');
    }
    return await alert_manager_1.alertManager.acknowledgeAlert(alertId, acknowledgedBy);
}
/**
 * Get alert history
 */
async function getAlertHistory(options = {}) {
    if (!isAlertingStarted) {
        throw new Error('Alert management not started');
    }
    const { hours = 24, ...otherOptions } = options;
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return alert_manager_1.alertManager.getAlertHistory({
        ...otherOptions,
        startTime
    }).map(formatAlertForDashboard);
}
/**
 * Test alert system
 */
async function testAlertSystem() {
    if (!isAlertingStarted) {
        throw new Error('Alert management not started');
    }
    console.log('🧪 Testing Alert System...');
    // Create test alerts
    const testAlerts = [
        {
            level: 'info',
            title: 'Test Info Alert',
            message: 'This is a test info alert',
            category: 'test'
        },
        {
            level: 'warning',
            title: 'Test Warning Alert',
            message: 'This is a test warning alert',
            category: 'test'
        },
        {
            level: 'critical',
            title: 'Test Critical Alert',
            message: 'This is a test critical alert',
            category: 'test'
        }
    ];
    const createdAlerts = [];
    for (const alertData of testAlerts) {
        const alert = await createManualAlert(alertData);
        createdAlerts.push(alert);
    }
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Resolve test alerts
    for (const alert of createdAlerts) {
        await resolveAlert(alert.id, 'test-system');
    }
    console.log('✅ Alert system test completed');
    return {
        success: true,
        alertsCreated: createdAlerts.length,
        alertsResolved: createdAlerts.length
    };
}
/**
 * Start context updates for alert evaluation
 */
function startContextUpdates() {
    contextUpdateTimer = setInterval(async () => {
        if (!isAlertingStarted)
            return;
        try {
            // Gather context from various sources
            const context = await gatherAlertContext();
            // Evaluate alerts with current context
            await alert_manager_1.alertManager.evaluateAlerts(context);
        }
        catch (error) {
            console.error('Error updating alert context:', error);
        }
    }, 30000); // Every 30 seconds
}
/**
 * Gather alert context from monitoring systems
 */
async function gatherAlertContext() {
    const context = {
        metrics: {},
        healthStatus: {},
        systemMetrics: {},
        dockerMetrics: {},
        infrastructureMetrics: {},
        recentAlerts: alert_manager_1.alertManager.getAlertHistory({ limit: 10 }),
        timestamp: new Date()
    };
    try {
        // Get health status from health manager
        if (health_manager_1.healthManager) {
            context.healthStatus = await health_manager_1.healthManager.getHealthStatus();
        }
    }
    catch (error) {
        console.warn('Failed to get health status for alert context:', error);
    }
    try {
        // Get recent monitoring data
        if (multi_level_monitor_1.multiLevelMonitor) {
            const [systemData, dockerData, infraData] = await Promise.all([
                multi_level_monitor_1.multiLevelMonitor.getRecentData('system', 1),
                multi_level_monitor_1.multiLevelMonitor.getRecentData('docker', 1),
                multi_level_monitor_1.multiLevelMonitor.getRecentData('infrastructure', 1)
            ]);
            if (systemData[0]?.success) {
                context.systemMetrics = systemData[0].data;
            }
            if (dockerData[0]?.success) {
                context.dockerMetrics = dockerData[0].data;
            }
            if (infraData[0]?.success) {
                context.infrastructureMetrics = infraData[0].data;
            }
        }
    }
    catch (error) {
        console.warn('Failed to get monitoring data for alert context:', error);
    }
    return context;
}
/**
 * Format alert for dashboard display
 */
function formatAlertForDashboard(alert) {
    return {
        id: alert.id,
        level: alert.level,
        title: alert.title,
        message: alert.message,
        source: alert.source,
        category: alert.category,
        timestamp: alert.timestamp,
        resolved: alert.resolved,
        resolvedAt: alert.resolvedAt,
        resolvedBy: alert.resolvedBy,
        acknowledgedBy: alert.acknowledgedBy,
        acknowledgedAt: alert.acknowledgedAt,
        escalationLevel: alert.escalationLevel,
        correlationId: alert.correlationId
    };
}
/**
 * Format correlation for dashboard display
 */
function formatCorrelationForDashboard(correlation) {
    return {
        id: correlation.id,
        alertCount: correlation.alerts.length,
        category: correlation.category,
        severity: correlation.severity,
        startTime: correlation.startTime,
        endTime: correlation.endTime,
        description: correlation.description,
        resolved: !!correlation.endTime
    };
}
/**
 * Get alert icon for display
 */
function getAlertIcon(level) {
    switch (level) {
        case 'critical': return '🚨';
        case 'warning': return '⚠️';
        case 'info': return 'ℹ️';
        default: return '📢';
    }
}
/**
 * Check if alerting is running
 */
function isAlertingRunning() {
    return isAlertingStarted;
}
//# sourceMappingURL=alert-integration.js.map
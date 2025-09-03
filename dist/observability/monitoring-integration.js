"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeMonitoring = initializeMonitoring;
exports.getMonitoringDashboard = getMonitoringDashboard;
exports.getMetricsHistory = getMetricsHistory;
exports.getSystemHealthSummary = getSystemHealthSummary;
exports.forceMetricsCollection = forceMetricsCollection;
exports.isMonitoringRunning = isMonitoringRunning;
exports.getMonitoringStats = getMonitoringStats;
const multi_level_monitor_1 = require("./multi-level-monitor");
const lifecycle_1 = require("../runtime/lifecycle");
/**
 * Integration layer for Multi-Level Monitoring System
 * Provides seamless integration with existing observability infrastructure
 */
let isMonitoringStarted = false;
/**
 * Initialize multi-level monitoring integration
 */
function initializeMonitoring() {
    if (isMonitoringStarted) {
        console.log('⚠️ Multi-Level Monitoring already started');
        return;
    }
    console.log('📊 Initializing Multi-Level Monitoring System...');
    // Set up event listeners
    multi_level_monitor_1.multiLevelMonitor.on('monitoring-started', () => {
        console.log('✅ Multi-Level Monitoring active');
        console.log('   - Application metrics: Every 30 seconds');
        console.log('   - System metrics: Every 1 minute');
        console.log('   - Docker metrics: Every 1 minute');
        console.log('   - Infrastructure metrics: Every 2 minutes');
    });
    multi_level_monitor_1.multiLevelMonitor.on('metrics-collected', (level, data) => {
        // Log collection success (throttled to avoid spam)
        if (Date.now() % 300000 < 60000) { // Log roughly every 5 minutes
            console.log(`📊 ${level} metrics collected successfully`);
        }
    });
    multi_level_monitor_1.multiLevelMonitor.on('collection-failed', (level, error) => {
        console.log(`⚠️ ${level} metrics collection failed: ${error?.message}`);
    });
    multi_level_monitor_1.multiLevelMonitor.on('monitoring-stopped', () => {
        console.log('🛑 Multi-Level Monitoring stopped');
    });
    // Start the monitoring system
    multi_level_monitor_1.multiLevelMonitor.start();
    isMonitoringStarted = true;
    // Register shutdown handler
    lifecycle_1.lifecycleManager.onShutdown(async () => {
        console.log('📊 Shutting down Multi-Level Monitoring...');
        await multi_level_monitor_1.multiLevelMonitor.stop();
    });
    console.log('📊 Multi-Level Monitoring integration complete');
}
/**
 * Get monitoring dashboard data
 */
async function getMonitoringDashboard() {
    if (!isMonitoringStarted) {
        return {
            enabled: false,
            message: 'Multi-level monitoring not started'
        };
    }
    try {
        // Get recent data from each level
        const [applicationData, systemData, dockerData, infrastructureData] = await Promise.all([
            multi_level_monitor_1.multiLevelMonitor.getRecentData('application', 5),
            multi_level_monitor_1.multiLevelMonitor.getRecentData('system', 5),
            multi_level_monitor_1.multiLevelMonitor.getRecentData('docker', 5),
            multi_level_monitor_1.multiLevelMonitor.getRecentData('infrastructure', 5)
        ]);
        // Calculate success rates
        const calculateSuccessRate = (data) => {
            if (data.length === 0)
                return 0;
            const successful = data.filter(d => d.success).length;
            return (successful / data.length) * 100;
        };
        return {
            enabled: true,
            timestamp: new Date().toISOString(),
            levels: {
                application: {
                    recentCollections: applicationData.length,
                    successRate: calculateSuccessRate(applicationData),
                    lastCollection: applicationData[0]?.timestamp,
                    status: applicationData[0]?.success ? 'healthy' : 'failed'
                },
                system: {
                    recentCollections: systemData.length,
                    successRate: calculateSuccessRate(systemData),
                    lastCollection: systemData[0]?.timestamp,
                    status: systemData[0]?.success ? 'healthy' : 'failed'
                },
                docker: {
                    recentCollections: dockerData.length,
                    successRate: calculateSuccessRate(dockerData),
                    lastCollection: dockerData[0]?.timestamp,
                    status: dockerData[0]?.success ? 'healthy' : 'failed'
                },
                infrastructure: {
                    recentCollections: infrastructureData.length,
                    successRate: calculateSuccessRate(infrastructureData),
                    lastCollection: infrastructureData[0]?.timestamp,
                    status: infrastructureData[0]?.success ? 'healthy' : 'failed'
                }
            },
            summary: {
                totalCollections: applicationData.length + systemData.length + dockerData.length + infrastructureData.length,
                overallSuccessRate: calculateSuccessRate([...applicationData, ...systemData, ...dockerData, ...infrastructureData]),
                healthyLevels: [applicationData, systemData, dockerData, infrastructureData].filter(data => data[0]?.success).length,
                totalLevels: 4
            }
        };
    }
    catch (error) {
        return {
            enabled: true,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        };
    }
}
/**
 * Get metrics for a specific time range
 */
async function getMetricsHistory(options = {}) {
    if (!isMonitoringStarted) {
        throw new Error('Multi-level monitoring not started');
    }
    const { level, hours = 24, limit = 100 } = options;
    const startTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    return await multi_level_monitor_1.multiLevelMonitor.queryData({
        level,
        startTime,
        limit
    });
}
/**
 * Get current system health summary
 */
async function getSystemHealthSummary() {
    if (!isMonitoringStarted) {
        return {
            enabled: false,
            message: 'Multi-level monitoring not started'
        };
    }
    try {
        // Get latest data from each level
        const [applicationData, systemData, dockerData, infrastructureData] = await Promise.all([
            multi_level_monitor_1.multiLevelMonitor.getRecentData('application', 1),
            multi_level_monitor_1.multiLevelMonitor.getRecentData('system', 1),
            multi_level_monitor_1.multiLevelMonitor.getRecentData('docker', 1),
            multi_level_monitor_1.multiLevelMonitor.getRecentData('infrastructure', 1)
        ]);
        const latest = {
            application: applicationData[0],
            system: systemData[0],
            docker: dockerData[0],
            infrastructure: infrastructureData[0]
        };
        // Extract key health indicators
        const health = {
            timestamp: new Date().toISOString(),
            application: {
                available: latest.application?.success || false,
                metricsCount: latest.application?.success ? Object.keys(latest.application.data?.parsed?.counters || {}).length : 0,
                lastUpdate: latest.application?.timestamp
            },
            system: {
                available: latest.system?.success || false,
                cpuUsage: latest.system?.success ? latest.system.data?.cpu?.usage : null,
                memoryUsage: latest.system?.success ? latest.system.data?.memory?.used : null,
                lastUpdate: latest.system?.timestamp
            },
            docker: {
                available: latest.docker?.success || false,
                containerCount: latest.docker?.success ? latest.docker.data?.containers?.length : 0,
                lastUpdate: latest.docker?.timestamp
            },
            infrastructure: {
                available: latest.infrastructure?.success || false,
                databaseConnected: latest.infrastructure?.success ? latest.infrastructure.data?.database?.connected : false,
                redisConnected: latest.infrastructure?.success ? latest.infrastructure.data?.redis?.connected : false,
                lastUpdate: latest.infrastructure?.timestamp
            }
        };
        // Calculate overall health score
        const healthyLevels = Object.values(health).filter(level => typeof level === 'object' && level.available).length - 1; // Subtract 1 for timestamp
        const overallHealth = healthyLevels >= 3 ? 'healthy' : healthyLevels >= 2 ? 'degraded' : 'unhealthy';
        return {
            enabled: true,
            overallHealth,
            healthyLevels,
            totalLevels: 4,
            ...health
        };
    }
    catch (error) {
        return {
            enabled: true,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        };
    }
}
/**
 * Force collection of all metrics (useful for testing)
 */
async function forceMetricsCollection() {
    if (!isMonitoringStarted) {
        throw new Error('Multi-level monitoring not started');
    }
    console.log('🔄 Forcing metrics collection across all levels...');
    // Trigger immediate collection by emitting events
    multi_level_monitor_1.multiLevelMonitor.emit('force-collection');
    // Wait a moment for collection to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    return await getSystemHealthSummary();
}
/**
 * Check if monitoring is running
 */
function isMonitoringRunning() {
    return isMonitoringStarted;
}
/**
 * Get monitoring statistics
 */
async function getMonitoringStats() {
    if (!isMonitoringStarted) {
        return {
            enabled: false,
            message: 'Multi-level monitoring not started'
        };
    }
    try {
        // Get data from last 24 hours
        const data = await multi_level_monitor_1.multiLevelMonitor.queryData({
            startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
            limit: 1000
        });
        // Group by level
        const byLevel = data.reduce((acc, item) => {
            if (!acc[item.level]) {
                acc[item.level] = [];
            }
            acc[item.level].push(item);
            return acc;
        }, {});
        // Calculate statistics
        const stats = Object.entries(byLevel).map(([level, items]) => {
            const successful = items.filter(item => item.success).length;
            const failed = items.length - successful;
            const successRate = items.length > 0 ? (successful / items.length) * 100 : 0;
            return {
                level,
                totalCollections: items.length,
                successful,
                failed,
                successRate: Math.round(successRate * 100) / 100,
                lastCollection: items[0]?.timestamp,
                oldestCollection: items[items.length - 1]?.timestamp
            };
        });
        return {
            enabled: true,
            period: '24 hours',
            timestamp: new Date().toISOString(),
            levels: stats,
            summary: {
                totalCollections: data.length,
                successfulCollections: data.filter(d => d.success).length,
                failedCollections: data.filter(d => !d.success).length,
                overallSuccessRate: data.length > 0 ? Math.round((data.filter(d => d.success).length / data.length) * 10000) / 100 : 0
            }
        };
    }
    catch (error) {
        return {
            enabled: true,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        };
    }
}
//# sourceMappingURL=monitoring-integration.js.map
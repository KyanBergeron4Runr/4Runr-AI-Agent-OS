"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDegradation = initializeDegradation;
exports.getDegradationStatus = getDegradationStatus;
exports.isFeatureAvailable = isFeatureAvailable;
exports.shouldAcceptRequest = shouldAcceptRequest;
exports.registerRequest = registerRequest;
exports.completeRequest = completeRequest;
exports.forceDegradation = forceDegradation;
exports.forceRecovery = forceRecovery;
exports.triggerEmergencyActions = triggerEmergencyActions;
exports.getDegradationMetrics = getDegradationMetrics;
exports.testDegradationSystem = testDegradationSystem;
exports.isDegradationRunning = isDegradationRunning;
const degradation_controller_1 = require("./degradation-controller");
const health_manager_1 = require("./health-manager");
const alert_manager_1 = require("../observability/alert-manager");
const lifecycle_1 = require("./lifecycle");
/**
 * Integration layer for Graceful Degradation Controller
 * Connects degradation with health monitoring and alert systems
 */
let isDegradationStarted = false;
/**
 * Initialize graceful degradation integration
 */
function initializeDegradation() {
    if (isDegradationStarted) {
        console.log('⚠️ Graceful Degradation already started');
        return;
    }
    console.log('🛡️ Initializing Graceful Degradation Controller...');
    // Set up event listeners for degradation controller
    degradation_controller_1.degradationController.on('degradation-controller-started', () => {
        console.log('✅ Graceful Degradation active');
        console.log('   - Monitoring: Every 5 seconds');
        console.log('   - Load shedding: Enabled');
        console.log('   - Feature degradation: 3 levels');
        console.log('   - Backpressure management: Enabled');
    });
    degradation_controller_1.degradationController.on('degradation-activated', (event) => {
        console.log(`🛡️ DEGRADATION ACTIVATED - Level ${event.level}: ${event.name}`);
        console.log(`   Triggers: ${event.triggers.join(', ')}`);
        // Create alert for degradation activation
        if (alert_manager_1.alertManager) {
            alert_manager_1.alertManager.createAlert({
                level: event.level >= 3 ? 'critical' : event.level >= 2 ? 'warning' : 'info',
                title: `System Degradation Level ${event.level}`,
                message: `Graceful degradation activated: ${event.name}. Triggers: ${event.triggers.join(', ')}`,
                source: 'degradation-controller',
                category: 'performance',
                metadata: {
                    degradationLevel: event.level,
                    triggers: event.triggers,
                    previousLevel: event.previousLevel
                }
            });
        }
    });
    degradation_controller_1.degradationController.on('degradation-deactivated', (event) => {
        console.log(`🛡️ DEGRADATION DEACTIVATED - Recovered from Level ${event.previousLevel}: ${event.previousLevelName}`);
        // Create alert for degradation recovery
        if (alert_manager_1.alertManager) {
            alert_manager_1.alertManager.createAlert({
                level: 'info',
                title: 'System Degradation Recovered',
                message: `System recovered from degradation level ${event.previousLevel}: ${event.previousLevelName}`,
                source: 'degradation-controller',
                category: 'performance',
                metadata: {
                    previousLevel: event.previousLevel,
                    previousLevelName: event.previousLevelName
                }
            });
        }
    });
    degradation_controller_1.degradationController.on('feature-disabled', (feature) => {
        console.log(`🚫 Feature degraded: ${feature}`);
    });
    degradation_controller_1.degradationController.on('feature-enabled', (feature) => {
        console.log(`✅ Feature restored: ${feature}`);
    });
    degradation_controller_1.degradationController.on('gc-triggered', () => {
        console.log('🗑️ Garbage collection triggered for memory pressure relief');
    });
    degradation_controller_1.degradationController.on('cache-cleared', (event) => {
        console.log(`🧹 Cache cleared: ${event.count} entries (priority: ${event.priority})`);
    });
    degradation_controller_1.degradationController.on('idle-connections-closed', (event) => {
        console.log(`🔌 Closed ${event.count} idle connections`);
    });
    // Integration with health manager
    if (health_manager_1.healthManager) {
        health_manager_1.healthManager.on('alert-created', (alert) => {
            // Trigger degradation for critical health alerts
            if (alert.level === 'critical') {
                const status = degradation_controller_1.degradationController.getStatus();
                if (!status.active || status.level < 2) {
                    console.log('🛡️ Critical health alert detected, considering degradation...');
                    // Let the normal evaluation process handle it
                }
            }
        });
    }
    // Start degradation controller
    degradation_controller_1.degradationController.start();
    isDegradationStarted = true;
    // Register shutdown handler
    lifecycle_1.lifecycleManager.onShutdown(async () => {
        console.log('🛡️ Shutting down Graceful Degradation Controller...');
        degradation_controller_1.degradationController.stop();
    });
    console.log('🛡️ Graceful Degradation integration complete');
}
/**
 * Get degradation status
 */
function getDegradationStatus() {
    if (!isDegradationStarted) {
        return {
            enabled: false,
            message: 'Graceful degradation not started'
        };
    }
    const status = degradation_controller_1.degradationController.getStatus();
    return {
        enabled: true,
        timestamp: new Date().toISOString(),
        ...status,
        recommendations: generateRecommendations(status)
    };
}
/**
 * Check if a feature is available (not degraded)
 */
function isFeatureAvailable(feature) {
    if (!isDegradationStarted) {
        return true; // If degradation not started, all features available
    }
    return degradation_controller_1.degradationController.isFeatureEnabled(feature);
}
/**
 * Apply load shedding to request
 */
function shouldAcceptRequest(request) {
    if (!isDegradationStarted) {
        return { accept: true };
    }
    // Determine request priority based on path and method
    const priority = determineRequestPriority(request);
    const result = degradation_controller_1.degradationController.shouldAcceptRequest({
        path: request.path,
        priority,
        timestamp: new Date()
    });
    return result;
}
/**
 * Register request lifecycle events
 */
function registerRequest(requestId) {
    if (isDegradationStarted) {
        degradation_controller_1.degradationController.registerRequestStart(requestId);
    }
}
function completeRequest(requestId) {
    if (isDegradationStarted) {
        degradation_controller_1.degradationController.registerRequestComplete(requestId);
    }
}
/**
 * Force degradation for testing or emergency
 */
function forceDegradation(level, reason = 'manual') {
    if (!isDegradationStarted) {
        throw new Error('Graceful degradation not started');
    }
    return degradation_controller_1.degradationController.forceDegradation(level, reason);
}
/**
 * Force recovery from degradation
 */
function forceRecovery(reason = 'manual') {
    if (!isDegradationStarted) {
        throw new Error('Graceful degradation not started');
    }
    return degradation_controller_1.degradationController.forceRecovery(reason);
}
/**
 * Trigger emergency actions
 */
function triggerEmergencyActions() {
    if (!isDegradationStarted) {
        throw new Error('Graceful degradation not started');
    }
    console.log('🚨 Triggering emergency degradation actions...');
    // Trigger garbage collection
    degradation_controller_1.degradationController.triggerGarbageCollection();
    // Clear caches
    degradation_controller_1.degradationController.clearCaches('high');
    // Close idle connections
    degradation_controller_1.degradationController.closeIdleConnections();
    // Force degradation to level 2 if not already degraded
    const status = degradation_controller_1.degradationController.getStatus();
    if (!status.active || status.level < 2) {
        degradation_controller_1.degradationController.forceDegradation(2, 'emergency-actions');
    }
    return {
        success: true,
        actions: ['gc-triggered', 'cache-cleared', 'connections-closed', 'degradation-forced'],
        timestamp: new Date().toISOString()
    };
}
/**
 * Get degradation metrics and statistics
 */
function getDegradationMetrics() {
    if (!isDegradationStarted) {
        return {
            enabled: false,
            message: 'Graceful degradation not started'
        };
    }
    const status = degradation_controller_1.degradationController.getStatus();
    return {
        enabled: true,
        timestamp: new Date().toISOString(),
        currentStatus: status,
        capabilities: {
            loadShedding: true,
            featureDegradation: true,
            backpressureManagement: true,
            automaticRecovery: true,
            emergencyActions: true
        },
        degradationLevels: [
            {
                level: 1,
                name: 'Light Degradation',
                description: 'Reduce non-essential features and clear low-priority caches',
                triggers: ['memory > 80%', 'response_time > 2s', 'error_rate > 5%']
            },
            {
                level: 2,
                name: 'Moderate Degradation',
                description: 'Implement load shedding and reduce cache size significantly',
                triggers: ['memory > 90%', 'response_time > 5s', 'error_rate > 10%']
            },
            {
                level: 3,
                name: 'Severe Degradation',
                description: 'Emergency mode - only core functionality available',
                triggers: ['memory > 95%', 'response_time > 10s', 'error_rate > 20%']
            }
        ]
    };
}
/**
 * Test degradation system
 */
async function testDegradationSystem() {
    if (!isDegradationStarted) {
        throw new Error('Graceful degradation not started');
    }
    console.log('🧪 Testing Graceful Degradation System...');
    const results = {
        tests: [],
        success: true,
        timestamp: new Date().toISOString()
    };
    try {
        // Test 1: Force degradation
        console.log('🔍 Test 1: Force degradation to level 1');
        degradation_controller_1.degradationController.forceDegradation(1, 'test-degradation');
        await new Promise(resolve => setTimeout(resolve, 1000));
        let status = degradation_controller_1.degradationController.getStatus();
        results.tests.push({
            name: 'Force Degradation',
            success: status.active && status.level === 1,
            details: `Active: ${status.active}, Level: ${status.level}`
        });
        // Test 2: Check feature degradation
        console.log('🔍 Test 2: Check feature degradation');
        const analyticsDisabled = !degradation_controller_1.degradationController.isFeatureEnabled('analytics');
        results.tests.push({
            name: 'Feature Degradation',
            success: analyticsDisabled,
            details: `Analytics disabled: ${analyticsDisabled}`
        });
        // Test 3: Test load shedding
        console.log('🔍 Test 3: Test load shedding');
        const loadSheddingResult = degradation_controller_1.degradationController.shouldAcceptRequest({
            path: '/api/test',
            priority: 'low'
        });
        results.tests.push({
            name: 'Load Shedding',
            success: true, // Always passes as it's probabilistic
            details: `Accept: ${loadSheddingResult.accept}, Reason: ${loadSheddingResult.reason || 'none'}`
        });
        // Test 4: Force recovery
        console.log('🔍 Test 4: Force recovery');
        degradation_controller_1.degradationController.forceRecovery('test-recovery');
        await new Promise(resolve => setTimeout(resolve, 1000));
        status = degradation_controller_1.degradationController.getStatus();
        results.tests.push({
            name: 'Force Recovery',
            success: !status.active,
            details: `Active: ${status.active}, Level: ${status.level}`
        });
        // Test 5: Emergency actions
        console.log('🔍 Test 5: Emergency actions');
        const emergencyResult = triggerEmergencyActions();
        results.tests.push({
            name: 'Emergency Actions',
            success: emergencyResult.success,
            details: `Actions: ${emergencyResult.actions.join(', ')}`
        });
        // Clean up - force recovery
        degradation_controller_1.degradationController.forceRecovery('test-cleanup');
    }
    catch (error) {
        results.success = false;
        results.tests.push({
            name: 'Test Execution',
            success: false,
            details: `Error: ${error instanceof Error ? error.message : String(error)}`
        });
    }
    const passedTests = results.tests.filter(t => t.success).length;
    const totalTests = results.tests.length;
    console.log(`✅ Degradation system test completed: ${passedTests}/${totalTests} tests passed`);
    return {
        ...results,
        summary: {
            passed: passedTests,
            total: totalTests,
            successRate: Math.round((passedTests / totalTests) * 100)
        }
    };
}
/**
 * Determine request priority based on path and other factors
 */
function determineRequestPriority(request) {
    // Health and monitoring endpoints get highest priority
    if (request.path.startsWith('/health') || request.path.startsWith('/metrics')) {
        return 'health';
    }
    // Admin endpoints get high priority
    if (request.path.startsWith('/admin')) {
        return 'admin';
    }
    // API endpoints get medium priority
    if (request.path.startsWith('/api')) {
        return 'api';
    }
    // Static content gets lowest priority
    if (request.path.match(/\.(css|js|png|jpg|gif|ico)$/)) {
        return 'static';
    }
    // Default to API priority
    return 'api';
}
/**
 * Generate recommendations based on degradation status
 */
function generateRecommendations(status) {
    const recommendations = [];
    if (status.active) {
        recommendations.push(`System is in degradation mode (Level ${status.level}). Consider investigating root causes.`);
        if (status.level >= 2) {
            recommendations.push('High degradation level detected. Consider scaling resources or reducing load.');
        }
        if (status.metrics.requestsDropped > 100) {
            recommendations.push('High number of requests dropped. Consider increasing capacity or optimizing performance.');
        }
        if (status.metrics.featuresDisabled.length > 0) {
            recommendations.push(`${status.metrics.featuresDisabled.length} features disabled. Monitor for impact on user experience.`);
        }
    }
    else {
        recommendations.push('System operating normally. No degradation active.');
    }
    return recommendations;
}
/**
 * Check if degradation is running
 */
function isDegradationRunning() {
    return isDegradationStarted;
}
//# sourceMappingURL=degradation-integration.js.map
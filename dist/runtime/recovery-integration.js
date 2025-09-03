"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeRecoveryIntegration = initializeRecoveryIntegration;
exports.triggerRecovery = triggerRecovery;
exports.triggerEscalatedRecovery = triggerEscalatedRecovery;
exports.getRecoveryStatus = getRecoveryStatus;
exports.addCustomRecoveryStrategy = addCustomRecoveryStrategy;
exports.getRecoveryStrategies = getRecoveryStrategies;
const recovery_controller_1 = require("./recovery-controller");
const health_manager_1 = require("./health-manager");
const alert_manager_1 = require("../observability/alert-manager");
const lifecycle_1 = require("./lifecycle");
const degradation_controller_1 = require("./degradation-controller");
/**
 * Integration layer for Recovery Controller
 * Connects recovery system with health monitoring, alerts, and lifecycle management
 */
let isRecoveryIntegrationStarted = false;
/**
 * Initialize recovery controller integration
 */
function initializeRecoveryIntegration() {
    if (isRecoveryIntegrationStarted) {
        console.log('⚠️ Recovery Integration already started');
        return;
    }
    console.log('🔧 Initializing Recovery Controller Integration...');
    // Set up event listeners for recovery controller
    recovery_controller_1.recoveryController.on('recovery-controller-started', () => {
        console.log('✅ Recovery Controller monitoring active');
    });
    recovery_controller_1.recoveryController.on('recovery-success', (attempt) => {
        console.log(`✅ Recovery successful: ${attempt.strategyId}`);
        // Create success alert
        alert_manager_1.alertManager.createAlert({
            level: 'info',
            title: 'Recovery Successful',
            message: `Recovery strategy '${attempt.strategyId}' completed successfully`,
            source: 'recovery-controller',
            category: 'recovery',
            metadata: {
                attemptId: attempt.id,
                strategyId: attempt.strategyId,
                duration: attempt.endTime ? attempt.endTime.getTime() - attempt.startTime.getTime() : 0
            }
        });
    });
    recovery_controller_1.recoveryController.on('recovery-failed', (attempt) => {
        console.log(`❌ Recovery failed: ${attempt.strategyId} - ${attempt.error}`);
        // Create failure alert
        alert_manager_1.alertManager.createAlert({
            level: 'warning',
            title: 'Recovery Failed',
            message: `Recovery strategy '${attempt.strategyId}' failed: ${attempt.error}`,
            source: 'recovery-controller',
            category: 'recovery',
            metadata: {
                attemptId: attempt.id,
                strategyId: attempt.strategyId,
                error: attempt.error
            }
        });
    });
    recovery_controller_1.recoveryController.on('escalation-required', (reason, attempts) => {
        console.log(`🚨 Recovery escalation required: ${reason}`);
        // Create critical alert for escalation
        alert_manager_1.alertManager.createAlert({
            level: 'critical',
            title: 'Recovery Escalation Required',
            message: `All recovery strategies failed: ${reason}`,
            source: 'recovery-controller',
            category: 'escalation',
            metadata: {
                reason,
                attemptCount: attempts.length,
                failedStrategies: attempts.map(a => a.strategyId)
            }
        });
        // Trigger emergency degradation
        if (degradation_controller_1.degradationController) {
            if (degradation_controller_1.degradationController.enableEmergencyMode) {
                degradation_controller_1.degradationController.enableEmergencyMode('recovery-escalation');
            }
            else {
                console.warn('DegradationController does not support enableEmergencyMode');
            }
        }
    });
    // Integration with health manager
    if (health_manager_1.healthManager) {
        health_manager_1.healthManager.on('alert-created', async (alert) => {
            // Trigger recovery for critical health alerts
            if (alert.level === 'critical') {
                console.log(`🔧 Health alert triggered recovery: ${alert.message}`);
                try {
                    // Determine recovery strategy based on alert type
                    let strategyId = 'soft-recovery'; // default
                    if (alert.message.includes('memory') || alert.message.includes('Memory')) {
                        strategyId = 'soft-recovery';
                    }
                    else if (alert.message.includes('response') || alert.message.includes('timeout')) {
                        strategyId = 'medium-recovery';
                    }
                    else if (alert.message.includes('unhealthy') || alert.message.includes('unresponsive')) {
                        strategyId = 'hard-recovery';
                    }
                    await recovery_controller_1.recoveryController.executeRecovery(strategyId, `health-alert: ${alert.message}`, { healthAlert: alert });
                }
                catch (error) {
                    console.error(`❌ Failed to execute recovery for health alert: ${error}`);
                    // Try escalated recovery if single strategy fails
                    try {
                        await recovery_controller_1.recoveryController.executeEscalatedRecovery(`health-alert-escalation: ${alert.message}`, { healthAlert: alert });
                    }
                    catch (escalationError) {
                        console.error(`❌ Escalated recovery also failed: ${escalationError}`);
                    }
                }
            }
        });
        health_manager_1.healthManager.on('shutdown-requested', async (reason) => {
            console.log(`🔧 Health manager shutdown triggered recovery: ${reason}`);
            try {
                // Try hard recovery before shutdown
                await recovery_controller_1.recoveryController.executeRecovery('hard-recovery', `shutdown-prevention: ${reason}`, { shutdownReason: reason });
            }
            catch (error) {
                console.log(`❌ Recovery failed, proceeding with shutdown: ${error}`);
            }
        });
        health_manager_1.healthManager.on('restart-requested', async (reason) => {
            console.log(`🔧 Health manager restart triggered recovery: ${reason}`);
            try {
                // Execute service restart recovery
                await recovery_controller_1.recoveryController.executeRecovery('hard-recovery', `restart-request: ${reason}`, { restartReason: reason });
            }
            catch (error) {
                console.error(`❌ Recovery restart failed: ${error}`);
            }
        });
    }
    // Integration with alert manager
    alert_manager_1.alertManager.on('alert-created', async (alert) => {
        // Trigger recovery for system-level critical alerts
        if (alert.level === 'critical' && alert.category === 'system') {
            console.log(`🔧 System alert triggered recovery: ${alert.title}`);
            try {
                await recovery_controller_1.recoveryController.executeRecovery('medium-recovery', `system-alert: ${alert.title}`, { systemAlert: alert });
            }
            catch (error) {
                console.error(`❌ Failed to execute recovery for system alert: ${error}`);
            }
        }
    });
    // Start the recovery controller
    recovery_controller_1.recoveryController.start();
    isRecoveryIntegrationStarted = true;
    // Register shutdown handler
    lifecycle_1.lifecycleManager.onShutdown(async () => {
        console.log('🔧 Shutting down Recovery Controller...');
        await recovery_controller_1.recoveryController.stop();
    });
    console.log('🔧 Recovery Controller integration complete');
}
/**
 * Manually trigger recovery
 */
async function triggerRecovery(strategyId, reason, context) {
    // Auto-initialize if not started
    if (!isRecoveryIntegrationStarted) {
        initializeRecoveryIntegration();
    }
    return await recovery_controller_1.recoveryController.executeRecovery(strategyId, reason, context);
}
/**
 * Manually trigger escalated recovery
 */
async function triggerEscalatedRecovery(reason, context) {
    // Auto-initialize if not started
    if (!isRecoveryIntegrationStarted) {
        initializeRecoveryIntegration();
    }
    return await recovery_controller_1.recoveryController.executeEscalatedRecovery(reason, context);
}
/**
 * Get recovery status and statistics
 */
function getRecoveryStatus() {
    // Auto-initialize if not started
    if (!isRecoveryIntegrationStarted) {
        initializeRecoveryIntegration();
    }
    const stats = recovery_controller_1.recoveryController.getRecoveryStatistics();
    const activeAttempts = recovery_controller_1.recoveryController.getActiveAttempts();
    return {
        enabled: true,
        statistics: stats,
        activeAttempts: activeAttempts.length,
        recentHistory: recovery_controller_1.recoveryController.getRecoveryHistory(10)
    };
}
/**
 * Add custom recovery strategy
 */
function addCustomRecoveryStrategy(strategy) {
    return recovery_controller_1.recoveryController.addRecoveryStrategy(strategy);
}
/**
 * Get available recovery strategies
 */
function getRecoveryStrategies() {
    // Access private strategies through public interface if available
    // For now, return the default strategy names
    return [
        'soft-recovery',
        'medium-recovery',
        'hard-recovery',
        'emergency-recovery'
    ];
}
//# sourceMappingURL=recovery-integration.js.map
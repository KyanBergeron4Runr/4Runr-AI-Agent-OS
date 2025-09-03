"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recoveryController = exports.RecoveryController = void 0;
const events_1 = require("events");
const fs_1 = require("fs");
const path_1 = require("path");
const cross_platform_executor_1 = require("../utils/cross-platform-executor");
/**
 * Recovery Controller for automated system recovery
 * Implements multiple recovery strategies with validation and escalation
 */
class RecoveryController extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.strategies = new Map();
        this.activeAttempts = new Map();
        this.recoveryHistory = [];
        this.isRunning = false;
        this.maxHistorySize = 100;
        this.storageDir = options.storageDir || 'logs/recovery';
        this.maxHistorySize = options.maxHistorySize || 100;
        this.setupDefaultStrategies();
    }
    /**
     * Start recovery controller
     */
    async start() {
        if (this.isRunning)
            return;
        console.log('🔧 Starting Recovery Controller...');
        // Ensure storage directory exists
        await fs_1.promises.mkdir(this.storageDir, { recursive: true });
        // Load recovery history
        await this.loadRecoveryHistory();
        this.isRunning = true;
        console.log('✅ Recovery Controller started');
        this.emit('recovery-controller-started');
    }
    /**
     * Stop recovery controller
     */
    async stop() {
        if (!this.isRunning)
            return;
        this.isRunning = false;
        // Cancel active recovery attempts
        for (const attempt of this.activeAttempts.values()) {
            if (attempt.status === 'running') {
                attempt.status = 'failed';
                attempt.endTime = new Date();
                attempt.error = 'Recovery controller stopped';
            }
        }
        // Save recovery history
        await this.saveRecoveryHistory();
        console.log('🛑 Recovery Controller stopped');
        this.emit('recovery-controller-stopped');
    }
    /**
     * Execute recovery strategy
     */
    async executeRecovery(strategyId, reason, context) {
        if (!this.isRunning) {
            throw new Error('Recovery controller not running');
        }
        const strategy = this.strategies.get(strategyId);
        if (!strategy) {
            throw new Error(`Recovery strategy not found: ${strategyId}`);
        }
        // Check if conditions are met for this strategy
        if (!(await this.checkConditions(strategy, context))) {
            throw new Error(`Recovery conditions not met for strategy: ${strategyId}`);
        }
        const attemptId = this.generateAttemptId();
        const attempt = {
            id: attemptId,
            strategyId,
            startTime: new Date(),
            status: 'running',
            actions: [],
            validationResults: []
        };
        this.activeAttempts.set(attemptId, attempt);
        console.log(`🔧 Starting recovery attempt: ${strategy.name} (${attemptId})`);
        console.log(`   Reason: ${reason}`);
        console.log(`   Strategy: ${strategy.description}`);
        this.recordRecoveryEvent({
            type: 'recovery_started',
            strategyId,
            reason,
            success: false
        });
        try {
            // Execute recovery actions
            await this.executeActions(attempt, strategy.actions);
            // Validate recovery success
            const validationSuccess = await this.validateRecovery(attempt, strategy.validation);
            if (validationSuccess) {
                attempt.status = 'success';
                attempt.endTime = new Date();
                console.log(`✅ Recovery successful: ${strategy.name}`);
                this.recordRecoveryEvent({
                    type: 'recovery_completed',
                    strategyId,
                    reason,
                    success: true,
                    duration: attempt.endTime.getTime() - attempt.startTime.getTime()
                });
                this.emit('recovery-success', attempt);
            }
            else {
                throw new Error('Recovery validation failed');
            }
        }
        catch (error) {
            attempt.status = 'failed';
            attempt.endTime = new Date();
            attempt.error = error instanceof Error ? error.message : String(error);
            console.log(`❌ Recovery failed: ${strategy.name} - ${attempt.error}`);
            // Execute rollback if defined
            if (strategy.rollback) {
                console.log(`🔄 Executing rollback for ${strategy.name}`);
                try {
                    await this.executeActions(attempt, strategy.rollback);
                    attempt.status = 'rollback';
                }
                catch (rollbackError) {
                    console.error(`❌ Rollback failed: ${rollbackError}`);
                }
            }
            this.recordRecoveryEvent({
                type: 'recovery_failed',
                strategyId,
                reason,
                success: false,
                duration: attempt.endTime.getTime() - attempt.startTime.getTime(),
                details: { error: attempt.error }
            });
            this.emit('recovery-failed', attempt);
        }
        finally {
            this.activeAttempts.delete(attemptId);
            await this.persistAttempt(attempt);
        }
        return attempt;
    }
    /**
     * Execute escalated recovery (try multiple strategies)
     */
    async executeEscalatedRecovery(reason, context) {
        console.log(`🚨 Executing escalated recovery: ${reason}`);
        const attempts = [];
        const sortedStrategies = Array.from(this.strategies.values())
            .sort((a, b) => a.priority - b.priority);
        for (const strategy of sortedStrategies) {
            try {
                console.log(`🔧 Trying recovery strategy: ${strategy.name} (Priority ${strategy.priority})`);
                const attempt = await this.executeRecovery(strategy.id, `escalated: ${reason}`, context);
                attempts.push(attempt);
                if (attempt.status === 'success') {
                    console.log(`✅ Escalated recovery successful with strategy: ${strategy.name}`);
                    break;
                }
            }
            catch (error) {
                console.log(`⚠️ Strategy ${strategy.name} failed: ${error}`);
                continue;
            }
        }
        const successfulAttempts = attempts.filter(a => a.status === 'success');
        if (successfulAttempts.length === 0) {
            console.log(`🚨 All recovery strategies failed - escalating to operator`);
            this.recordRecoveryEvent({
                type: 'escalation_triggered',
                strategyId: 'all',
                reason: `All recovery strategies failed: ${reason}`,
                success: false,
                details: { attemptCount: attempts.length }
            });
            this.emit('escalation-required', reason, attempts);
        }
        return attempts;
    }
    /**
     * Add custom recovery strategy
     */
    addRecoveryStrategy(strategy) {
        this.strategies.set(strategy.id, strategy);
        console.log(`📋 Added recovery strategy: ${strategy.name} (Priority ${strategy.priority})`);
        this.emit('strategy-added', strategy);
    }
    /**
     * Remove recovery strategy
     */
    removeRecoveryStrategy(strategyId) {
        const removed = this.strategies.delete(strategyId);
        if (removed) {
            console.log(`🗑️ Removed recovery strategy: ${strategyId}`);
            this.emit('strategy-removed', strategyId);
        }
        return removed;
    }
    /**
     * Get recovery statistics
     */
    getRecoveryStatistics(hours = 24) {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);
        const recentEvents = this.recoveryHistory.filter(event => event.timestamp >= since);
        const attempts = recentEvents.filter(e => e.type === 'recovery_started');
        const successes = recentEvents.filter(e => e.type === 'recovery_completed');
        const failures = recentEvents.filter(e => e.type === 'recovery_failed');
        const escalations = recentEvents.filter(e => e.type === 'escalation_triggered');
        const strategiesUsed = {};
        attempts.forEach(event => {
            strategiesUsed[event.strategyId] = (strategiesUsed[event.strategyId] || 0) + 1;
        });
        const recoveryTimes = successes
            .filter(e => e.duration !== undefined)
            .map(e => e.duration);
        const averageRecoveryTime = recoveryTimes.length > 0
            ? recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length
            : 0;
        return {
            totalAttempts: attempts.length,
            successfulAttempts: successes.length,
            failedAttempts: failures.length,
            successRate: attempts.length > 0 ? (successes.length / attempts.length) * 100 : 0,
            averageRecoveryTime,
            strategiesUsed,
            escalations: escalations.length
        };
    }
    /**
     * Get active recovery attempts
     */
    getActiveAttempts() {
        return Array.from(this.activeAttempts.values());
    }
    /**
     * Get recovery history
     */
    getRecoveryHistory(limit) {
        const history = [...this.recoveryHistory].reverse(); // Most recent first
        return limit ? history.slice(0, limit) : history;
    }
    /**
     * Setup default recovery strategies
     */
    setupDefaultStrategies() {
        // Soft Recovery: Garbage collection and cache clearing
        this.addRecoveryStrategy({
            id: 'soft-recovery',
            name: 'Soft Recovery',
            description: 'Garbage collection and cache clearing for memory pressure relief',
            type: 'soft',
            priority: 1,
            timeout: 30000, // 30 seconds
            retries: 2,
            conditions: [
                { type: 'memory_usage', operator: '>', threshold: 0.8 }
            ],
            actions: [
                { type: 'gc_trigger', timeout: 10000 },
                { type: 'cache_clear', parameters: { priority: 'low' }, timeout: 5000 }
            ],
            validation: {
                checks: [
                    { type: 'memory_check', expected: { operator: '<', threshold: 0.75 }, timeout: 5000 }
                ],
                timeout: 15000,
                retries: 3
            }
        });
        // Medium Recovery: Connection reset and cache clearing
        this.addRecoveryStrategy({
            id: 'medium-recovery',
            name: 'Medium Recovery',
            description: 'Connection reset, cache clearing, and resource cleanup',
            type: 'medium',
            priority: 2,
            timeout: 60000, // 1 minute
            retries: 2,
            conditions: [
                { type: 'health_status', operator: '==', threshold: 'degraded' },
                { type: 'response_time', operator: '>', threshold: 5000 }
            ],
            actions: [
                { type: 'connection_reset', timeout: 15000 },
                { type: 'cache_clear', parameters: { priority: 'medium' }, timeout: 10000 },
                { type: 'gc_trigger', timeout: 10000 }
            ],
            validation: {
                checks: [
                    { type: 'health_endpoint', target: '/health', expected: { ok: true }, timeout: 10000 },
                    { type: 'response_time', expected: { operator: '<', threshold: 3000 }, timeout: 10000 }
                ],
                timeout: 30000,
                retries: 3
            }
        });
        // Hard Recovery: Service restart
        this.addRecoveryStrategy({
            id: 'hard-recovery',
            name: 'Hard Recovery',
            description: 'Service restart for complete system recovery',
            type: 'hard',
            priority: 3,
            timeout: 120000, // 2 minutes
            retries: 1,
            conditions: [
                { type: 'health_status', operator: '==', threshold: 'unhealthy' }
            ],
            actions: [
                { type: 'service_restart', target: 'gateway', timeout: 60000 }
            ],
            validation: {
                checks: [
                    { type: 'health_endpoint', target: '/health', expected: { ok: true }, timeout: 30000 },
                    { type: 'health_endpoint', target: '/ready', expected: { ready: true }, timeout: 30000 }
                ],
                timeout: 60000,
                retries: 5
            },
            rollback: [
                { type: 'service_restart', target: 'gateway', parameters: { mode: 'safe' }, timeout: 60000 }
            ]
        });
        // Emergency Recovery: Container restart
        this.addRecoveryStrategy({
            id: 'emergency-recovery',
            name: 'Emergency Recovery',
            description: 'Container restart for critical system failures',
            type: 'hard',
            priority: 4,
            timeout: 180000, // 3 minutes
            retries: 1,
            conditions: [
                { type: 'custom', operator: '==', threshold: 'emergency' }
            ],
            actions: [
                { type: 'container_restart', target: 'gateway', timeout: 120000 }
            ],
            validation: {
                checks: [
                    { type: 'health_endpoint', target: '/health', expected: { ok: true }, timeout: 60000 },
                    { type: 'memory_check', expected: { operator: '<', threshold: 0.5 }, timeout: 30000 }
                ],
                timeout: 120000,
                retries: 3
            }
        });
    }
    /**
     * Check if recovery conditions are met
     */
    async checkConditions(strategy, context) {
        for (const condition of strategy.conditions) {
            const value = await this.evaluateCondition(condition, context);
            if (!this.compareValues(value, condition.operator, condition.threshold)) {
                return false;
            }
        }
        return true;
    }
    /**
     * Execute recovery actions
     */
    async executeActions(attempt, actions) {
        for (const action of actions) {
            const actionResult = {
                action,
                startTime: new Date(),
                status: 'running'
            };
            attempt.actions.push(actionResult);
            try {
                console.log(`🔧 Executing recovery action: ${action.type}`);
                const result = await this.executeAction(action);
                actionResult.status = 'success';
                actionResult.endTime = new Date();
                actionResult.result = result;
                console.log(`✅ Recovery action completed: ${action.type}`);
            }
            catch (error) {
                actionResult.status = 'failed';
                actionResult.endTime = new Date();
                actionResult.error = error instanceof Error ? error.message : String(error);
                console.log(`❌ Recovery action failed: ${action.type} - ${actionResult.error}`);
                throw error;
            }
        }
    }
    /**
     * Execute individual recovery action
     */
    async executeAction(action) {
        const timeout = action.timeout || 30000;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Action timeout: ${action.type}`));
            }, timeout);
            const executeActionInternal = async () => {
                try {
                    let result;
                    switch (action.type) {
                        case 'gc_trigger':
                            result = await this.triggerGarbageCollection();
                            break;
                        case 'cache_clear':
                            result = await this.clearCache(action.parameters?.priority || 'medium');
                            break;
                        case 'connection_reset':
                            result = await this.resetConnections();
                            break;
                        case 'service_restart':
                            result = await this.restartService(action.target || 'gateway');
                            break;
                        case 'container_restart':
                            result = await this.restartContainer(action.target || 'gateway');
                            break;
                        default:
                            throw new Error(`Unknown recovery action: ${action.type}`);
                    }
                    clearTimeout(timer);
                    resolve(result);
                }
                catch (error) {
                    clearTimeout(timer);
                    reject(error);
                }
            };
            executeActionInternal();
        });
    }
    /**
     * Validate recovery success
     */
    async validateRecovery(attempt, validation) {
        console.log(`🔍 Validating recovery success...`);
        let retries = 0;
        while (retries <= validation.retries) {
            let allChecksPassed = true;
            for (const check of validation.checks) {
                const result = await this.executeValidationCheck(check);
                attempt.validationResults.push(result);
                if (!result.success) {
                    allChecksPassed = false;
                    console.log(`❌ Validation check failed: ${check.type} - Expected: ${JSON.stringify(check.expected)}, Got: ${JSON.stringify(result.value)}`);
                }
                else {
                    console.log(`✅ Validation check passed: ${check.type}`);
                }
            }
            if (allChecksPassed) {
                console.log(`✅ All validation checks passed`);
                return true;
            }
            retries++;
            if (retries <= validation.retries) {
                console.log(`⏳ Validation failed, retrying in 5 seconds... (${retries}/${validation.retries})`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        console.log(`❌ Validation failed after ${validation.retries} retries`);
        return false;
    }
    /**
     * Execute validation check
     */
    async executeValidationCheck(check) {
        try {
            let value;
            switch (check.type) {
                case 'health_endpoint':
                    value = await this.checkHealthEndpoint(check.target || '/health');
                    break;
                case 'memory_check':
                    value = await this.checkMemoryUsage();
                    break;
                case 'response_time':
                    value = await this.checkResponseTime(check.target || '/health');
                    break;
                default:
                    throw new Error(`Unknown validation check: ${check.type}`);
            }
            const success = this.validateCheckResult(value, check.expected);
            return {
                check,
                success,
                value,
                expected: check.expected
            };
        }
        catch (error) {
            return {
                check,
                success: false,
                value: null,
                expected: check.expected,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Recovery action implementations
     */
    async triggerGarbageCollection() {
        if (global.gc) {
            global.gc();
            return { success: true, message: 'Garbage collection triggered' };
        }
        else {
            throw new Error('Garbage collection not available (run with --expose-gc)');
        }
    }
    async clearCache(priority) {
        // Simulate cache clearing - in production, integrate with actual cache
        console.log(`🧹 Clearing ${priority} priority cache`);
        return { success: true, priority, cleared: 100 };
    }
    async resetConnections() {
        // Simulate connection reset - in production, reset actual connections
        console.log(`🔌 Resetting connections`);
        return { success: true, connectionsReset: 10 };
    }
    async restartService(serviceName) {
        console.log(`🔄 Restarting service: ${serviceName}`);
        // In production, this would restart the actual service
        // For now, simulate the restart
        await new Promise(resolve => setTimeout(resolve, 5000));
        return { success: true, service: serviceName, restartTime: new Date() };
    }
    async restartContainer(containerName) {
        console.log(`🐳 Restarting container: ${containerName}`);
        try {
            // Try to restart the container using docker compose
            const result = await this.executeCommand('docker', ['compose', 'restart', containerName]);
            return { success: true, container: containerName, output: result };
        }
        catch (error) {
            throw new Error(`Failed to restart container ${containerName}: ${error}`);
        }
    }
    /**
     * Validation check implementations
     */
    async checkHealthEndpoint(endpoint) {
        // Simulate health endpoint check - in production, make actual HTTP request
        return { ok: true, status: 'healthy' };
    }
    async checkMemoryUsage() {
        const memUsage = process.memoryUsage();
        return memUsage.heapUsed / memUsage.heapTotal;
    }
    async checkResponseTime(endpoint) {
        // Simulate response time check - in production, measure actual response time
        return 150; // milliseconds
    }
    /**
     * Utility methods
     */
    async evaluateCondition(condition, context) {
        switch (condition.type) {
            case 'memory_usage':
                return await this.checkMemoryUsage();
            case 'health_status':
                return context?.healthStatus || 'unknown';
            case 'response_time':
                return await this.checkResponseTime('/health');
            case 'error_rate':
                return context?.errorRate || 0;
            case 'custom':
                return context?.[condition.type] || null;
            default:
                return null;
        }
    }
    compareValues(value, operator, threshold) {
        switch (operator) {
            case '>': return value > threshold;
            case '<': return value < threshold;
            case '>=': return value >= threshold;
            case '<=': return value <= threshold;
            case '==': return value === threshold;
            case '!=': return value !== threshold;
            default: return false;
        }
    }
    validateCheckResult(value, expected) {
        if (typeof expected === 'object' && expected.operator) {
            return this.compareValues(value, expected.operator, expected.threshold);
        }
        return JSON.stringify(value) === JSON.stringify(expected);
    }
    async executeCommand(command, args) {
        try {
            const result = await (0, cross_platform_executor_1.executeCommand)(command, args, {
                timeout: 30000,
                retries: 2,
                retryDelay: 1000
            });
            if (result.success) {
                return result.stdout;
            }
            else {
                throw new Error(`Command failed with code ${result.exitCode}: ${result.stderr}`);
            }
        }
        catch (error) {
            throw new Error(`Cross-platform execution failed: ${error instanceof Error ? error.message : error}`);
        }
    }
    generateAttemptId() {
        return `recovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    recordRecoveryEvent(event) {
        const recoveryEvent = {
            id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            ...event
        };
        this.recoveryHistory.push(recoveryEvent);
        // Trim history if needed
        if (this.recoveryHistory.length > this.maxHistorySize) {
            this.recoveryHistory.shift();
        }
        this.emit('recovery-event', recoveryEvent);
    }
    async persistAttempt(attempt) {
        try {
            const filename = `attempt-${attempt.id}.json`;
            const filepath = (0, path_1.join)(this.storageDir, filename);
            await fs_1.promises.writeFile(filepath, JSON.stringify(attempt, null, 2));
        }
        catch (error) {
            console.error('Failed to persist recovery attempt:', error);
        }
    }
    async saveRecoveryHistory() {
        try {
            const filepath = (0, path_1.join)(this.storageDir, 'recovery-history.json');
            await fs_1.promises.writeFile(filepath, JSON.stringify(this.recoveryHistory, null, 2));
        }
        catch (error) {
            console.error('Failed to save recovery history:', error);
        }
    }
    async loadRecoveryHistory() {
        try {
            const filepath = (0, path_1.join)(this.storageDir, 'recovery-history.json');
            const content = await fs_1.promises.readFile(filepath, 'utf-8');
            this.recoveryHistory = JSON.parse(content);
            console.log(`📂 Loaded ${this.recoveryHistory.length} recovery events from history`);
        }
        catch (error) {
            // File doesn't exist or is corrupted, start fresh
            console.log('📂 Starting with fresh recovery history');
        }
    }
}
exports.RecoveryController = RecoveryController;
// Export singleton instance
exports.recoveryController = new RecoveryController();
//# sourceMappingURL=recovery-controller.js.map
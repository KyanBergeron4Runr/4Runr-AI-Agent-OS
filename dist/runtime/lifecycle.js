"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lifecycleManager = void 0;
exports.getHealthStatus = getHealthStatus;
exports.getReadinessStatus = getReadinessStatus;
exports.onShutdown = onShutdown;
exports.isShutdownInProgress = isShutdownInProgress;
const memory_db_1 = require("../models/memory-db");
const circuit_1 = require("./circuit");
const cache_1 = require("./cache");
class LifecycleManager {
    constructor() {
        this.isShuttingDown = false;
        this.shutdownCallbacks = [];
        this.startTime = Date.now();
        this.setupGracefulShutdown();
    }
    getHealthStatus() {
        const memUsage = process.memoryUsage();
        // Enhanced health status with more detailed memory info
        return {
            ok: !this.isShuttingDown,
            timestamp: new Date().toISOString(),
            uptime: Date.now() - this.startTime,
            memory: {
                used: memUsage.heapUsed,
                total: memUsage.heapTotal,
                external: memUsage.external
            },
            process: {
                pid: process.pid,
                version: process.version,
                platform: process.platform
            }
        };
    }
    async getReadinessStatus() {
        const checks = {
            database: true,
            circuitBreakers: {},
            cache: true
        };
        const details = {
            database: 'OK',
            circuitBreakers: {},
            cache: 'OK'
        };
        // Check database
        try {
            await memory_db_1.memoryDB.getStats();
        }
        catch (error) {
            checks.database = false;
            details.database = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
        // Check circuit breakers
        const breakerStats = circuit_1.circuitBreakerRegistry.getBreakerStats();
        for (const [tool, stats] of Object.entries(breakerStats)) {
            const isReady = stats.state !== 'OPEN';
            checks.circuitBreakers[tool] = isReady;
            details.circuitBreakers[tool] = isReady ? 'OK' : `OPEN (${stats.failureCount} failures)`;
        }
        // Check cache
        try {
            const cacheStats = cache_1.cache.getStats();
            if (cacheStats.size > cacheStats.maxSize * 0.9) {
                checks.cache = false;
                details.cache = `High usage: ${cacheStats.size}/${cacheStats.maxSize}`;
            }
        }
        catch (error) {
            checks.cache = false;
            details.cache = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
        const ready = checks.database &&
            Object.values(checks.circuitBreakers).every(Boolean) &&
            checks.cache;
        return {
            ready,
            timestamp: new Date().toISOString(),
            checks,
            details
        };
    }
    onShutdown(callback) {
        this.shutdownCallbacks.push(callback);
    }
    setupGracefulShutdown() {
        const signals = ['SIGTERM', 'SIGINT'];
        signals.forEach(signal => {
            process.on(signal, async () => {
                console.log(`\nReceived ${signal}, starting graceful shutdown...`);
                await this.shutdown();
            });
        });
        // Handle uncaught exceptions
        process.on('uncaughtException', async (error) => {
            console.error('Uncaught Exception:', error);
            await this.shutdown(1);
        });
        // Handle unhandled promise rejections
        process.on('unhandledRejection', async (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            await this.shutdown(1);
        });
    }
    async shutdown(exitCode = 0) {
        if (this.isShuttingDown) {
            console.log('Shutdown already in progress...');
            return;
        }
        this.isShuttingDown = true;
        console.log('Starting graceful shutdown...');
        try {
            // Execute shutdown callbacks
            const shutdownPromises = this.shutdownCallbacks.map(async (callback, index) => {
                try {
                    await callback();
                    console.log(`Shutdown callback ${index + 1} completed`);
                }
                catch (error) {
                    console.error(`Shutdown callback ${index + 1} failed:`, error);
                }
            });
            // Wait for all callbacks with timeout
            await Promise.race([
                Promise.all(shutdownPromises),
                new Promise(resolve => setTimeout(resolve, 10000)) // 10 second timeout
            ]);
            console.log('Graceful shutdown completed');
        }
        catch (error) {
            console.error('Error during shutdown:', error);
        }
        finally {
            process.exit(exitCode);
        }
    }
    isShutdownInProgress() {
        return this.isShuttingDown;
    }
    getUptime() {
        return Date.now() - this.startTime;
    }
}
// Global lifecycle manager instance
exports.lifecycleManager = new LifecycleManager();
// Default shutdown handlers
exports.lifecycleManager.onShutdown(async () => {
    console.log('Flushing logs...');
    // Any log flushing logic would go here
});
exports.lifecycleManager.onShutdown(async () => {
    console.log('Closing database connections...');
    // Any database cleanup would go here
});
exports.lifecycleManager.onShutdown(async () => {
    console.log('Clearing caches...');
    cache_1.cache.clear();
});
// Utility functions
function getHealthStatus() {
    return exports.lifecycleManager.getHealthStatus();
}
async function getReadinessStatus() {
    return exports.lifecycleManager.getReadinessStatus();
}
function onShutdown(callback) {
    exports.lifecycleManager.onShutdown(callback);
}
function isShutdownInProgress() {
    return exports.lifecycleManager.isShutdownInProgress();
}
//# sourceMappingURL=lifecycle.js.map
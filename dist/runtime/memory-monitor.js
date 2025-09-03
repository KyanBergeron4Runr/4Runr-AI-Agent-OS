"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryMonitor = exports.MemoryMonitor = void 0;
const events_1 = require("events");
class MemoryMonitor extends events_1.EventEmitter {
    constructor(monitoringInterval = 5000, // 5 seconds
    logStats = false) {
        super();
        this.monitoringInterval = monitoringInterval;
        this.logStats = logStats;
        this.intervalId = null;
        this.warningThreshold = 0.8; // 80% of heap limit
        this.criticalThreshold = 0.9; // 90% of heap limit
        this.lastWarning = 0;
        this.warningCooldown = 30000; // 30 seconds between warnings
    }
    start() {
        if (this.intervalId) {
            return; // Already running
        }
        this.intervalId = setInterval(() => {
            const stats = this.getMemoryStats();
            this.checkThresholds(stats);
            if (this.logStats) {
                console.log(`[Memory] Heap: ${Math.round(stats.heapUsed / 1024 / 1024)}MB / ${Math.round(stats.heapTotal / 1024 / 1024)}MB (${Math.round((stats.heapUsed / stats.heapLimit) * 100)}%)`);
            }
            this.emit('stats', stats);
        }, this.monitoringInterval);
        console.log('🧠 Memory monitor started');
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('🧠 Memory monitor stopped');
        }
    }
    getMemoryStats() {
        const memUsage = process.memoryUsage();
        const heapLimit = this.getHeapLimit();
        return {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            heapLimit,
            rss: memUsage.rss,
            external: memUsage.external,
            timestamp: Date.now()
        };
    }
    getHeapLimit() {
        // Try to get the actual heap limit from V8
        try {
            const v8 = require('v8');
            const heapStats = v8.getHeapStatistics();
            return heapStats.heap_size_limit;
        }
        catch {
            // Fallback to estimated limit (1GB = 1024MB as set in Dockerfile)
            return 1024 * 1024 * 1024;
        }
    }
    checkThresholds(stats) {
        const usagePercentage = stats.heapUsed / stats.heapLimit;
        const now = Date.now();
        if (usagePercentage >= this.criticalThreshold) {
            if (now - this.lastWarning > this.warningCooldown) {
                this.emit('critical', stats, usagePercentage);
                this.lastWarning = now;
                console.error(`🚨 CRITICAL: Memory usage at ${Math.round(usagePercentage * 100)}% (${Math.round(stats.heapUsed / 1024 / 1024)}MB / ${Math.round(stats.heapLimit / 1024 / 1024)}MB)`);
            }
        }
        else if (usagePercentage >= this.warningThreshold) {
            if (now - this.lastWarning > this.warningCooldown) {
                this.emit('warning', stats, usagePercentage);
                this.lastWarning = now;
                console.warn(`⚠️  WARNING: Memory usage at ${Math.round(usagePercentage * 100)}% (${Math.round(stats.heapUsed / 1024 / 1024)}MB / ${Math.round(stats.heapLimit / 1024 / 1024)}MB)`);
            }
        }
    }
    // Force garbage collection if available (needs --expose-gc flag)
    forceGC() {
        try {
            if (global.gc) {
                global.gc();
                console.log('🗑️  Forced garbage collection');
                return true;
            }
        }
        catch (error) {
            console.warn('Failed to force GC:', error);
        }
        return false;
    }
}
exports.MemoryMonitor = MemoryMonitor;
exports.memoryMonitor = new MemoryMonitor();
//# sourceMappingURL=memory-monitor.js.map
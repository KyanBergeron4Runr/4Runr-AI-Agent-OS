"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.multiLevelMonitor = exports.MultiLevelMonitor = void 0;
const events_1 = require("events");
const fs_1 = require("fs");
const path_1 = require("path");
const child_process_1 = require("child_process");
const metrics_1 = require("./metrics");
/**
 * Multi-Level Monitoring System
 * Collects metrics at different levels and persists data even during application failures
 */
class MultiLevelMonitor extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.isRunning = false;
        this.collectors = new Map();
        this.maxStorageFiles = 100;
        this.retryAttempts = 3;
        this.retryDelay = 1000;
        this.storageDir = options.storageDir || 'logs/monitoring';
        this.maxStorageFiles = options.maxStorageFiles || 100;
        this.collectionIntervals = {
            application: 30000, // 30 seconds
            system: 60000, // 1 minute
            docker: 60000, // 1 minute
            infrastructure: 120000, // 2 minutes
            ...options.collectionIntervals
        };
    }
    /**
     * Start multi-level monitoring
     */
    async start() {
        if (this.isRunning)
            return;
        console.log('📊 Starting Multi-Level Monitoring System...');
        // Ensure storage directory exists
        await fs_1.promises.mkdir(this.storageDir, { recursive: true });
        this.isRunning = true;
        // Start all collectors
        this.startApplicationMonitoring();
        this.startSystemMonitoring();
        this.startDockerMonitoring();
        this.startInfrastructureMonitoring();
        // Start cleanup routine
        this.startCleanupRoutine();
        console.log('✅ Multi-Level Monitoring System started');
        this.emit('monitoring-started');
    }
    /**
     * Stop monitoring
     */
    async stop() {
        if (!this.isRunning)
            return;
        this.isRunning = false;
        // Clear all timers
        for (const timer of this.collectors.values()) {
            clearInterval(timer);
        }
        this.collectors.clear();
        console.log('🛑 Multi-Level Monitoring System stopped');
        this.emit('monitoring-stopped');
    }
    /**
     * Get recent monitoring data
     */
    async getRecentData(level, limit = 10) {
        try {
            const files = await fs_1.promises.readdir(this.storageDir);
            const dataFiles = files
                .filter(f => f.endsWith('.json'))
                .filter(f => !level || f.includes(`-${level}-`))
                .sort()
                .reverse()
                .slice(0, limit);
            const snapshots = [];
            for (const file of dataFiles) {
                try {
                    const content = await fs_1.promises.readFile((0, path_1.join)(this.storageDir, file), 'utf-8');
                    const snapshot = JSON.parse(content);
                    snapshots.push(snapshot);
                }
                catch (error) {
                    console.warn(`Failed to read monitoring file ${file}:`, error);
                }
            }
            return snapshots;
        }
        catch (error) {
            console.error('Failed to get recent monitoring data:', error);
            return [];
        }
    }
    /**
     * Query monitoring data by time range
     */
    async queryData(options = {}) {
        const { level, startTime, endTime, limit = 100 } = options;
        try {
            const files = await fs_1.promises.readdir(this.storageDir);
            const dataFiles = files
                .filter(f => f.endsWith('.json'))
                .filter(f => !level || f.includes(`-${level}-`))
                .sort();
            const snapshots = [];
            for (const file of dataFiles) {
                if (snapshots.length >= limit)
                    break;
                try {
                    const content = await fs_1.promises.readFile((0, path_1.join)(this.storageDir, file), 'utf-8');
                    const snapshot = JSON.parse(content);
                    const timestamp = new Date(snapshot.timestamp);
                    // Filter by time range
                    if (startTime && timestamp < startTime)
                        continue;
                    if (endTime && timestamp > endTime)
                        continue;
                    snapshots.push(snapshot);
                }
                catch (error) {
                    console.warn(`Failed to read monitoring file ${file}:`, error);
                }
            }
            return snapshots;
        }
        catch (error) {
            console.error('Failed to query monitoring data:', error);
            return [];
        }
    }
    /**
     * Start application-level monitoring
     */
    startApplicationMonitoring() {
        const timer = setInterval(async () => {
            await this.collectApplicationMetrics();
        }, this.collectionIntervals.application);
        this.collectors.set('application', timer);
        // Collect immediately
        setImmediate(() => this.collectApplicationMetrics());
    }
    /**
     * Start system-level monitoring
     */
    startSystemMonitoring() {
        const timer = setInterval(async () => {
            await this.collectSystemMetrics();
        }, this.collectionIntervals.system);
        this.collectors.set('system', timer);
        // Collect immediately
        setImmediate(() => this.collectSystemMetrics());
    }
    /**
     * Start Docker monitoring
     */
    startDockerMonitoring() {
        const timer = setInterval(async () => {
            await this.collectDockerMetrics();
        }, this.collectionIntervals.docker);
        this.collectors.set('docker', timer);
        // Collect immediately
        setImmediate(() => this.collectDockerMetrics());
    }
    /**
     * Start infrastructure monitoring
     */
    startInfrastructureMonitoring() {
        const timer = setInterval(async () => {
            await this.collectInfrastructureMetrics();
        }, this.collectionIntervals.infrastructure);
        this.collectors.set('infrastructure', timer);
        // Collect immediately
        setImmediate(() => this.collectInfrastructureMetrics());
    }
    /**
     * Collect application metrics (Prometheus)
     */
    async collectApplicationMetrics() {
        await this.withRetry('application', async () => {
            try {
                const prometheusData = (0, metrics_1.getMetricsResponse)();
                const parsed = this.parsePrometheusMetrics(prometheusData);
                const metrics = {
                    timestamp: new Date(),
                    prometheus: prometheusData,
                    parsed
                };
                await this.storeSnapshot({
                    timestamp: new Date(),
                    level: 'application',
                    data: metrics,
                    success: true
                });
                this.emit('metrics-collected', 'application', metrics);
            }
            catch (error) {
                throw new Error(`Application metrics collection failed: ${error}`);
            }
        });
    }
    /**
     * Collect system metrics
     */
    async collectSystemMetrics() {
        await this.withRetry('system', async () => {
            try {
                const metrics = {
                    timestamp: new Date(),
                    cpu: await this.getCpuMetrics(),
                    memory: await this.getMemoryMetrics(),
                    disk: await this.getDiskMetrics(),
                    network: await this.getNetworkMetrics()
                };
                await this.storeSnapshot({
                    timestamp: new Date(),
                    level: 'system',
                    data: metrics,
                    success: true
                });
                this.emit('metrics-collected', 'system', metrics);
            }
            catch (error) {
                throw new Error(`System metrics collection failed: ${error}`);
            }
        });
    }
    /**
     * Collect Docker metrics
     */
    async collectDockerMetrics() {
        await this.withRetry('docker', async () => {
            try {
                const containers = await this.getDockerStats();
                const metrics = {
                    timestamp: new Date(),
                    containers
                };
                await this.storeSnapshot({
                    timestamp: new Date(),
                    level: 'docker',
                    data: metrics,
                    success: true
                });
                this.emit('metrics-collected', 'docker', metrics);
            }
            catch (error) {
                throw new Error(`Docker metrics collection failed: ${error}`);
            }
        });
    }
    /**
     * Collect infrastructure metrics
     */
    async collectInfrastructureMetrics() {
        await this.withRetry('infrastructure', async () => {
            try {
                const metrics = {
                    timestamp: new Date(),
                    database: await this.checkDatabaseHealth(),
                    redis: await this.checkRedisHealth(),
                    external: await this.checkExternalServices()
                };
                await this.storeSnapshot({
                    timestamp: new Date(),
                    level: 'infrastructure',
                    data: metrics,
                    success: true
                });
                this.emit('metrics-collected', 'infrastructure', metrics);
            }
            catch (error) {
                throw new Error(`Infrastructure metrics collection failed: ${error}`);
            }
        });
    }
    /**
     * Execute with retry logic
     */
    async withRetry(level, operation) {
        let lastError = null;
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                await operation();
                return;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < this.retryAttempts) {
                    console.warn(`${level} metrics collection attempt ${attempt} failed, retrying...`);
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
                }
            }
        }
        // All retries failed, store failure snapshot
        await this.storeSnapshot({
            timestamp: new Date(),
            level: level,
            data: {},
            success: false,
            error: lastError?.message || 'Unknown error'
        });
        this.emit('collection-failed', level, lastError);
    }
    /**
     * Store monitoring snapshot to disk
     */
    async storeSnapshot(snapshot) {
        try {
            const timestamp = snapshot.timestamp.toISOString().replace(/[:.]/g, '-');
            const filename = `${timestamp}-${snapshot.level}-${snapshot.success ? 'success' : 'failed'}.json`;
            const filepath = (0, path_1.join)(this.storageDir, filename);
            await fs_1.promises.writeFile(filepath, JSON.stringify(snapshot, null, 2));
        }
        catch (error) {
            console.error('Failed to store monitoring snapshot:', error);
        }
    }
    /**
     * Parse Prometheus metrics into structured data
     */
    parsePrometheusMetrics(prometheusData) {
        const counters = {};
        const gauges = {};
        const histograms = {};
        const lines = prometheusData.split('\n');
        for (const line of lines) {
            if (line.startsWith('#') || !line.trim())
                continue;
            const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*(?:\{[^}]*\})?) (.+)$/);
            if (!match)
                continue;
            const [, metricName, value] = match;
            const numValue = parseFloat(value);
            if (metricName.includes('_total')) {
                counters[metricName] = numValue;
            }
            else if (metricName.includes('_bucket') || metricName.includes('_sum') || metricName.includes('_count')) {
                histograms[metricName] = numValue;
            }
            else {
                gauges[metricName] = numValue;
            }
        }
        return { counters, gauges, histograms };
    }
    /**
     * Get CPU metrics
     */
    async getCpuMetrics() {
        const cpuUsage = process.cpuUsage();
        const uptime = process.uptime();
        // Calculate CPU percentage (simplified)
        const cpuPercent = ((cpuUsage.user + cpuUsage.system) / 1000000) / uptime * 100;
        return {
            usage: Math.min(cpuPercent, 100),
            loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0]
        };
    }
    /**
     * Get memory metrics
     */
    async getMemoryMetrics() {
        const memUsage = process.memoryUsage();
        const totalMem = require('os').totalmem();
        const freeMem = require('os').freemem();
        return {
            total: totalMem,
            used: totalMem - freeMem,
            free: freeMem,
            available: freeMem
        };
    }
    /**
     * Get disk metrics (simplified)
     */
    async getDiskMetrics() {
        // Simplified implementation - in production, use proper disk monitoring
        return {
            total: 1000000000, // 1GB placeholder
            used: 500000000, // 500MB placeholder
            free: 500000000 // 500MB placeholder
        };
    }
    /**
     * Get network metrics (simplified)
     */
    async getNetworkMetrics() {
        // Simplified implementation - in production, use proper network monitoring
        return {
            bytesIn: 0,
            bytesOut: 0,
            packetsIn: 0,
            packetsOut: 0
        };
    }
    /**
     * Get Docker stats
     */
    async getDockerStats() {
        return new Promise((resolve, reject) => {
            const docker = (0, child_process_1.spawn)('docker', ['stats', '--no-stream', '--format', 'table {{.Container}}\t{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}']);
            let output = '';
            let errorOutput = '';
            docker.stdout.on('data', (data) => {
                output += data.toString();
            });
            docker.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            docker.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Docker stats failed: ${errorOutput}`));
                    return;
                }
                try {
                    const containers = this.parseDockerStats(output);
                    resolve(containers);
                }
                catch (error) {
                    reject(error);
                }
            });
            // Timeout after 10 seconds
            setTimeout(() => {
                docker.kill();
                reject(new Error('Docker stats timeout'));
            }, 10000);
        });
    }
    /**
     * Parse Docker stats output
     */
    parseDockerStats(output) {
        const lines = output.trim().split('\n').slice(1); // Skip header
        const containers = [];
        for (const line of lines) {
            const parts = line.split('\t');
            if (parts.length < 6)
                continue;
            const [id, name, cpuPerc, memUsage, netIO, blockIO] = parts;
            // Parse CPU percentage
            const cpu = parseFloat(cpuPerc.replace('%', '')) || 0;
            // Parse memory usage (e.g., "123.4MiB / 1.5GiB")
            const memMatch = memUsage.match(/([0-9.]+)([A-Za-z]+) \/ ([0-9.]+)([A-Za-z]+)/);
            let memoryUsage = 0, memoryLimit = 0, memoryPercent = 0;
            if (memMatch) {
                memoryUsage = this.parseSize(memMatch[1], memMatch[2]);
                memoryLimit = this.parseSize(memMatch[3], memMatch[4]);
                memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;
            }
            // Parse network I/O (e.g., "1.2kB / 3.4kB")
            const netMatch = netIO.match(/([0-9.]+)([A-Za-z]+) \/ ([0-9.]+)([A-Za-z]+)/);
            let netRx = 0, netTx = 0;
            if (netMatch) {
                netRx = this.parseSize(netMatch[1], netMatch[2]);
                netTx = this.parseSize(netMatch[3], netMatch[4]);
            }
            // Parse block I/O (e.g., "5.6MB / 7.8MB")
            const blockMatch = blockIO.match(/([0-9.]+)([A-Za-z]+) \/ ([0-9.]+)([A-Za-z]+)/);
            let blockRead = 0, blockWrite = 0;
            if (blockMatch) {
                blockRead = this.parseSize(blockMatch[1], blockMatch[2]);
                blockWrite = this.parseSize(blockMatch[3], blockMatch[4]);
            }
            containers.push({
                id: id.substring(0, 12), // Short ID
                name,
                cpu,
                memory: {
                    usage: memoryUsage,
                    limit: memoryLimit,
                    percent: memoryPercent
                },
                network: {
                    rx: netRx,
                    tx: netTx
                },
                blockIO: {
                    read: blockRead,
                    write: blockWrite
                }
            });
        }
        return containers;
    }
    /**
     * Parse size string to bytes
     */
    parseSize(value, unit) {
        const num = parseFloat(value);
        const unitLower = unit.toLowerCase();
        const multipliers = {
            'b': 1,
            'kb': 1024,
            'mb': 1024 * 1024,
            'gb': 1024 * 1024 * 1024,
            'kib': 1024,
            'mib': 1024 * 1024,
            'gib': 1024 * 1024 * 1024
        };
        return num * (multipliers[unitLower] || 1);
    }
    /**
     * Check database health
     */
    async checkDatabaseHealth() {
        try {
            const start = Date.now();
            // Try to import and use the database
            const { memoryDB } = await Promise.resolve().then(() => __importStar(require('../models/memory-db')));
            await memoryDB.getStats();
            const responseTime = Date.now() - start;
            return {
                connected: true,
                responseTime
            };
        }
        catch (error) {
            return {
                connected: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Check Redis health
     */
    async checkRedisHealth() {
        try {
            const start = Date.now();
            // Try to import and use the cache
            const { cache } = await Promise.resolve().then(() => __importStar(require('../runtime/cache')));
            cache.getStats();
            const responseTime = Date.now() - start;
            return {
                connected: true,
                responseTime
            };
        }
        catch (error) {
            return {
                connected: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Check external services health
     */
    async checkExternalServices() {
        // Placeholder for external service checks
        // In production, you'd check actual external dependencies
        return {};
    }
    /**
     * Start cleanup routine to manage storage
     */
    startCleanupRoutine() {
        const timer = setInterval(async () => {
            await this.cleanupOldFiles();
        }, 3600000); // Every hour
        this.collectors.set('cleanup', timer);
    }
    /**
     * Clean up old monitoring files
     */
    async cleanupOldFiles() {
        try {
            const files = await fs_1.promises.readdir(this.storageDir);
            const dataFiles = files
                .filter(f => f.endsWith('.json'))
                .sort();
            if (dataFiles.length > this.maxStorageFiles) {
                const filesToDelete = dataFiles.slice(0, dataFiles.length - this.maxStorageFiles);
                for (const file of filesToDelete) {
                    try {
                        await fs_1.promises.unlink((0, path_1.join)(this.storageDir, file));
                    }
                    catch (error) {
                        console.warn(`Failed to delete old monitoring file ${file}:`, error);
                    }
                }
                console.log(`🧹 Cleaned up ${filesToDelete.length} old monitoring files`);
            }
        }
        catch (error) {
            console.error('Failed to cleanup old monitoring files:', error);
        }
    }
}
exports.MultiLevelMonitor = MultiLevelMonitor;
// Export singleton instance
exports.multiLevelMonitor = new MultiLevelMonitor();
//# sourceMappingURL=multi-level-monitor.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.platformOptimizer = exports.PlatformOptimizer = void 0;
exports.getPlatformInfo = getPlatformInfo;
exports.applyPlatformOptimizations = applyPlatformOptimizations;
exports.optimizedFileWrite = optimizedFileWrite;
const os_1 = require("os");
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * Platform-Specific Optimizations Manager
 * Provides optimized configurations and utilities for different platforms
 */
class PlatformOptimizer {
    constructor() {
        this.platformInfo = this.detectPlatform();
        this.optimizations = this.generateOptimizations();
        console.log(`🔧 Platform Optimizer initialized for ${this.platformInfo.platform} (${this.platformInfo.architecture})`);
        if (this.platformInfo.isWSL) {
            console.log('🐧 WSL environment detected - applying WSL-specific optimizations');
        }
        if (this.platformInfo.isDocker) {
            console.log('🐳 Docker environment detected - applying container optimizations');
        }
    }
    /**
     * Get platform information and optimizations
     */
    getPlatformInfo() {
        return this.platformInfo;
    }
    /**
     * Get optimized file handling configuration
     */
    getFileHandlingOptimizations() {
        return this.optimizations.fileHandling;
    }
    /**
     * Get optimized process management configuration
     */
    getProcessManagementOptimizations() {
        return this.optimizations.processManagement;
    }
    /**
     * Get optimized memory management configuration
     */
    getMemoryManagementOptimizations() {
        return this.optimizations.memoryManagement;
    }
    /**
     * Get optimized network configuration
     */
    getNetworkOptimizations() {
        return this.optimizations.networkOptimizations;
    }
    /**
     * Get optimized Docker configuration
     */
    getDockerOptimizations() {
        return this.optimizations.dockerOptimizations;
    }
    /**
     * Apply platform-specific file system optimizations
     */
    async optimizeFileOperations(filePath, data) {
        const opts = this.optimizations.fileHandling;
        try {
            if (this.platformInfo.platform === 'win32') {
                // Windows-specific file handling
                await this.writeFileWindows(filePath, data, opts);
            }
            else {
                // Unix-like file handling
                await this.writeFileUnix(filePath, data, opts);
            }
        }
        catch (error) {
            console.error(`❌ Optimized file operation failed: ${error}`);
            throw error;
        }
    }
    /**
     * Apply platform-specific process optimizations
     */
    applyProcessOptimizations() {
        const opts = this.optimizations.processManagement;
        // Set process title for easier identification
        process.title = `4runr-gateway-${this.platformInfo.platform}`;
        // Configure process limits based on platform
        if (this.platformInfo.platform !== 'win32') {
            try {
                // Set nice value for better process scheduling on Unix-like systems
                process.setpriority?.(0, -5); // Slightly higher priority
            }
            catch (error) {
                console.log('⚠️ Could not set process priority:', error);
            }
        }
        // Configure signal handling
        opts.signalHandling.forEach(signal => {
            process.on(signal, () => {
                console.log(`📡 Received ${signal}, initiating graceful shutdown...`);
                setTimeout(() => {
                    console.log('🚨 Graceful shutdown timeout, forcing exit');
                    process.exit(1);
                }, opts.gracefulShutdownTimeout);
            });
        });
        console.log(`⚙️ Applied process optimizations for ${this.platformInfo.platform}`);
    }
    /**
     * Apply platform-specific memory optimizations
     */
    applyMemoryOptimizations() {
        const opts = this.optimizations.memoryManagement;
        // Configure garbage collection based on platform
        if (global.gc) {
            const gcInterval = setInterval(() => {
                const memUsage = process.memoryUsage();
                const heapUsedPercent = memUsage.heapUsed / memUsage.heapTotal;
                if (heapUsedPercent > opts.memoryThreshold) {
                    console.log(`🧹 Memory threshold exceeded (${(heapUsedPercent * 100).toFixed(1)}%), triggering GC`);
                    global.gc();
                }
            }, opts.gcInterval);
            // Clear interval on process exit
            process.on('exit', () => clearInterval(gcInterval));
        }
        // Set heap size limits if supported
        if (opts.heapSizeLimit > 0) {
            console.log(`💾 Memory limit set to ${Math.round(opts.heapSizeLimit / 1024 / 1024)}MB`);
        }
        console.log(`🧠 Applied memory optimizations (${opts.gcStrategy} strategy)`);
    }
    /**
     * Get optimized Docker Compose configuration
     */
    getOptimizedDockerConfig() {
        const dockerOpts = this.optimizations.dockerOptimizations;
        return {
            version: '3.8',
            services: {
                gateway: {
                    build: '.',
                    ports: ['3000:3000'],
                    environment: {
                        NODE_ENV: 'production',
                        NODE_OPTIONS: this.getNodeOptions()
                    },
                    deploy: {
                        resources: {
                            limits: dockerOpts.resourceLimits,
                            reservations: {
                                memory: '256M',
                                cpus: '0.5'
                            }
                        },
                        restart_policy: {
                            condition: dockerOpts.restartPolicy,
                            delay: '5s',
                            max_attempts: 3,
                            window: '120s'
                        }
                    },
                    healthcheck: {
                        test: ['CMD', 'curl', '-f', 'http://localhost:3000/health'],
                        interval: `${dockerOpts.healthCheckInterval}s`,
                        timeout: '10s',
                        retries: 3,
                        start_period: '30s'
                    },
                    logging: {
                        driver: dockerOpts.logDriver,
                        options: {
                            'max-size': '10m',
                            'max-file': '3'
                        }
                    }
                }
            }
        };
    }
    /**
     * Get optimized Node.js options
     */
    getNodeOptions() {
        const memOpts = this.optimizations.memoryManagement;
        const options = [];
        // Memory optimizations
        if (memOpts.heapSizeLimit > 0) {
            options.push(`--max-old-space-size=${Math.round(memOpts.heapSizeLimit / 1024 / 1024)}`);
        }
        // Garbage collection optimizations
        if (memOpts.gcStrategy === 'aggressive') {
            options.push('--expose-gc');
            options.push('--optimize-for-size');
        }
        else if (memOpts.gcStrategy === 'balanced') {
            options.push('--expose-gc');
        }
        // Platform-specific optimizations
        if (this.platformInfo.platform === 'win32') {
            options.push('--max-semi-space-size=64');
        }
        if (this.platformInfo.isDocker) {
            options.push('--unhandled-rejections=strict');
        }
        return options.join(' ');
    }
    /**
     * Detect platform information
     */
    detectPlatform() {
        const currentPlatform = (0, os_1.platform)();
        const currentArch = (0, os_1.arch)();
        const isWSL = this.detectWSL();
        const isDocker = this.detectDocker();
        return {
            platform: currentPlatform,
            architecture: currentArch,
            isWSL,
            isDocker,
            cpuCount: (0, os_1.cpus)().length,
            totalMemory: (0, os_1.totalmem)(),
            freeMemory: (0, os_1.freemem)(),
            nodeVersion: process.version,
            optimizations: {} // Will be filled by generateOptimizations
        };
    }
    /**
     * Detect if running in WSL
     */
    detectWSL() {
        try {
            const procVersion = require('fs').readFileSync('/proc/version', 'utf8');
            return procVersion.toLowerCase().includes('microsoft');
        }
        catch {
            return false;
        }
    }
    /**
     * Detect if running in Docker
     */
    detectDocker() {
        try {
            require('fs').readFileSync('/.dockerenv');
            return true;
        }
        catch {
            try {
                const cgroup = require('fs').readFileSync('/proc/1/cgroup', 'utf8');
                return cgroup.includes('docker') || cgroup.includes('containerd');
            }
            catch {
                return false;
            }
        }
    }
    /**
     * Generate platform-specific optimizations
     */
    generateOptimizations() {
        const baseOptimizations = {
            fileHandling: {
                useAsyncIO: true,
                batchSize: 100,
                bufferSize: 64 * 1024,
                concurrentOperations: 10,
                fsyncEnabled: false,
                tempDirectory: '/tmp'
            },
            processManagement: {
                maxWorkers: this.platformInfo.cpuCount,
                processTimeout: 30000,
                gracefulShutdownTimeout: 10000,
                processPooling: true,
                signalHandling: ['SIGTERM', 'SIGINT']
            },
            memoryManagement: {
                gcStrategy: 'balanced',
                heapSizeLimit: Math.min(this.platformInfo.totalMemory * 0.8, 2 * 1024 * 1024 * 1024),
                gcInterval: 60000,
                memoryThreshold: 0.8,
                enableMemoryProfiling: false
            },
            networkOptimizations: {
                keepAliveTimeout: 5000,
                maxConnections: 1000,
                connectionPooling: true,
                tcpNoDelay: true,
                socketTimeout: 30000
            },
            dockerOptimizations: {
                useDockerAPI: true,
                healthCheckInterval: 30,
                restartPolicy: 'on-failure',
                resourceLimits: {
                    memory: '1G',
                    cpu: '1.0'
                },
                logDriver: 'json-file'
            }
        };
        // Platform-specific adjustments
        switch (this.platformInfo.platform) {
            case 'win32':
                return this.getWindowsOptimizations(baseOptimizations);
            case 'linux':
                return this.platformInfo.isWSL
                    ? this.getWSLOptimizations(baseOptimizations)
                    : this.getLinuxOptimizations(baseOptimizations);
            case 'darwin':
                return this.getMacOSOptimizations(baseOptimizations);
            default:
                console.log(`⚠️ Unknown platform: ${this.platformInfo.platform}, using default optimizations`);
                return baseOptimizations;
        }
    }
    /**
     * Windows-specific optimizations
     */
    getWindowsOptimizations(base) {
        return {
            ...base,
            fileHandling: {
                ...base.fileHandling,
                bufferSize: 32 * 1024, // Smaller buffer for Windows
                concurrentOperations: 5, // Fewer concurrent operations
                fsyncEnabled: true, // Enable fsync for data integrity
                tempDirectory: process.env.TEMP || 'C:\\temp'
            },
            processManagement: {
                ...base.processManagement,
                processTimeout: 45000, // Longer timeout for Windows
                gracefulShutdownTimeout: 15000,
                signalHandling: ['SIGTERM', 'SIGINT', 'SIGBREAK']
            },
            memoryManagement: {
                ...base.memoryManagement,
                gcStrategy: 'conservative', // More conservative GC on Windows
                gcInterval: 90000, // Less frequent GC
                memoryThreshold: 0.75 // Lower threshold
            },
            networkOptimizations: {
                ...base.networkOptimizations,
                keepAliveTimeout: 10000, // Longer keep-alive
                maxConnections: 500 // Fewer max connections
            }
        };
    }
    /**
     * WSL-specific optimizations
     */
    getWSLOptimizations(base) {
        return {
            ...base,
            fileHandling: {
                ...base.fileHandling,
                bufferSize: 48 * 1024, // Medium buffer for WSL
                concurrentOperations: 8,
                fsyncEnabled: false // WSL handles this
            },
            processManagement: {
                ...base.processManagement,
                processTimeout: 35000,
                maxWorkers: Math.max(2, this.platformInfo.cpuCount - 1) // Leave one CPU for WSL overhead
            },
            memoryManagement: {
                ...base.memoryManagement,
                gcStrategy: 'balanced',
                heapSizeLimit: Math.min(this.platformInfo.totalMemory * 0.6, 1.5 * 1024 * 1024 * 1024) // Less memory for WSL
            },
            dockerOptimizations: {
                ...base.dockerOptimizations,
                resourceLimits: {
                    memory: '768M', // Smaller limits for WSL
                    cpu: '0.8'
                }
            }
        };
    }
    /**
     * Linux-specific optimizations
     */
    getLinuxOptimizations(base) {
        return {
            ...base,
            fileHandling: {
                ...base.fileHandling,
                bufferSize: 128 * 1024, // Larger buffer for Linux
                concurrentOperations: 15,
                fsyncEnabled: false // Linux handles this efficiently
            },
            processManagement: {
                ...base.processManagement,
                maxWorkers: this.platformInfo.cpuCount + 2, // Can handle more workers
                signalHandling: ['SIGTERM', 'SIGINT', 'SIGUSR1', 'SIGUSR2']
            },
            memoryManagement: {
                ...base.memoryManagement,
                gcStrategy: 'aggressive', // More aggressive GC on Linux
                gcInterval: 45000
            },
            networkOptimizations: {
                ...base.networkOptimizations,
                maxConnections: 2000 // Higher connection limit
            }
        };
    }
    /**
     * macOS-specific optimizations
     */
    getMacOSOptimizations(base) {
        return {
            ...base,
            fileHandling: {
                ...base.fileHandling,
                bufferSize: 96 * 1024,
                concurrentOperations: 12
            },
            processManagement: {
                ...base.processManagement,
                signalHandling: ['SIGTERM', 'SIGINT', 'SIGUSR1']
            },
            memoryManagement: {
                ...base.memoryManagement,
                gcStrategy: 'balanced'
            }
        };
    }
    /**
     * Windows-specific file writing
     */
    async writeFileWindows(filePath, data, opts) {
        const tempPath = (0, path_1.join)(opts.tempDirectory, `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
        try {
            // Write to temp file first
            await fs_1.promises.writeFile(tempPath, data, { flag: 'w' });
            if (opts.fsyncEnabled) {
                // Force sync on Windows for data integrity
                const fd = await fs_1.promises.open(tempPath, 'r+');
                await fd.sync();
                await fd.close();
            }
            // Atomic move on Windows
            await fs_1.promises.rename(tempPath, filePath);
        }
        catch (error) {
            // Clean up temp file on error
            try {
                await fs_1.promises.unlink(tempPath);
            }
            catch { }
            throw error;
        }
    }
    /**
     * Unix-specific file writing
     */
    async writeFileUnix(filePath, data, opts) {
        const tempPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
        try {
            await fs_1.promises.writeFile(tempPath, data, { flag: 'w', mode: 0o644 });
            // Atomic move on Unix
            await fs_1.promises.rename(tempPath, filePath);
        }
        catch (error) {
            // Clean up temp file on error
            try {
                await fs_1.promises.unlink(tempPath);
            }
            catch { }
            throw error;
        }
    }
}
exports.PlatformOptimizer = PlatformOptimizer;
// Export singleton instance
exports.platformOptimizer = new PlatformOptimizer();
// Export utility functions
function getPlatformInfo() {
    return exports.platformOptimizer.getPlatformInfo();
}
function applyPlatformOptimizations() {
    exports.platformOptimizer.applyProcessOptimizations();
    exports.platformOptimizer.applyMemoryOptimizations();
}
async function optimizedFileWrite(filePath, data) {
    return exports.platformOptimizer.optimizeFileOperations(filePath, data);
}
//# sourceMappingURL=platform-optimizations.js.map
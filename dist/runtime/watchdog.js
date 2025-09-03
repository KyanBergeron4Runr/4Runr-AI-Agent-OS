"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.watchdogService = exports.WatchdogService = void 0;
const child_process_1 = require("child_process");
const events_1 = require("events");
const http_1 = __importDefault(require("http"));
const fs_1 = require("fs");
const cross_platform_executor_1 = require("../utils/cross-platform-executor");
/**
 * External Watchdog Service for monitoring and recovering the main application
 * Runs as a separate process to monitor the main application health
 */
class WatchdogService extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        this.monitoredProcess = null;
        this.monitoredPid = null;
        this.isMonitoring = false;
        this.healthCheckTimer = null;
        this.recoveryHistory = [];
        this.restartCount = 0;
        this.restartWindowStart = Date.now();
        this.config = {
            healthCheckUrl: 'http://localhost:3000/health',
            healthCheckInterval: 30000, // 30 seconds
            healthCheckTimeout: 5000, // 5 seconds
            maxResponseTime: 2000, // 2 seconds
            maxMemoryMB: 512, // 512 MB
            maxCpuPercent: 80, // 80%
            failureThreshold: 3, // 3 consecutive failures
            restartDelay: 5000, // 5 seconds
            maxRestarts: 5, // Max 5 restarts
            restartWindow: 300000, // 5 minutes
            logFile: 'logs/watchdog.log',
            ...config
        };
        this.processHealth = {
            responsive: false,
            responseTime: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            uptime: 0,
            lastCheck: new Date(),
            consecutiveFailures: 0
        };
        this.setupGracefulShutdown();
    }
    /**
     * Start monitoring a process by PID
     */
    async monitorProcess(pid) {
        if (this.isMonitoring) {
            throw new Error('Watchdog is already monitoring a process');
        }
        this.monitoredPid = pid;
        this.isMonitoring = true;
        this.restartCount = 0;
        this.restartWindowStart = Date.now();
        await this.log(`🐕 Watchdog started monitoring PID ${pid}`);
        // Start health checking
        this.startHealthChecking();
        this.emit('monitoring-started', pid);
    }
    /**
     * Start monitoring a spawned process
     */
    async monitorSpawnedProcess(command, args = [], options = {}) {
        if (this.isMonitoring) {
            throw new Error('Watchdog is already monitoring a process');
        }
        await this.log(`🚀 Spawning process: ${command} ${args.join(' ')}`);
        this.monitoredProcess = (0, child_process_1.spawn)(command, args, {
            stdio: ['inherit', 'inherit', 'inherit'],
            ...options
        });
        if (!this.monitoredProcess.pid) {
            throw new Error('Failed to spawn process');
        }
        this.monitoredPid = this.monitoredProcess.pid;
        // Handle process events
        this.monitoredProcess.on('exit', async (code, signal) => {
            await this.log(`⚰️ Process exited with code ${code}, signal ${signal}`);
            await this.handleProcessExit(code, signal);
        });
        this.monitoredProcess.on('error', async (error) => {
            await this.log(`❌ Process error: ${error.message}`);
            this.emit('process-error', error);
        });
        await this.monitorProcess(this.monitoredProcess.pid);
    }
    /**
     * Stop monitoring
     */
    async stop() {
        if (!this.isMonitoring)
            return;
        this.isMonitoring = false;
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
        await this.log('🛑 Watchdog stopped monitoring');
        this.emit('monitoring-stopped');
    }
    /**
     * Get current process health
     */
    getProcessHealth() {
        return { ...this.processHealth };
    }
    /**
     * Get recovery history
     */
    getRecoveryHistory() {
        return [...this.recoveryHistory];
    }
    /**
     * Force restart the monitored process
     */
    async restartProcess(reason) {
        if (!this.isMonitoring || !this.monitoredPid) {
            throw new Error('No process being monitored');
        }
        await this.log(`🔄 Manual restart requested: ${reason}`);
        await this.performRestart(reason);
    }
    /**
     * Kill the monitored process
     */
    async killProcess(signal = 'SIGTERM') {
        if (!this.monitoredPid) {
            throw new Error('No process being monitored');
        }
        await this.log(`💀 Killing process ${this.monitoredPid} with ${signal}`);
        try {
            process.kill(this.monitoredPid, signal);
            this.recordRecoveryEvent({
                reason: `Manual kill with ${signal}`,
                action: 'kill',
                success: true
            });
        }
        catch (error) {
            await this.log(`❌ Failed to kill process: ${error}`);
            this.recordRecoveryEvent({
                reason: `Failed to kill with ${signal}`,
                action: 'kill',
                success: false,
                details: error
            });
            throw error;
        }
    }
    /**
     * Start health checking loop
     */
    startHealthChecking() {
        this.healthCheckTimer = setInterval(async () => {
            await this.performHealthCheck();
        }, this.config.healthCheckInterval);
        // Perform initial check
        setImmediate(() => this.performHealthCheck());
    }
    /**
     * Perform a single health check
     */
    async performHealthCheck() {
        if (!this.isMonitoring || !this.monitoredPid)
            return;
        const startTime = Date.now();
        let healthCheckPassed = false;
        let responseTime = 0;
        let errorMessage = '';
        try {
            // Check if process is still running
            if (!this.isProcessRunning(this.monitoredPid)) {
                throw new Error('Process is not running');
            }
            // Perform HTTP health check
            const response = await this.httpHealthCheck();
            responseTime = Date.now() - startTime;
            // Check response time
            if (responseTime > this.config.maxResponseTime) {
                throw new Error(`Response time too slow: ${responseTime}ms > ${this.config.maxResponseTime}ms`);
            }
            // Get process metrics
            const processMetrics = await this.getProcessMetrics(this.monitoredPid);
            // Check memory usage
            if (processMetrics.memoryMB > this.config.maxMemoryMB) {
                throw new Error(`Memory usage too high: ${processMetrics.memoryMB}MB > ${this.config.maxMemoryMB}MB`);
            }
            // Check CPU usage
            if (processMetrics.cpuPercent > this.config.maxCpuPercent) {
                throw new Error(`CPU usage too high: ${processMetrics.cpuPercent}% > ${this.config.maxCpuPercent}%`);
            }
            // Health check passed
            healthCheckPassed = true;
            this.processHealth = {
                responsive: true,
                responseTime,
                memoryUsage: processMetrics.memoryMB,
                cpuUsage: processMetrics.cpuPercent,
                uptime: processMetrics.uptime,
                lastCheck: new Date(),
                consecutiveFailures: 0
            };
            this.emit('health-check-passed', this.processHealth);
        }
        catch (error) {
            errorMessage = error instanceof Error ? error.message : String(error);
            this.processHealth = {
                responsive: false,
                responseTime,
                memoryUsage: this.processHealth.memoryUsage,
                cpuUsage: this.processHealth.cpuUsage,
                uptime: this.processHealth.uptime,
                lastCheck: new Date(),
                consecutiveFailures: this.processHealth.consecutiveFailures + 1
            };
            await this.log(`⚠️ Health check failed: ${errorMessage}`);
            this.emit('health-check-failed', this.processHealth, errorMessage);
            // Check if we need to take recovery action
            if (this.processHealth.consecutiveFailures >= this.config.failureThreshold) {
                await this.handleHealthFailure(errorMessage);
            }
        }
    }
    /**
     * Perform HTTP health check
     */
    async httpHealthCheck() {
        return new Promise((resolve, reject) => {
            const url = new URL(this.config.healthCheckUrl);
            const req = http_1.default.request({
                hostname: url.hostname,
                port: url.port || 80,
                path: url.pathname,
                method: 'GET',
                timeout: this.config.healthCheckTimeout
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            const parsed = JSON.parse(data);
                            resolve(parsed);
                        }
                        catch {
                            resolve(data);
                        }
                    }
                    else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Health check timeout'));
            });
            req.end();
        });
    }
    /**
     * Check if process is running
     */
    isProcessRunning(pid) {
        try {
            process.kill(pid, 0); // Signal 0 just checks if process exists
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get process metrics with cross-platform implementation
     */
    async getProcessMetrics(pid) {
        try {
            const metrics = await this.getSystemProcessMetrics(pid);
            return {
                memoryMB: Math.round(metrics.memoryBytes / 1024 / 1024),
                cpuPercent: Math.round(metrics.cpuPercent * 100) / 100,
                uptime: metrics.uptime
            };
        }
        catch (error) {
            await this.log(`⚠️ Failed to get process metrics for PID ${pid}: ${error}`);
            // Fallback to basic metrics if detailed monitoring fails
            return {
                memoryMB: 0,
                cpuPercent: 0,
                uptime: Date.now() - this.restartWindowStart
            };
        }
    }
    /**
     * Get detailed system process metrics using cross-platform commands
     */
    async getSystemProcessMetrics(pid) {
        const platform = process.platform;
        if (platform === 'win32') {
            return await this.getWindowsProcessMetrics(pid);
        }
        else {
            return await this.getUnixProcessMetrics(pid);
        }
    }
    /**
     * Get process metrics on Windows using PowerShell
     */
    async getWindowsProcessMetrics(pid) {
        try {
            // Use PowerShell to get process information
            const psCommand = `Get-Process -Id ${pid} | Select-Object WorkingSet,CPU,StartTime | ConvertTo-Json`;
            const result = await (0, cross_platform_executor_1.executeCommand)('powershell', ['-Command', psCommand], {
                timeout: 5000,
                retries: 1
            });
            if (!result.success) {
                throw new Error(`PowerShell command failed: ${result.stderr}`);
            }
            const processInfo = JSON.parse(result.stdout.trim());
            const startTime = new Date(processInfo.StartTime);
            const uptime = Date.now() - startTime.getTime();
            return {
                memoryBytes: processInfo.WorkingSet || 0,
                cpuPercent: processInfo.CPU || 0,
                uptime: Math.max(uptime, 0)
            };
        }
        catch (error) {
            // Fallback to basic Windows metrics
            await this.log(`⚠️ PowerShell metrics failed, using fallback: ${error}`);
            const result = await (0, cross_platform_executor_1.executeCommand)('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV'], {
                timeout: 3000,
                retries: 1
            });
            if (result.success && result.stdout.includes(`"${pid}"`)) {
                // Parse CSV output for basic memory info
                const lines = result.stdout.trim().split('\n');
                if (lines.length > 1) {
                    const processLine = lines.find(line => line.includes(`"${pid}"`));
                    if (processLine) {
                        const fields = processLine.split(',');
                        const memoryField = fields[4]; // Memory usage field
                        if (memoryField) {
                            const memoryStr = memoryField.replace(/[",K\s]/g, '');
                            const memoryKB = parseInt(memoryStr) || 0;
                            return {
                                memoryBytes: memoryKB * 1024,
                                cpuPercent: 0, // CPU not available in tasklist
                                uptime: Date.now() - this.restartWindowStart
                            };
                        }
                    }
                }
            }
            throw new Error('Unable to get Windows process metrics');
        }
    }
    /**
     * Get process metrics on Unix-like systems using ps
     */
    async getUnixProcessMetrics(pid) {
        try {
            // Use ps command to get detailed process information
            const psCommand = ['ps', '-p', pid.toString(), '-o', 'rss,pcpu,etime', '--no-headers'];
            const result = await (0, cross_platform_executor_1.executeCommand)('ps', psCommand.slice(1), {
                timeout: 3000,
                retries: 1
            });
            if (!result.success) {
                throw new Error(`ps command failed: ${result.stderr}`);
            }
            const output = result.stdout.trim();
            if (!output) {
                throw new Error('Process not found');
            }
            // Parse ps output: RSS(KB) %CPU ELAPSED
            const fields = output.split(/\s+/);
            if (fields.length < 3) {
                throw new Error('Invalid ps output format');
            }
            const rssKB = parseInt(fields[0]) || 0;
            const cpuPercent = parseFloat(fields[1]) || 0;
            const elapsedTime = fields[2] || '0:00';
            // Parse elapsed time (format: [[DD-]HH:]MM:SS)
            const uptime = this.parseElapsedTime(elapsedTime);
            return {
                memoryBytes: rssKB * 1024,
                cpuPercent,
                uptime
            };
        }
        catch (error) {
            // Fallback to /proc filesystem on Linux
            if (process.platform === 'linux') {
                return await this.getLinuxProcMetrics(pid);
            }
            throw error;
        }
    }
    /**
     * Get process metrics from Linux /proc filesystem
     */
    async getLinuxProcMetrics(pid) {
        try {
            const fs = require('fs').promises;
            // Read /proc/[pid]/stat for basic info
            const statContent = await fs.readFile(`/proc/${pid}/stat`, 'utf8');
            const statFields = statContent.trim().split(' ');
            // Read /proc/[pid]/status for memory info
            const statusContent = await fs.readFile(`/proc/${pid}/status`, 'utf8');
            const vmRSSMatch = statusContent.match(/VmRSS:\s+(\d+)\s+kB/);
            // Read system uptime
            const uptimeContent = await fs.readFile('/proc/uptime', 'utf8');
            const systemUptime = parseFloat(uptimeContent.split(' ')[0]);
            // Calculate process uptime (field 22 is starttime in clock ticks)
            const startTime = parseInt(statFields[21]) || 0;
            const clockTicks = 100; // Typical value, could read from sysconf
            const processStartSeconds = startTime / clockTicks;
            const processUptime = (systemUptime - processStartSeconds) * 1000; // Convert to ms
            const memoryKB = vmRSSMatch ? parseInt(vmRSSMatch[1]) : 0;
            return {
                memoryBytes: memoryKB * 1024,
                cpuPercent: 0, // CPU calculation requires multiple samples
                uptime: Math.max(processUptime, 0)
            };
        }
        catch (error) {
            throw new Error(`Failed to read /proc filesystem: ${error}`);
        }
    }
    /**
     * Parse elapsed time string from ps command
     */
    parseElapsedTime(elapsedStr) {
        try {
            // Format can be: MM:SS, HH:MM:SS, or DD-HH:MM:SS
            let totalSeconds = 0;
            if (elapsedStr.includes('-')) {
                // DD-HH:MM:SS format
                const [daysPart, timePart] = elapsedStr.split('-');
                const days = parseInt(daysPart) || 0;
                totalSeconds += days * 24 * 60 * 60;
                elapsedStr = timePart;
            }
            const timeParts = elapsedStr.split(':').map(part => parseInt(part) || 0);
            if (timeParts.length === 2) {
                // MM:SS format
                totalSeconds += timeParts[0] * 60 + timeParts[1];
            }
            else if (timeParts.length === 3) {
                // HH:MM:SS format
                totalSeconds += timeParts[0] * 60 * 60 + timeParts[1] * 60 + timeParts[2];
            }
            return totalSeconds * 1000; // Convert to milliseconds
        }
        catch (error) {
            return 0;
        }
    }
    /**
     * Handle health check failures
     */
    async handleHealthFailure(reason) {
        await this.log(`🚨 Health failure threshold reached: ${reason}`);
        // Check restart limits
        const now = Date.now();
        if (now - this.restartWindowStart > this.config.restartWindow) {
            // Reset restart window
            this.restartCount = 0;
            this.restartWindowStart = now;
        }
        if (this.restartCount >= this.config.maxRestarts) {
            await this.log(`🚨 Max restarts (${this.config.maxRestarts}) reached in window, escalating to operator`);
            this.recordRecoveryEvent({
                reason: `Max restarts reached: ${reason}`,
                action: 'alert',
                success: false
            });
            this.emit('escalation-required', reason, this.restartCount);
            return;
        }
        // Attempt restart
        await this.performRestart(reason);
    }
    /**
     * Perform process restart
     */
    async performRestart(reason) {
        if (!this.monitoredPid)
            return;
        this.restartCount++;
        await this.log(`🔄 Restarting process (attempt ${this.restartCount}/${this.config.maxRestarts}): ${reason}`);
        try {
            // Kill the process
            if (this.monitoredProcess) {
                this.monitoredProcess.kill('SIGTERM');
                // Wait for graceful shutdown
                await new Promise(resolve => setTimeout(resolve, this.config.restartDelay));
                // Force kill if still running
                if (this.isProcessRunning(this.monitoredPid)) {
                    this.monitoredProcess.kill('SIGKILL');
                }
            }
            else {
                // External process - send SIGTERM
                process.kill(this.monitoredPid, 'SIGTERM');
                await new Promise(resolve => setTimeout(resolve, this.config.restartDelay));
                if (this.isProcessRunning(this.monitoredPid)) {
                    process.kill(this.monitoredPid, 'SIGKILL');
                }
            }
            this.recordRecoveryEvent({
                reason,
                action: 'restart',
                success: true
            });
            this.emit('process-restarted', reason, this.restartCount);
        }
        catch (error) {
            await this.log(`❌ Restart failed: ${error}`);
            this.recordRecoveryEvent({
                reason: `Restart failed: ${reason}`,
                action: 'restart',
                success: false,
                details: error
            });
            this.emit('restart-failed', error, reason);
        }
    }
    /**
     * Handle process exit
     */
    async handleProcessExit(code, signal) {
        if (!this.isMonitoring)
            return;
        const reason = `Process exited with code ${code}, signal ${signal}`;
        // If this was an unexpected exit, try to restart
        if (code !== 0 && this.restartCount < this.config.maxRestarts) {
            await this.log(`🔄 Unexpected exit, attempting restart...`);
            // Wait before restart
            await new Promise(resolve => setTimeout(resolve, this.config.restartDelay));
            // Respawn if we have the command
            if (this.monitoredProcess) {
                // For spawned processes, we'd need to store the original command
                // This is a simplified implementation
                this.emit('respawn-needed', reason);
            }
        }
        else {
            await this.log(`💀 Process exit - not restarting (code: ${code}, restarts: ${this.restartCount})`);
            this.emit('monitoring-ended', reason);
        }
    }
    /**
     * Record recovery event
     */
    recordRecoveryEvent(event) {
        const recoveryEvent = {
            timestamp: new Date(),
            ...event
        };
        this.recoveryHistory.push(recoveryEvent);
        // Keep only last 50 events
        if (this.recoveryHistory.length > 50) {
            this.recoveryHistory.shift();
        }
        this.emit('recovery-event', recoveryEvent);
    }
    /**
     * Log message to file and console
     */
    async log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        if (this.config.logFile) {
            try {
                await fs_1.promises.appendFile(this.config.logFile, logMessage + '\n');
            }
            catch (error) {
                console.error('Failed to write to log file:', error);
            }
        }
    }
    /**
     * Setup graceful shutdown
     */
    setupGracefulShutdown() {
        const signals = ['SIGTERM', 'SIGINT'];
        signals.forEach(signal => {
            process.on(signal, async () => {
                await this.log(`Received ${signal}, shutting down watchdog...`);
                await this.stop();
                process.exit(0);
            });
        });
    }
    /**
     * Execute command with cross-platform compatibility
     */
    async executeCommand(command, args = [], options = {}) {
        try {
            await this.log(`🚀 Executing cross-platform command: ${command} ${args.join(' ')}`);
            const result = await (0, cross_platform_executor_1.executeCommand)(command, args, {
                timeout: options.timeout || 30000,
                retries: options.retries || 2,
                cwd: options.cwd,
                retryDelay: 1000
            });
            if (result.success) {
                await this.log(`✅ Command completed successfully: ${command}`);
                return {
                    success: true,
                    output: result.stdout
                };
            }
            else {
                await this.log(`❌ Command failed: ${command} - ${result.stderr}`);
                return {
                    success: false,
                    output: result.stdout,
                    error: result.stderr
                };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.log(`💥 Command execution error: ${command} - ${errorMessage}`);
            return {
                success: false,
                output: '',
                error: errorMessage
            };
        }
    }
    /**
     * Get platform information
     */
    getPlatformInfo() {
        return cross_platform_executor_1.crossPlatformExecutor.getPlatformInfo();
    }
}
exports.WatchdogService = WatchdogService;
// Export singleton instance
exports.watchdogService = new WatchdogService();
//# sourceMappingURL=watchdog.js.map